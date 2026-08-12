# Diseño — Los e2e entran al portón de CI

## Context

El portón de la Fase 1.1 quedó así:

```
              ┌──────────┐
   push/PR ──▶│  verify  │  lint · test · build   (~2 min)
              └────┬─────┘
                   │ needs
          ┌────────┴────────┐
          ▼                 ▼
   ┌─────────────┐   ┌────────────┐
   │deploy-backend│   │ deploy-web │   condicionados por el grafo
   └─────────────┘   └────────────┘
```

Falta la capa que prueba que web y backend hablan entre sí. Son 12 tests activos + 1 con `test.fixme`, repartidos en 3 specs.

**Estado del terreno**, verificado antes de escribir esto:

| | |
|---|---|
| `e2e` en el grafo | `implicitDependencies: []`, sin imports de código de app → **`affected` no lo marca nunca** |
| Modo `local` del config | no orquesta nada; asume DynamoDB + api + web ya arriba |
| Targets inferidos | `e2e` (no atomizado) y `e2e-ci` (atomizado en 3 + merge-reports) |
| `web:serve-static` | **ya existe**: `@nx/web:file-server`, `spa: true`, buildea con la config `production` |
| `realtime-api` | `ws` plano en el puerto 3001 ([main.ts:77](../../../apps/realtime-api/src/main.ts)); `dist/apps/realtime-api/main.js` corre con `node` a secas |
| `nxE2EPreset` | ya emite `retries: 2`, `workers: 1`, `forbidOnly` y reporter `blob` cuando `CI` está seteado |
| `room-moderation.spec.ts:158` | activo, documentado fallando ~2 de 3 corridas aisladas |

Las tres filas del medio son las que cambian el diseño respecto de lo que anticipaba el roadmap: el trabajo es bastante menor de lo estimado.

## Goals / Non-Goals

**Goals:**

- Que un e2e roto deje el PR en rojo y **frene los deploys**.
- Que el job corra cuando el cambio puede romper un e2e, y no cuando no.
- Que el stack de e2e se levante con un comando, en CI y en local, sin instrucciones de tres terminales.
- Que un fallo deje evidencia mirable sin reproducir nada a mano.
- Que un job que no hizo falta no se confunda nunca con uno que falló.

**Non-Goals:**

- **La branch protection** es la Fase 1.3.
- **La causa raíz de los tests inestables.** Están emparentados y documentados; es un change propio.
- **Nx Cloud / agentes distribuidos** (ver Decisión 4).
- **Cobertura cross-browser.** Sigue solo chromium, que es una decisión explícita previa.

## Decisions

### Decisión 1: `implicitDependencies`, no una regla aparte en el YAML

`e2e` no importa una línea de `web` ni de `realtime-api`: los page objects hablan con la app por HTTP y por el DOM. Para el grafo de Nx, eso es un proyecto aislado.

```
   HOY                              CON implicitDependencies

   shared-contracts                 shared-contracts
     ├── web                          ├── web ──────────┐
     ├── mobile                       ├── mobile        ├──▶ e2e
     └── realtime-api                 └── realtime-api ─┘

   e2e   (suelto)                   un cambio en web, api o shared-contracts
                                     alcanza a e2e
```

**Elegido**: declararlo en [e2e/project.json](../../../e2e/project.json).

```json
"implicitDependencies": ["web", "realtime-api"]
```

Es exactamente para lo que existe el campo: una dependencia real que el análisis estático no puede ver.

**Efecto lateral aceptado**: `e2e` también entra al alcance de `nx affected -t lint` cuando cambia `web`. Son segundos y es correcto — si cambia la app, revisar que los specs sigan lintando no sobra.

**Alternativa descartada — correr los e2e siempre en PRs**: es lo más simple y rompe el principio con el que se armó todo el pipeline (*"solo se ejecuta lo que tuvo cambios"*). Además paga ~4 minutos en cada PR de documentación.

**Alternativa descartada — un filtro de rutas en el `if:` del job**: es la lista escrita a mano que la Fase 1.1 vino a eliminar. Si mañana `web` depende de un paquete nuevo, el filtro no se entera y el job **se saltea en silencio**.

### Decisión 2: el stack se levanta desde el config de Playwright, no desde el YAML

El roadmap ofrecía dos caminos y recomendaba el del YAML por simplicidad. Con lo que se encontró, la recomendación se invierte.

El comentario de [playwright.config.mts:9-11](../../../e2e/playwright.config.mts) da por insalvable el conflicto:

> *El modo local no orquesta el backend porque `nx serve realtime-api`/`nx serve web` dentro de `webServer.command` entra en conflicto con el `dependsOn` que el propio plugin de Nx/Playwright infiere de esos mismos comandos ("recursive task invocation detected").*

