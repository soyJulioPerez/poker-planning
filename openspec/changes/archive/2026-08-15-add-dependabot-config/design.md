## Context

Verificado antes de diseñar:

```
$ gh repo view --json defaultBranchRef -q .defaultBranchRef.name
master
```

El branch por defecto en GitHub es `master`, pero la convención de este repo (`docs/git-branching-strategy.md`) es que todo el trabajo entra por `develop`; `master` solo avanza por promoción de un `release/*`. Dependabot abre pull requests contra el branch por defecto si no se le dice lo contrario — sin `target-branch: develop` explícito, cada actualización llegaría contra la rama equivocada.

```
$ grep -n "room-client-runtime\|shared-contracts" package-lock.json
(sin resultados)
```

`packages/room-client-runtime` y `packages/shared-contracts` tienen `package.json` propio pero no están en el lockfile: no hay `workspaces` declarado en el `package.json` raíz, así que son manifests de Nx (resueltos por path de TypeScript), no paquetes npm instalables. No necesitan entrada de Dependabot.

`apps/mobile` sí es distinto: tiene su propio `package.json` **y** `package-lock.json`, separado del raíz a propósito desde la Fase 1.1 — el executor `@nx/expo:build` corrompe el lockfile si comparte uno con el resto del workspace (ver `known-issues.md`). Dependabot resuelve lockfiles por directorio; sin una segunda entrada apuntando a `apps/mobile`, sus dependencias quedarían fuera de cualquier actualización automática.

Inventario de las ~90 dependencias del `package.json` raíz (leído directo, no herramienta): el grueso cae en familias reconocibles — Angular (18 paquetes: `@angular/*`, `@angular-devkit/*`, `@schematics/angular`, `angular-eslint`, `zone.js`), Nx (11: `@nx/*`, `nx`), Expo/React Native (17: `expo*`, `@expo/*`, `react*`, `@react-navigation/*`, `metro-*`, etc.), AWS SDK (6: `@aws-sdk/*`, `@aws-lambda-powertools/*`, `aws-sdk-client-mock`), lint/format (12) y testing (13). El resto (~15) es tooling de build sin familia clara (`@babel/core`, `@swc/*`, `esbuild`, `typescript`, `cross-env`, etc.).

## Goals / Non-Goals

**Goals:**

- Que las actualizaciones lleguen agrupadas por familia, cadencia semanal, contra `develop`.
- Que un major de Angular, Nx o Expo/React Native **nunca** quede escondido dentro de un grupo — tiene que salir como PR individual, visible, porque implica `nx migrate` o `expo upgrade`, no un bump de `package.json`.
- Que el criterio anterior valga también para el ecosistema `apps/mobile`, no solo la raíz.

**Non-Goals:**

- Auto-merge de ningún PR de Dependabot (ver proposal.md, Fuera de alcance).
- `npm audit` en CI (Fase 5.2) y CodeQL/secret scanning (Fase 5.3) — changes en paralelo, no se tocan acá.
- Revisar o migrar versiones ahora. Este change instala el mecanismo; no es una ronda de actualización.

## Decisions

### Decisión 1: Dependabot, no Renovate

El roadmap deja la puerta abierta a Renovate "que agrupa mejor". Evaluado igual: Renovate agrupa con más flexibilidad (presets, agrupación por defecto más agresiva), pero requiere instalar la GitHub App de Renovate (cuenta externa, permisos propios) o correr un runner self-hosted. Dependabot es nativo de GitHub — el repo ya lo tiene disponible sin instalar nada ni dar de alta una cuenta.

Las tres condiciones del roadmap (agrupar, cadencia semanal, excluir majors de Angular/Nx/Expo del agrupado automático) son alcanzables con la sintaxis nativa de Dependabot (`groups`, `schedule.interval`, `update-types`). No hay una capacidad que Renovate tenga y Dependabot no para este caso puntual — la ventaja real de Renovate (presets compartidos entre repos, agrupación semántica más rica) no pesa en un repo de uno.

