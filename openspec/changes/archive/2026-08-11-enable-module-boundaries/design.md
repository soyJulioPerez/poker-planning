# Diseño — Activar los límites entre proyectos

## Context

El workspace tiene 6 proyectos. El grafo de dependencias real, verificado con `nx graph`:

```
        shared-contracts  ◀── (no depende de nadie)
              ▲  ▲  ▲
              │  │  └──────────────┐
              │  └───────┐         │
              │          │         │
    room-client-runtime  │    realtime-api
         ▲       ▲       │
         │       │       │
        web    mobile ───┘

    e2e  ── (no depende de ningún proyecto del workspace)
```

Textualmente:

| Proyecto | Depende de |
|---|---|
| `shared-contracts` | — |
| `room-client-runtime` | `shared-contracts` |
| `realtime-api` | `shared-contracts` |
| `web` | `room-client-runtime`, `shared-contracts` |
| `mobile` | `room-client-runtime`, `shared-contracts` |
| `e2e` | — |

Este grafo es *ya* el que queremos. No hay que refactorizar nada: hay que escribirlo como regla para que deje de depender de la disciplina de quien programa. Es el resultado del change `uncouple-client-logic`, que sacó la lógica de sala de `web` y la puso en `room-client-runtime` para que mobile la reusara.

**Estado actual de la configuración**: `eslint.config.mjs` declara constraints para `scope:shared`, `scope:shop`, `scope:api` y `type:data`. Los 6 proyectos tienen `"tags": []`. `scope:shop` es de una tienda que no existe; `type:data` no corresponde a ningún proyecto.

**Por qué falla hoy**: `@nx/enforce-module-boundaries` trata a un proyecto sin tags que matcheen ninguna constraint como incapaz de depender de nada. No es un bug: es el comportamiento de fallo seguro de la regla. El problema es que la configuración quedó a medio camino — constraints sin tags.

**Origen**: los generadores de Nx aceptan `--tags` pero **no lo infieren**. El schema de `@nx/angular:application` lo describe como `"Add tags to the application (used for linting)"`, sin default. Los comandos originales (ver `INSTALL_LOG.md`) no lo pasaron, mientras el preset del workspace sí escribió constraints de ejemplo. De ahí la asimetría.

## Goals / Non-Goals

**Goals:**

- Que `nx lint` pase en verde en los 6 proyectos, sin errores de boundaries.
- Que un import ilegal falle el lint, verificado con una violación deliberada.
- Que las constraints describan la arquitectura real y sean legibles sin contexto extra.
- Desbloquear la Fase 1.1 del roadmap: que `lint` pueda entrar al gate de CI.

**Non-Goals:**

- **No se refactoriza código de aplicación.** El grafo ya cumple. Si un import tuviera que moverse, se documenta como hallazgo antes de tocarlo.
- **No se resuelven las Fases 3.2 y 3.3** (`release.projects` apuntando a un proyecto inexistente, plugin de Docker sin Dockerfile). Comparten fase en el roadmap pero no tienen relación técnica con esto.
- **No se arreglan los otros errores de lint.** `apps/web` tiene además 2 errores de accesibilidad de `@angular-eslint` y 1 warning de variable sin usar. Son reales y están documentados en `known-issues.md`, pero son de otra naturaleza: este change solo se hace cargo de los de boundaries.
- **No se agregan tags de granularidad fina** (`type:ui`, `type:data-access`, etc.). Con 6 proyectos sería ceremonia.

## Decisions

### Decisión 1: Dos ejes de tags (`scope:*` + `type:*`), no uno

**Elegido**: cada proyecto lleva un tag de scope y uno de tipo.

| Proyecto | `scope:*` | `type:*` |
|---|---|---|
| `shared-contracts` | `scope:shared` | `type:util` |
| `room-client-runtime` | `scope:client` | `type:feature` |
| `web` | `scope:web` | `type:app` |
| `mobile` | `scope:mobile` | `type:app` |
| `realtime-api` | `scope:api` | `type:app` |
| `e2e` | `scope:e2e` | `type:e2e` |

**Por qué dos y no uno**: los dos ejes responden preguntas distintas y ninguno cubre al otro.

- `scope:*` responde *"¿a qué parte del producto pertenece?"* — expresa bien "web no ve a mobile".
- `type:*` responde *"¿qué clase de artefacto es?"* — expresa "nadie depende de una app" en **una sola regla**, en vez de repetir la exclusión en cada scope.

Con un solo eje, la regla "nadie depende de una app" habría que escribirla como ausencia: enumerar en cada `onlyDependOnLibsWithTags` todo lo permitido y confiar en que nadie agregue una app por error. Con `type:*` es una propiedad del destino, y se sostiene sola cuando aparezca un proyecto nuevo.

