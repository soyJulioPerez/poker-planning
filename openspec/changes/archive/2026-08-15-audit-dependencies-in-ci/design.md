## Context

`npm audit` nunca corrió en CI. Lo único que hay hoy es lo que cada quien corra a mano, cuando se acuerde. El roadmap (Fase 5.2) pide un job que audite, pero avisa de la trampa explícitamente: *"`npm audit` sobre devDependencies genera mucho falso positivo... si rompe el build por todo, en dos semanas alguien le pone `|| true` — y ahí se pierde la señal para siempre."*

Antes de escribir el job se corrió `npm audit --json` contra la raíz del repo, estado real verificado el 2026-08-15:

| Severidad | Cantidad |
|---|---|
| `critical` | 0 |
| `high` | 48 |
| `moderate` | 13 |
| `low` | 2 |
| **Total** | **63** |

Los 48 `high` son, sin excepción, herramientas de build/CLI: `@angular-devkit/build-angular`, `@angular/build`, `@angular/cli` y el resto de paquetes de Angular, `nx` y prácticamente todos sus plugins (`@nx/angular`, `@nx/esbuild`, `@nx/eslint`, `@nx/expo`, `@nx/jest`, `@nx/js`, `@nx/playwright`, `@nx/web`, `@nx/workspace`, entre otros), `@expo/cli`, `metro`/`metro-config`, `vite` (vía `@angular-devkit/build-angular`), y transitivas de esas (`axios`, `postcss`, `nanoid`, `brace-expansion`, `http-proxy-middleware`, `undici`). Ninguna vive en código que corre en runtime — ni en las Lambdas de `realtime-api`, ni en el bundle servido de `web`.

Se probó acotar con `--omit=dev` (el reemplazo de `--production`, que `npm` tiene deprecado) para ver si alcanzaba con la sugerencia del roadmap:

```
$ npm audit --audit-level=high            → exit 1, 63 vulnerabilidades (48 high)
$ npm audit --omit=dev --audit-level=high → exit 1, 40 vulnerabilidades (27 high)
$ npm audit --audit-level=critical        → exit 0, 0 critical
```

`--omit=dev` reduce el conteo pero **no resuelve el problema**: 27 `high` siguen rompiendo el job. La causa es estructural, no un detalle de esta corrida — `package.json` de la raíz no separa build tooling de dependencias de runtime de forma limpia. `@angular-devkit/build-angular`, `expo`, `react-native`, `@nx/expo`, entre otros, están listados bajo `"dependencies"`, no `"devDependencies"` (así quedaron generados por las herramientas de Nx/Angular/Expo). Con esa mezcla, `--omit=dev` no separa "herramienta de build" de "código de runtime": separa según una clasificación que en este `package.json` no coincide con esa distinción.

## Goals / Non-Goals

**Goals:**
- Un job de CI que audite la cadena de dependencias en cada verificación, en paralelo al resto (mismo patrón que `test-integration` de la Fase 2.2).
- Umbral de severidad **explícito y documentado**: qué rompe el job, qué queda como aviso, y por qué — no un número elegido a ciegas.
- Que el job nazca en verde. Uno que nace en rojo por hallazgos que nadie puede resolver esta semana es exactamente el camino hacia el `|| true` que el roadmap pide evitar.
- Que una vulnerabilidad crítica real bloquee el deploy, no solo quede logueada.

**Non-Goals:**
- **Resolver los 48 `high` existentes.** Son, en su mayoría, majors pendientes de Angular/Nx/Expo — la Fase 5.1 (Dependabot) ya los trata aparte de las actualizaciones automáticas porque necesitan `nx migrate`/`expo upgrade`, no un bump de `package.json`. Resolverlos es trabajo de actualización, no de este change.
- **Auditar `apps/mobile`.** Tiene su propio `package-lock.json`, separado del de la raíz. Mismo criterio que la Fase 1.1 usó para sacar el build de mobile del gate de `nx affected` (invoca un servicio externo, vive en su propio flujo — `build-mobile.yml`). Queda anotado como trabajo futuro, no como parte de esta fase.
- **Excepciones por paquete** (`.nsprc`, `audit-ci` con allowlist, etc.). Añaden una superficie de configuración nueva para un problema que el umbral por severidad ya resuelve sin herramientas adicionales.