**Elegido**: Dependabot. Si el volumen de PRs se vuelve inmanejable con Dependabot (por ejemplo, porque `apps/mobile` necesita reglas que la sintaxis nativa no cubre), Renovate queda como opción de escalamiento — no hay lock-in: `.github/dependabot.yml` se borra y no interfiere con nada más.

### Decisión 2: `target-branch: develop` explícito en las dos entradas

Sin este campo, Dependabot usa el branch por defecto del repositorio, que es `master` (verificado arriba). Un PR de Dependabot contra `master` rompería la convención del repo dos veces: entraría sin pasar por `develop`, y además `master` está protegido desde la Fase 1.3 con checks obligatorios pensados para un release ya estabilizado, no para una actualización de dependencias recién propuesta.

**Elegido**: `target-branch: develop` en las dos entradas de `npm` y en la de `github-actions`. Los PRs de Dependabot son pull requests normales — el branch protection de `develop` (Fase 1.3) y el gate de CI (`ci.yml`, dispara en todo `pull_request`) ya se aplican sin configuración adicional.

### Decisión 3: agrupar por familia reconocible, no por "todo junto" ni "un grupo por paquete"

Un grupo único para las ~90 dependencias generaría un solo PR gigante por semana: si un paquete rompe el build, hay que investigar cuál de entre veinte, y revertir el grupo entero descarta actualizaciones sanas junto con la rota. Un PR por paquete es el problema que esta fase vino a resolver (90 PRs sueltos se ignoran).

**Elegido**: siete grupos por entrada `npm`, en este orden (el orden importa — ver Decisión 4):

| Grupo | Qué agrupa | Restricción |
|---|---|---|
| `angular` | `@angular/*`, `@angular-devkit/*`, `@schematics/angular`, `angular-eslint`, `zone.js` | solo `minor`/`patch` |
| `nx` | `@nx/*`, `nx` | solo `minor`/`patch` |
| `expo-react-native` | `expo`, `expo-*`, `@expo/*`, `react`, `react-dom`, `react-native`, `react-native-*`, `@react-navigation/*`, `@testing-library/react-native`, `babel-preset-expo`, `jest-expo`, `metro-*`, `react-test-renderer` | solo `minor`/`patch` |
| `aws-sdk` | `@aws-sdk/*`, `@aws-lambda-powertools/*`, `aws-sdk-client-mock` | sin restricción |
| `lint-and-format` | `eslint*`, `@eslint/*`, `@typescript-eslint/*`, `typescript-eslint`, `prettier`, `jsonc-eslint-parser` | sin restricción |
| `testing` | `jest*`, `@types/jest`, `ts-jest`, `vitest`, `@vitest/*`, `@playwright/*`, `supertest`, `@types/supertest`, `babel-jest` | sin restricción |
| `build-tooling` | `*` (catch-all: `@babel/core`, `@swc/*`, `esbuild`, `typescript`, `cross-env`, `ws`, `rxjs`, `@types/*` sueltos, etc.) | excluye los patrones de `angular`/`nx`/`expo-react-native` (ver Decisión 4) |

Las mismas siete definiciones se repiten en la entrada de `apps/mobile`, aunque hoy `angular`, `aws-sdk` y `lint-and-format` no matcheen nada ahí (`apps/mobile` no tiene Angular ni AWS SDK como dependencia directa). Se prefirió un bloque de grupos idéntico en las dos entradas — copiar y pegar el mismo YAML — a mantener dos variantes que hay que recordar sincronizar cada vez que cambie una familia. Un grupo que nunca matchea no genera ruido: simplemente no aparece.

### Decisión 4: `build-tooling` necesita `exclude-patterns`, no solo ir último

Dependabot evalúa los grupos en el orden del archivo y asigna cada actualización al **primer** grupo cuyas reglas cumpla — `patterns` y, si está, `update-types`. Un major de `@angular/core` no cumple las reglas de `angular` (que pide `minor`/`patch`), así que Dependabot **no lo descarta**: sigue probando los grupos siguientes. Si `build-tooling` fuera `patterns: ["*"]` sin más, ese major terminaría ahí igual — exactamente lo que esta fase quiere evitar, solo que agrupado en vez de suelto, sin ganar nada.