Eso es cierto **de `nx serve`**. Pero ninguna de las dos apps necesita `nx serve` para levantarse:

| | Qué necesita en realidad |
|---|---|
| `web` | ~~`nx run web:serve-static`~~ → **`npx http-server dist/apps/web/browser --proxy`**. Ver la corrección de abajo. |
| `realtime-api` | `node dist/apps/realtime-api/main.js`. Es un `ws` plano; no hay nada que "servir". Y un comando `node` es **opaco** para la inferencia del plugin, que solo mira comandos `nx`. |

**Elegido**: un tercer modo, `E2E_TARGET=ci`.

```
   E2E_TARGET=local  (default)   no orquesta nada   ← iteración rápida con todo ya arriba
   E2E_TARGET=ci                 levanta api + web  ← CI, y reproducción local de CI
   E2E_TARGET=aws                levanta web contra el backend real
```

```js
webServer: [
  { command: 'npx nx run web:serve-static', url: baseURL, cwd: workspaceRoot },
  { command: 'node dist/apps/realtime-api/main.js', port: 3001, cwd: workspaceRoot, env: { ... } },
]
```

Para el backend se espera por **`port`, no por `url`**: es un WebSocket, no un servidor HTTP, y esperar por puerto evita depender de qué status devuelve a un GET.

**DynamoDB Local queda afuera de `webServer`**, y es deliberado: es un contenedor, no un proceso hijo, y su ciclo de vida no es el de la corrida de tests. Sigue siendo un paso previo — el mismo `npm run e2e:db:up` que ya existe.

Lo que compra este camino sobre el del YAML: **el modo `ci` se reproduce en local con un comando**, así que cuando el job falle no hay que adivinar qué levantó el runner. El YAML habría dejado ese conocimiento dentro de GitHub Actions, que es el peor lugar para debuggear.

**Corrección aplicada durante la implementación: `serve-static` sí dispara la recursión, y se tomó la salida que este diseño dejaba prevista.**

La primera versión usaba `nx run web:serve-static` —el patrón que emiten los propios generadores de `@nx/playwright`— y **pasó ocho corridas seguidas**, entre local y CI. Después falló:

```
e2e:e2e -> web:serve-static -> web:serve-static
Task "web:serve-static" was already invoked by a parent Nx process in this chain.
```

El plugin infiere el `dependsOn` a partir del comando, así que Nx levanta `web:serve-static` como dependencia continua **y** Playwright lo invoca de nuevo. Es intermitente porque `reuseExistingServer` lo tapa: si Playwright encuentra el puerto ya atendido por la tarea que levantó Nx, no ejecuta su comando y no hay conflicto.

Las ocho corridas verdes no probaban nada: **probaban que la carrera se venía ganando.** Queda como lección de método — un fallo intermitente no se descarta acumulando repeticiones exitosas, se descarta entendiendo el mecanismo.

**Elegido**: `npx http-server dist/apps/web/browser -p 4200 --proxy "http://localhost:4200?" -s`, opaco a la inferencia igual que el `node` del backend. Es el mismo binario que `@nx/web:file-server` usa por debajo, con el `--proxy` a sí mismo que da el fallback SPA. El build de `web` pasa a ser explícito, simétrico con el del backend.

Verificado: tres corridas locales consecutivas, 13/13, cero recursión.

### Decisión 3: el job corre en paralelo con `verify` y nunca queda `skipped`

Dos requisitos que se pelean entre sí:

1. El roadmap pide que e2e **no vaya en serie** con lint/test, para no demorar el feedback rápido.
2. Saber si `e2e` está afectado requiere `checkout` + `npm ci` — o sea, casi todo el setup de `verify`.

Resolverlo con un job `setup` que ambos consuman le agrega ~40s a todo el pipeline. Resolverlo con `needs: verify` lo pone en serie, que es lo que se quería evitar.

**Elegido**: job paralelo que **calcula su propio alcance como primer paso** y sigue o no según el resultado.

```
              ┌──────────┐        ┌──────────┐
   push/PR ──▶│  verify  │   +    │   e2e    │   arrancan juntos
              └────┬─────┘        └────┬─────┘
                   │                   │
                   │  ¿afectado? no ──▶ verde sin hacer nada
                   │                   │  sí ──▶ db + suite
                   └─────────┬─────────┘
                             ▼  needs: [verify, e2e]
                    ┌────────────────┐
                    │  deploy-* │
                    └────────────────┘
```

**Esto resuelve dos problemas de una vez**, y el segundo es el que no se ve venir.