## Decisions

### 1. El umbral que rompe el build es `critical`, no `high`

Es la decisión central del change. El roadmap escribe el comando de ejemplo como `npm audit --audit-level=high`, pero también da la instrucción de fondo: *"si el ruido es un problema real, la solución es acotar el `--audit-level` o el alcance (`--production`), no silenciar el exit code."*

Ya con los números de arriba: acotar el *alcance* (`--omit=dev`) no alcanza en este repo. Queda la otra mitad de esa misma instrucción: acotar el **`--audit-level`**.

**Elegido**: `npm audit --audit-level=critical`. Hoy pasa limpio (0 `critical`). `high`, `moderate` y `low` siguen visibles en el log del job —`npm audit` imprime todo lo que encuentra sin importar el flag, que solo decide el exit code— pero no lo rompen.

**Alternativas consideradas**:
- **`--audit-level=high` tal cual sugiere el roadmap**: descartada. Rompería el job desde el primer commit, por 48 hallazgos que hoy nadie puede resolver sin migrar Angular, Nx y Expo a la vez. Un check que nace rojo y se queda así indefinidamente dura, en la experiencia de este mismo repo con otras señales, poco: es la definición operativa de la trampa que el roadmap nombra.
- **`--omit=dev --audit-level=high`**: descartada por lo mismo que la sección anterior — sigue en rojo (27 `high`), no por ruido real sino por cómo está clasificado este `package.json`.
- **Allowlist de vulnerabilidades conocidas** (`audit-ci` u otra herramienta con exclusiones por ID): descartada como Non-Goal. Cada `high` nuevo obligaría a decidir "¿lo excluyo o lo resuelvo?" a mano, y una lista de exclusiones que solo crece es la misma pérdida de señal que un `|| true`, con más pasos.

**Por qué es defendible y no un "bajar la vara para que pase"**: los 48 `high` de hoy están, verificadamente, en herramientas de build — la misma distinción que el propio roadmap usa para justificar acotar el audit ("una vulnerabilidad en una herramienta de build no es la misma que una en runtime"). `critical` es el nivel en el que esa distinción deja de importar: una vulnerabilidad crítica en cualquier paquete de la cadena —build tooling incluido— es la clase de hallazgo que sí amerita frenar el pipeline sin esperar a evaluarlo caso por caso.

### 2. Un solo comando, no un paso que audita y otro que solo reporta

`npm audit` imprime el detalle completo de cada hallazgo (paquete, severidad, advisory) sin importar `--audit-level` — ese flag únicamente decide el exit code. Alcanza entonces con un solo `run: npm audit --audit-level=critical`: la salida completa (incluidos los 48 `high` de hoy) queda en el log del job para quien quiera revisarla, sin necesidad de un segundo comando, un `--json` parseado a mano, ni un paso separado "solo para mostrar".

**Alternativa descartada**: dos pasos, uno con `--audit-level=critical` (bloqueante) y otro con `npm audit` sin flags marcado `continue-on-error: true` (informativo). Es la misma información duplicada dos veces — un comando ya la imprime toda.

### 3. Sin `nx affected`: el job audita todo el árbol, siempre

`verify`, `test-integration` y `e2e` acotan su trabajo a los proyectos que el cambio afecta. `dependency-audit` no sigue ese patrón a propósito: una vulnerabilidad de la cadena de dependencias no es "afectada" por qué archivo tocó el PR — vive en el árbol instalado completo (`package-lock.json`), que es el mismo sin importar si el diff tocó `apps/web` o `docs/`. Acotar esto por `nx affected` no tendría con qué comparar: no hay un "proyecto" al que atribuirle una vulnerabilidad de una dependencia transitiva compartida.

