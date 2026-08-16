# Dependabot agrupado, antes de que la deuda de versiones se vuelva un proyecto

## Why

`package.json` tiene ~90 dependencias entre `dependencies` y `devDependencies`, más el set separado de `apps/mobile/package.json`, y nada las mantiene al día: no hay Dependabot ni Renovate. Hoy actualizar es un evento manual, esporádico y sin registro — exactamente la condición bajo la que, en seis meses, el salto de versiones es tan grande que actualizar se convierte en un proyecto en sí mismo (la advertencia con la que abre la Fase 5 del roadmap).

La app no tiene autenticación por diseño, así que el riesgo no es de robo de credenciales — es de quedar tan atrás en versiones que la próxima actualización real (una CVE, un `nx migrate` que ya no puede saltar tantas versiones de un salto) se vuelve mucho más cara de lo necesario.

## What Changes

- Se agrega `.github/dependabot.yml` con dos entradas del ecosistema `npm`: la raíz del repo y `apps/mobile` (tiene su propio `package.json`/`package-lock.json`, aislado desde la Fase 1.1 porque el executor de Expo corrompe el lockfile si comparte uno con el resto del workspace).
- Los updates se agrupan por familia de paquetes (`aws-sdk`, `eslint`, `testing`, etc.) en vez de un PR por paquete — un PR por paquete a la cadencia que Dependabot maneja por defecto (diaria) es ruido que se termina ignorando.
- Cadencia semanal en las dos entradas, no diaria.
- Angular, Nx y Expo/React Native quedan en sus propios grupos, y esos grupos solo agrupan `minor`/`patch`. Un major de cualquiera de los tres no entra a ningún grupo — sale como PR individual, sin agrupar, señal de que no es un bump mecánico de `package.json` sino que necesita `nx migrate` o `expo upgrade`.
- `target-branch: develop` explícito en las dos entradas: el default branch del repositorio en GitHub es `master`, pero la convención de este repo es que todo el trabajo entra por `develop` (ver `docs/git-branching-strategy.md`). Sin este campo, Dependabot abriría los PRs contra `master`.
- Se agrega una tercera entrada de ecosistema `github-actions` (agrupada, semanal) para las versions de las actions en `.github/workflows/`. No es un criterio de aceptación explícito del roadmap, pero es la misma clase de superficie de supply chain que el resto de la fase, y el costo de agregarla es una entrada más en el mismo archivo.
- No se toca `.github/workflows/ci.yml`: ya corre en `pull_request` desde la Fase 1.1, y Dependabot abre pull requests normales — el gate existente cubre estos PRs sin cambios.

## Capabilities

### New Capabilities

- `dependency-updates`: política de actualización automática de dependencias (ecosistemas cubiertos, agrupación, cadencia, y qué queda excluido del agrupado automático por necesitar migración asistida).

### Modified Capabilities

Ninguna. `continuous-integration` no cambia: este change no modifica qué corre el pipeline ni cuándo, solo agrega una fuente más de pull requests que ya entran por el camino existente.

## Impact

**Configuración nueva**
- `.github/dependabot.yml` — archivo nuevo, no existía ninguna configuración de Dependabot ni Renovate.

**Documentación**
- `docs/hardening-roadmap.md` — cierre de la Fase 5.1 (solo esa subsección, no la tabla de Estado).

**Sin cambios de código de aplicación ni de workflows.** `ci.yml` no se toca — el criterio de aceptación de que el CI de la Fase 1 corra sobre estos PRs se cumple por construcción (dispara en todo `pull_request`), no por un cambio nuevo.

**Fuera de alcance**
- **`npm audit` en CI** (Fase 5.2) — la está trabajando otro change en paralelo.
- **CodeQL y secret scanning** (Fase 5.3) — la está trabajando otro change en paralelo.
- **Auto-merge de los PRs de Dependabot.** El roadmap no lo pide, y con una sola persona manteniendo el repo, revisar semanalmente un puñado de PRs agrupados es manejable sin automatizar el merge.