El primero es la paralelización. El segundo: en GitHub Actions, **si un job del que dependés termina `skipped`, el dependiente se saltea también**. Un job `e2e` con `if:` a nivel de job quedaría `skipped` en la mayoría de las corridas —que es lo correcto— y arrastraría a `deploy-backend` y `deploy-web` con él. Un deploy que no corre porque un job no hizo falta es un modo de falla silencioso, y es peor que el problema original.

Al no usar `if:` a nivel de job, `e2e` **siempre termina en `success`**: o corrió la suite y pasó, o no había nada que correr. Los deploys quedan con un `needs: [verify, e2e]` limpio, sin `always()`, sin `!cancelled()`, sin leer `needs.<job>.result`.

**Costo**: un `checkout` + `npm ci` (~40-60s de runner) en las corridas donde e2e no hacía falta. Como el job es paralelo, el costo en tiempo de pared es **cero**; lo que se paga son minutos de runner en un repo público. Es barato comparado con la clase de bug que evita.

**Alternativa descartada — `needs: [verify, e2e]` con `if: !cancelled() && needs.e2e.result != 'failure'`**: funciona y era la recomendación inicial de la exploración. Se descarta porque `!cancelled()` en un job de deploy es peligrosamente amplio —hay que enumerar a mano qué resultados son aceptables— y porque no resuelve el requisito de paralelismo. La versión elegida hace lo mismo sin condicionales.

**Alternativa descartada — meter e2e como un step más de `verify`**: es lo más simple y viola el criterio de aceptación del roadmap de forma directa. Además mezcla un job de ~2 min con uno que puede tardar ~5.

### Decisión 4: se usa el target `e2e`, no el atomizado `e2e-ci`

El plugin de Playwright infiere los dos:

```
   e2e                        una corrida de playwright, los 3 specs
   e2e-ci                     3 targets (uno por spec) + e2e-ci--merge-reports
```

`e2e-ci` existe para **repartir los specs entre varios agentes** (Nx Agents / Nx Cloud). Este workspace no tiene `nxCloudId` ni token — se podó explícitamente en la Fase 1.1.

La atomización es **por archivo de spec**, no por test: hoy son 3 targets porque hay 3 archivos, y seguirían siendo 3 con 100 tests adentro.

En un solo runner es peor, y la razón concreta está en el ciclo de vida de `webServer`. Cada `e2e-ci--*` es una invocación separada de `playwright test`, y Playwright **da de baja los servidores que levantó** al terminar la corrida. El proceso 2 no puede reusar los del proceso 1: los encuentra muertos y los vuelve a levantar (`reuseExistingServer` no ayuda si no hay nada vivo que reusar).

```
   nx e2e e2e                      nx e2e-ci e2e
   ────────────────                ─────────────────────────
   cargar config                   cargar config       ×3
   levantar web + api   ← una vez  levantar web + api  ×3
   lanzar chromium                 lanzar chromium     ×3
   correr los 3 specs              1 spec cada uno
                                   + merge-reports
```

Como además los tres targets declaran `parallelism: false`, corren en serie: se paga tres veces el arranque sin ganar nada de paralelismo.

**Esto se cruza con la Decisión 2.** Si la orquestación viviera en el YAML —los servidores levantados una vez, fuera de Playwright— la atomización no pagaría ese costo. Al elegir orquestar desde el config, las dos decisiones quedan acopladas. No cambia la conclusión, pero es la razón más concreta de las dos.

Y el caché por spec tampoco compra nada: los tres declaran los mismos `inputs` (`default` = todo `e2e/`), así que cualquier cambio en la carpeta invalida los tres.

El propio metadata de Nx nombra a `e2e` como la salida no atomizada (`nonAtomizedTarget: "e2e"`).

**Elegido**: `npx nx e2e e2e --outputStyle=static`.

**Cuando la suite crezca, la pared no es el arranque — es `workers: 1`.** El arranque se paga una vez; 100 tests en serie a ~5-10s son 10-15 minutos. Las palancas van en este orden:

| Palanca | Qué hace | Costo |
|---|---|---|
| 1. Subir `workers` | Varios contextos de browser contra **el mismo** stack. El preset ya trae `fullyParallel: true`. | Un número en el config. |
| 2. Atomizar + agentes | Varias máquinas, cada una con su propio stack. | Nx Cloud. |

O sea: lo que se multiplica primero son los *workers*, no los *stacks*. Levantar todo de nuevo por cada tanda solo tiene sentido cuando ya no alcanza con una máquina.