**Elegido**: `build-tooling` lleva `exclude-patterns` con los mismos patrones de `angular`, `nx` y `expo-react-native`. Así, un major de esas tres familias no matchea ningún grupo y sale como PR individual — visible, sin agrupar, tal como pide el criterio de aceptación. Un major de cualquier otra familia (AWS SDK, ESLint, testing, tooling de build) sí puede agruparse, porque no tiene el mismo costo de migración asistida.

### Decisión 5: `open-pull-requests-limit` sube de 5 (default) a 10

Con siete grupos posibles por entrada, más los majors que quedan sueltos, el límite por defecto (5 PRs abiertos simultáneos) podría dejar actualizaciones **calladas** — Dependabot no abre un PR nuevo si ya llegó al límite, y no hay ningún aviso de que algo quedó esperando cola.

**Elegido**: `open-pull-requests-limit: 10` en las dos entradas de `npm`. No es una cota exacta calculada (siete grupos rara vez matchean los siete en la misma semana), es margen para no perder señal en silencio.

### Decisión 6: se agrega una tercera entrada, `github-actions`

No es parte del criterio de aceptación del roadmap, pero es la misma clase de superficie que el resto de la Fase 5: las versiones de `actions/checkout`, `actions/setup-node`, `nrwl/nx-set-shas`, etc. en `.github/workflows/` tampoco se actualizan solas. El costo es una entrada más en el mismo archivo, sin grupos especiales — las actions no tienen el problema de "major = migración asistida" que sí tienen Angular/Nx/Expo, así que van todas en un único grupo semanal.

**Elegido**: incluir. Si en algún momento se decide que es ruido de más, es una entrada de cuatro líneas para borrar, no un cambio de diseño.

## Risks / Trade-offs

**[Un major agrupado en `aws-sdk`, `testing` o `build-tooling` rompe CI]** → Es una consecuencia aceptada de agrupar, no un bug: el PR agrupado corre el mismo `ci.yml` que cualquier otro y queda rojo hasta que se resuelva. Si un paquete puntual demuestra ser demasiado riesgoso para agrupar (rompe seguido), la mitigación es sacarlo a su propio grupo con `update-types: ["minor", "patch"]` — el mismo patrón que ya se usa para Angular/Nx/Expo, aplicado ad hoc cuando la evidencia lo pida, no de antemano para todo.

**[Los grupos de `apps/mobile` no matchean nada durante meses y nadie nota si una familia cambió]** → Aceptado. Revisar `.github/dependabot.yml` cuando se agregue una dependencia nueva a `apps/mobile/package.json` que no encaje en ningún patrón existente es más barato que mantener una tabla de sincronización aparte.

**[`open-pull-requests-limit: 10` genera una semana con muchos PRs simultáneos]** → Es el escenario ancla del roadmap ("90 PRs sueltos se ignoran"), pero acotado: en el peor caso son ~14 PRs (7 grupos × 2 entradas de `npm`, más `github-actions`), no 90, y agrupados por familia siguen siendo revisables de a uno.

## Migration Plan

1. Crear `.github/dependabot.yml` con las tres entradas (`npm` raíz, `npm` `/apps/mobile`, `github-actions`).
2. Verificar sintaxis: GitHub valida `dependabot.yml` al hacer push y lo expone en Settings → Code security → Dependabot; revisar ahí que las tres entradas aparecen sin error de parseo.
3. No hace falta migrar nada existente — no había Dependabot ni Renovate configurado antes.

**Rollback**: borrar `.github/dependabot.yml`. Sin estado que limpiar — los PRs ya abiertos quedan como PRs normales (se pueden cerrar a mano), pero Dependabot deja de abrir nuevos.

## Open Questions

Ninguna de alcance. Quedan fuera, ya cubiertas en la proposal: auto-merge (no se hace), y la posibilidad de escalar a Renovate si el volumen lo justifica (Decisión 1).