Consecuencia práctica: el job no necesita `fetch-depth: 0` ni `nrwl/nx-set-shas@v5` — no calcula ningún alcance, solo `checkout` (shallow, el default), `setup-node`, `npm ci` y el `npm audit`.

### 4. El job gatea `deploy-backend` y `deploy-web`

Se agrega `dependency-audit` a `needs:` de los dos jobs de deploy, mismo criterio que `test-integration` ya estableció en la Fase 2.2. Una vulnerabilidad `critical` real en la cadena de dependencias es exactamente el tipo de hallazgo que no debería desplegarse — no tiene sentido que gatee el merge (ver más abajo) pero no el deploy.

No se agrega a los checks obligatorios de branch protection (`verify` y `e2e`, fijados en la Fase 1.3). Igual que los jobs de deploy quedan fuera de esa lista por diseño (ver el change `enable-branch-protection`), exigir un tercer check ahí es una decisión de gobernanza aparte, fuera del alcance de esta fase — se puede sumar después sin volver a tocar este job.

## Risks / Trade-offs

- **[Un `critical` real en devDependencies no bloquea el merge, solo el deploy]** → Es la contracara de la Decisión 4: el job no es un check obligatorio de branch protection. Mitigado porque sí bloquea el deploy automático, que es donde importa que no llegue código con una dependencia comprometida a producción; un merge a `develop` con un `critical` sin resolver deja el job en rojo, visible, aunque no bloqueado.
- **[El umbral `critical` es más laxo que lo que el roadmap escribió como ejemplo (`high`)]** → Documentado exhaustivamente en la Decisión 1, con los números que lo sustentan. Si en el futuro Angular/Nx/Expo migran de mayor y el conteo de `high` baja a algo accionable, subir el umbral es un cambio de una palabra en el `run:` — no hace falta rediseñar el job.
- **[`apps/mobile` queda sin auditar]** → Aceptado como Non-Goal, mismo criterio que ya excluye su build del gate de `nx affected`. Su superficie de dependencias además se solapa en buena parte con la de la raíz (`expo`, `react-native`, `@react-navigation/*` están en ambos `package.json`), así que no queda completamente ciego — sí queda sin auditar lo que sea exclusivo de `apps/mobile/package-lock.json`.
- **[La cifra "0 critical" es del 2026-08-15 y puede cambiar antes de mergear]** → Se vuelve a correr `npm audit` como parte de la verificación local (ver `tasks.md`) inmediatamente antes de abrir el PR, para confirmar que el job nace en verde con el estado real del árbol en ese momento.

## Migration Plan

1. Agregar el job `dependency-audit` a `.github/workflows/ci.yml`, en paralelo a `verify`/`test-integration`/`e2e`.
2. Sumar `dependency-audit` a `needs:` de `deploy-backend` y `deploy-web`.
3. Correr `npm audit --audit-level=critical` en local para confirmar que pasa antes de pushear.
4. Actualizar `docs/ci-pipeline.md` (tabla de jobs y diagrama) y `docs/hardening-roadmap.md` (cierre de la Fase 5.2).
5. Abrir PR contra `develop`; confirmar en la corrida real de GitHub Actions que el job aparece, corre en paralelo y termina en verde.

Sin plan de rollback especial: es un job nuevo que no reemplaza ni modifica ninguno existente — revertir el commit lo saca limpio.

## Open Questions

Ninguna abierta. Queda anotado como trabajo futuro, no como pregunta pendiente: auditar `apps/mobile/package-lock.json` por separado, y subir el umbral de `critical` a `high` cuando el conteo de `high` en herramientas de build baje a algo accionable (post-migración de Angular/Nx/Expo).