**Matiz sobre la palanca 1**: estos tests comparten una DynamoDB y un backend. Cada uno crea su sala con código propio, así que en principio no se pisan — pero los dos tests inestables de `known-issues.md` tienen como hipótesis anotada la contención de recursos. Subir `workers` habría que hacerlo midiendo.

**Revisar si**: aparece Nx Cloud, o la suite pasa de ~10 minutos con `workers` ya subido. Ninguna de las dos es hoy.

### Decisión 5: el test inestable se decide con evidencia, no antes

[known-issues.md](../../../docs/known-issues.md) documenta dos tests que fallan en el mismo punto (`waitForRoomUrl` justo después de `createRoom`):

| Test | Estado | Frecuencia documentada |
|---|---|---|
| `room-moderation.spec.ts:119` — reconexión automática | `test.fixme` | intermitente |
| `room-moderation.spec.ts:158` — participante desconectado | **activo** | ~2 de cada 3 corridas aisladas |

Con `retries: 2` en CI, un 2/3 independiente deja ~30% de corridas rojas. **Un gate que falla 1 de cada 3 veces sin culpa del PR se desactiva solo**: alguien le pone `continue-on-error` en dos semanas y ahí se pierde la señal para siempre.

Pero el diagnóstico se hizo en Windows, con procesos zombie reteniendo los puertos 3001/9229, y una de las hipótesis anotadas es contención de recursos. Un runner limpio de Ubuntu es un entorno distinto.

**Elegido**: correrlo y mirar. Concretamente, tres corridas del job antes de dar el change por cerrado.

- **Si pasa las tres**: queda activo, y se anota en `known-issues.md` que en Linux no se reproduce — que es información nueva y útil para el change que investigue la causa raíz.
- **Si falla alguna**: `test.fixme`, igual que su gemelo, con la corrida enlazada como evidencia. El gate entra con 11 tests y la deuda queda anotada donde ya está su hermana.

**Lo que no es una salida aceptable**: `continue-on-error: true` en el job, ni bajar el gate a "informativo". Un check que no puede poner el PR en rojo no es un check.

## Risks / Trade-offs

**[La recursión de tasks vuelve por `serve-static`]** → Es el supuesto sobre el que se apoya la Decisión 2. Mitigación: es lo primero que se verifica, en local, antes de escribir una línea de YAML. Salida documentada: servir `dist/apps/web/browser` con un comando opaco al plugin.

**[La suite tarda más de lo estimado]** → Con `workers: 1` en CI y 12 tests que abren varios contextos de browser, no hay medición previa. Si se va a ~10 minutos, la palanca es `e2e-ci` con agentes, no aflojar el gate. Se mide en la primera corrida y se anota.

**[Los deploys quedan colgando de un job más]** → `needs: [verify, e2e]` significa que un e2e roto frena prod. Es exactamente lo que se busca, y también significa que un flake frena prod. Es la razón por la que la Decisión 5 no se puede posponer.

**[`npm ci` duplicado desincroniza los dos jobs]** → Ambos parten del mismo lockfile y del mismo commit, así que no. Pero conviene que `node-version` sea el mismo (24) en los dos, para que un problema de runtime aparezca en los dos o en ninguno.

**[DynamoDB Local arranca lento y el primer test falla]** → El contenedor tarda unos segundos en aceptar conexiones, y `create-table` puede correr antes. Mitigación: esperar activamente a que el endpoint responda antes de crear la tabla, no un `sleep`.

## Migration Plan

1. `implicitDependencies` en `e2e`, y confirmar con `nx show projects --affected` que un cambio en `web` ahora lo marca.
2. Modo `ci` en el config de Playwright. **Verificar en local primero** que no hay recursión.
3. Script de reproducción local y corrección de `localhost` → `127.0.0.1`.
4. Job `e2e` en `ci.yml` y `needs:` de los deploys.
5. Verificar en PRs reales: uno que toque solo `docs/` (e2e verde sin correr), uno que toque `apps/web` (e2e corre), y uno con un e2e roto a propósito (PR en rojo y deploys sin ejecutar).
6. Tres corridas para decidir sobre el test inestable.

**Rollback**: revertir el commit. No hay estado persistente; los deploys vuelven a `needs: verify`.

## Open Questions

Ninguna de alcance. Las cinco decisiones están tomadas.

Queda **una incógnita que se resuelve mirando**, no decidiendo: si `nx run web:serve-static` dentro de `webServer.command` dispara la recursión de tasks. Tiene salida documentada en la Decisión 2 y se verifica en local, antes del YAML.

Y queda **un número que no tenemos**: cuánto tarda la suite completa con `workers: 1`. No cambia ninguna decisión de este change; cambia si más adelante hace falta atomizar.