**Alternativa descartada — solo `scope:*`**: menos tags que mantener, pero la regla más importante (la dirección del grafo) queda implícita. El costo de mantener seis tags extra es cero; el costo de una regla implícita se paga el día que alguien agrega una app.

**Alternativa descartada — la convención completa de Nx** (`type:ui`, `type:data-access`, `type:feature`, `type:util`): pensada para workspaces con decenas de librerías por dominio. Acá hay dos librerías. Se puede subdividir después si aparece la necesidad; empezar granular es adivinar.

### Decisión 2: `scope:client` para `room-client-runtime`, no `scope:shared`

`room-client-runtime` podría llevar `scope:shared` —lo comparten web y mobile— pero eso lo pondría al mismo nivel que `shared-contracts`, y no lo está: **`realtime-api` no debe poder importarlo.**

Con ambos en `scope:shared`, la constraint de `scope:api` (`onlyDependOnLibsWithTags: ['scope:api', 'scope:shared']`) le habilitaría a la Lambda importar el cliente WebSocket del navegador. Un `scope:client` aparte lo hace imposible por construcción.

O sea: "compartido" acá tiene dos significados distintos —compartido entre *todos* y compartido entre *los clientes*— y merecen tags distintos.

### Decisión 3: `e2e` con scope propio y permiso hacia `scope:shared`

Hoy `e2e` no importa nada del workspace: maneja la app por el navegador con Playwright. Pero es razonable que en algún momento quiera los tipos de `shared-contracts` para construir aserciones.

**Elegido**: `scope:e2e` puede depender de `scope:shared`, nada más. Es permiso preventivo para el caso legítimo, y cierra el ilegítimo (que un test e2e importe internals de `web`, acoplando el test a la implementación en vez de a la interfaz).

**Alternativa descartada — no darle constraint**: cae en el comportamiento por defecto y falla apenas alguien importe algo. Reproduciría el problema que este change viene a resolver.

### Decisión 4: constraints explícitas por scope, sin comodines

Se escribe una entrada por cada `sourceTag`, enumerando qué puede consumir:

```js
depConstraints: [
  { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
  { sourceTag: 'scope:client', onlyDependOnLibsWithTags: ['scope:client', 'scope:shared'] },
  { sourceTag: 'scope:web',    onlyDependOnLibsWithTags: ['scope:web', 'scope:client', 'scope:shared'] },
  { sourceTag: 'scope:mobile', onlyDependOnLibsWithTags: ['scope:mobile', 'scope:client', 'scope:shared'] },
  { sourceTag: 'scope:api',    onlyDependOnLibsWithTags: ['scope:api', 'scope:shared'] },
  { sourceTag: 'scope:e2e',    onlyDependOnLibsWithTags: ['scope:e2e', 'scope:shared'] },
  { sourceTag: 'type:util',    onlyDependOnLibsWithTags: ['type:util'] },
  { sourceTag: 'type:feature', onlyDependOnLibsWithTags: ['type:feature', 'type:util'] },
  { sourceTag: 'type:app',     onlyDependOnLibsWithTags: ['type:feature', 'type:util'] },
  { sourceTag: 'type:e2e',     onlyDependOnLibsWithTags: ['type:util'] },
]
```

Las constraints de `@nx/enforce-module-boundaries` son **conjuntivas**: un import tiene que ser permitido por *todas* las constraints que matcheen los tags del origen. Un import de `web` (`scope:web` + `type:app`) hacia `shared-contracts` (`scope:shared` + `type:util`) pasa porque lo permiten tanto la de `scope:web` como la de `type:app`.

Nótese que ninguna constraint de `type:*` incluye `type:app` en su lista de permitidos: ahí es donde vive "nadie depende de una app".

**Hallazgo de la implementación — el eje `type:*` no es verificable en aislamiento hoy**

Al intentar violar deliberadamente la regla "nadie depende de una app" apareció algo que este diseño no había previsto: **en este workspace no se puede.**

`tsconfig.base.json` solo declara alias para `shared-contracts` y `room-client-runtime`. Las tres apps no tienen alias, así que la única forma de importarlas es por ruta relativa — y eso lo rechaza antes una sub-regla distinta (`Projects cannot be imported by a relative or absolute path`), sin llegar nunca a evaluar los tags.

Y en el otro sentido, los dos proyectos importables por alias son `type:util` y `type:feature`, cuyos `scope:*` ya los restringen: cualquier violación de tipo es también una violación de scope, o directamente una dependencia circular.

