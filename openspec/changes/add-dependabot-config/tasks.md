# Tareas — Dependabot agrupado

## 1. Punto de partida

- [x] 1.1 Confirmar que no hay Dependabot ni Renovate configurado hoy: `ls .github/dependabot.yml` no debe existir, y `gh api repos/:owner/:repo/vulnerability-alerts` (o revisar Settings → Code security) no debe mostrar Dependabot activo.
- [x] 1.2 Confirmar el branch por defecto del repositorio: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` (debe dar `master`, no `develop` — es la razón de la Decisión 2 del `design.md`).
- [x] 1.3 Confirmar que `apps/mobile` tiene lockfile propio, separado del raíz: `ls apps/mobile/package-lock.json`.
- [x] 1.4 Confirmar que `packages/room-client-runtime` y `packages/shared-contracts` no están en el lockfile raíz (no son paquetes npm instalables, no necesitan entrada propia): `grep -n "room-client-runtime\|shared-contracts" package-lock.json` no debe dar resultados.

## 2. `.github/dependabot.yml`

- [x] 2.1 Crear el archivo con `version: 2` y la entrada `npm` para la raíz (`directory: "/"`), `schedule.interval: weekly`, `target-branch: develop`, `open-pull-requests-limit: 10`.
- [x] 2.2 Agregar los siete grupos de la entrada raíz, en el orden de la tabla del `design.md` (Decisión 3): `angular`, `nx`, `expo-react-native` con `update-types: ["minor", "patch"]`; `aws-sdk`, `lint-and-format`, `testing` sin restricción; `build-tooling` como catch-all (`patterns: ["*"]`) con `exclude-patterns` repitiendo los patrones de `angular`, `nx` y `expo-react-native` (Decisión 4 — sin esto, un major de esas tres familias se cuela igual por el catch-all).
- [x] 2.3 Agregar la segunda entrada `npm` para `apps/mobile` (`directory: "/apps/mobile"`), mismo `schedule`, `target-branch` y `open-pull-requests-limit`, y el mismo bloque de siete grupos (Decisión 3 — coherencia entre entradas, aunque algunos grupos no matcheen nada ahí hoy).
- [x] 2.4 Agregar la tercera entrada, ecosistema `github-actions` (`directory: "/"`), `schedule.interval: weekly`, `target-branch: develop`, con un único grupo que agrupe todas las actions (Decisión 6).

## 3. Verificación de la configuración

- [x] 3.1 Pushear el archivo y confirmar en GitHub (Settings → Code security → Dependabot, o `gh api repos/:owner/:repo/dependabot/... `) que las tres entradas se parsearon sin error de sintaxis.
- [x] 3.2 Repasar a mano, familia por familia, que cada paquete listado en el inventario del `design.md` (Angular, Nx, Expo/React Native, AWS SDK, lint/testing, y el resto) cae en el grupo esperado — en particular que ningún paquete de `apps/mobile/package.json` queda fuera de los siete grupos sin razón.
- [x] 3.3 **Verificación activa de la Decisión 4**: confirmar con la documentación de Dependabot (o, si está disponible, forzando una corrida) que un dependency con `update-type: major` y patrón matcheado por `angular`/`nx`/`expo-react-native` efectivamente no cae en `build-tooling` gracias al `exclude-patterns`. Si el mecanismo no se puede probar en vivo antes del primer ciclo semanal real, dejarlo anotado como verificación pendiente en `known-issues.md`, no asumirlo sin más. → No se pudo probar en vivo (Dependabot no tiene dry-run); anotado en `known-issues.md` como verificación pendiente para el primer major real que aparezca.

## 4. Cierre

- [x] 4.1 Confirmar el criterio de aceptación del roadmap contra el archivo final: agrupado por familia ✓, cadencia semanal (no diaria) ✓, `target-branch: develop` ✓, Angular/Nx/Expo excluidos del agrupado de majors ✓.
- [x] 4.2 Confirmar que no se tocó `.github/workflows/ci.yml` — el gate de la Fase 1 cubre estos PRs sin cambios porque dispara en todo `pull_request` (verificación conceptual, no requiere una corrida real: el primer PR de Dependabot la va a confirmar en la práctica cuando aparezca).
- [x] 4.3 `docs/hardening-roadmap.md`: cerrar la Fase 5.1 (solo esa subsección) con el bloque `> **Hecha** el 2026-08-15, change \`add-dependabot-config\`. ...`, siguiendo el formato de las fases ya cerradas, y marcar los tres checkboxes del criterio de aceptación. No tocar la tabla "Estado" ni ninguna otra subsección de la Fase 5.