O sea que hoy el eje `type:*` es **redundante en la práctica**: no hay ningún import que rechace y que los otros chequeos no rechacen ya. Se mantiene igual, por dos razones:

1. Cuesta cero y documenta la intención arquitectónica de forma legible.
2. Deja de ser redundante en el momento en que aparezca una librería nueva o se le dé alias a una app — que es justo cuando nadie se va a acordar de agregar la regla.

Pero conviene no creer que está verificada. Lo verificado es `scope:*`.

**Alternativa descartada — `allow` con patrones de path**: existe y ya se usa para los `eslint.config` (`allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$']`), pero razona sobre rutas de archivo, no sobre arquitectura. Los tags sobreviven a mover carpetas.

### Decisión 5: verificar rompiendo, no solo leyendo

El criterio de aceptación incluye introducir un import ilegal a propósito, confirmar que el lint falla, y revertirlo.

Puede sonar excesivo para una config de 10 líneas, pero es exactamente el error que este change viene a corregir: **la regla ya estaba "configurada" y no protegía nada.** Leer el archivo y darlo por bueno es lo que nos trajo hasta acá. Una regla de boundaries que nunca se vio fallar es indistinguible de una apagada.

## Risks / Trade-offs

**[Un import legítimo resulta ilegal según las reglas]** → El grafo real se verificó contra las constraints propuestas antes de escribirlas, así que no debería pasar. Si pasa: **no se relaja la regla para acomodar el import**. Se para, se documenta el caso y se decide a propósito si la regla está mal o el import lo está. Relajar en caliente es cómo estas reglas terminan permitiendo todo.

**[El lint sigue rojo por otras reglas y parece que el change falló]** → `apps/web` tiene 2 errores de accesibilidad y 1 warning independientes de este change. El criterio de aceptación se define sobre errores de `@nx/enforce-module-boundaries` específicamente, no sobre "lint verde". Hay que decirlo en `tasks.md` o la verificación se vuelve confusa.

**[El esquema queda corto cuando crezca el workspace]** → Probable y aceptable. Seis proyectos no justifican más granularidad. Agregar `type:ui` o `scope:*` nuevos después es barato; el esquema no se rompe, se extiende.

**[Los generadores futuros vuelven a crear proyectos sin tags]** → Es la causa original. Mitigación: dejar registrado en `conventions.md` que todo `nx g` lleve `--tags`. Y el fallo es ruidoso —el proyecto nuevo no puede importar nada— así que se detecta al primer lint, no en silencio.

## Migration Plan

No hay migración de datos ni de runtime: el cambio es de configuración estática y afecta solo al lint.

1. Etiquetar los 6 `project.json`.
2. Reescribir `depConstraints` en `eslint.config.mjs`.
3. Correr `nx run-many -t lint --all` y confirmar que no quedan errores de boundaries.
4. Verificación activa: violar, confirmar el fallo, revertir.
5. Actualizar la documentación que afirma que los boundaries no aplican.

**Rollback**: revertir el commit. No hay estado persistente ni artefacto desplegado; el efecto es enteramente local al lint.

## Open Questions

**¿Los 2 errores de accesibilidad de `web` se arreglan en este change o en uno aparte?**

Es la única pregunta abierta, y es la que decide si la Fase 1.1 queda desbloqueada al archivar esto.

El estado esperado al terminar este change:

| Proyecto | Antes | Después |
|---|---|---|
| `shared-contracts` | verde | verde |
| `room-client-runtime` | 1 error | **verde** (queda 1 warning) |
| `mobile` | 7 errores | **verde** |
| `realtime-api` | 14 errores | **verde** |
| `e2e` | verde | verde |
| `web` | 8 boundaries + 2 a11y | **2 a11y — sigue rojo** |

Los dos que quedan están en `apps/web/src/app/ui/participant-list/participant-list.html:18`:
`@angular-eslint/template/click-events-have-key-events` e `interactive-supports-focus`.

**Recomendación de este diseño: change aparte.** Son accesibilidad, no arquitectura; tocan un template y no la configuración del workspace; y ya están relevados en `known-issues.md` junto con el resto de la deuda de ARIA, así que conviene resolverlos todos juntos y no de a dos.

**La consecuencia hay que aceptarla explícitamente**: la Fase 1.1 depende entonces de **dos** changes. Si se prefiere que dependa de uno solo, la alternativa es meterlos acá y ampliar el alcance a "dejar el lint del workspace en verde" — coherente también, pero deja de ser un change sobre límites entre proyectos.

Lo que no es una opción es archivar esto creyendo que la 1.1 quedó lista.
