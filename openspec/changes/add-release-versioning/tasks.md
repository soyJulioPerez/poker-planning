## 1. Configuración de `nx release`

- [x] 1.1 Agregar el bloque `release` a `nx.json`: `projectsRelationship: "fixed"`, `projects: ["room-client-runtime", "shared-contracts"]`, `version.conventionalCommits: true`, `version.manifestRootsToUpdate: []` — ver `design.md`, Decisión 4. (Corregido: `currentVersionResolver: "git-tag"` explícito choca con `conventionalCommits: true` — este último ya lo implica.)
- [x] 1.2 `npx nx release version --dry-run` contra el estado actual: confirmar el alcance real de qué archivos toca. → Sin `conventionalCommits: true` pregunta interactivamente el tipo de bump (no infiere solo). Con `conventionalCommits: true`, infiere bien (1.4.1 → minor → 1.5.0) pero **sí** escribe `packages/room-client-runtime/package.json` y `packages/shared-contracts/package.json` a pesar de `manifestRootsToUpdate: []` — aceptado a propósito, ver `design.md` Decisión 4b. Ningún otro archivo se toca.
- [x] 1.3 `npx nx release changelog <versión-de-prueba> --from <último-tag> --to origin/develop --dry-run`: confirmar que el changelog generado agrupa por tipo (`feat`/`fix`) y excluye `docs`/`ci`/`chore`/`test`. → Confirmado en el explore previo (ver `design.md`, Decisión 3): salida real con secciones "🚀 Features"/"🩹 Fixes", sin entradas `docs`/`ci`.

## 2. Lint del título del PR

- [x] 2.1 Actualizar `specs/continuous-integration/spec.md` de este change con la gramática exacta a exigir: los 11 tipos estándar de Conventional Commits (`build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test` — el repo ya usa 6 de esos 11: `docs`/`feat`/`fix`/`test`/`chore`/`ci`, verificado contra `git log`), scope opcional (nunca usado hasta ahora, no se exige), `!` de breaking change opcional (tampoco usado). Sin esto explícito, "sigue Conventional Commits" es ambiguo para quien implemente el check.
- [x] 2.2 Agregar un job nuevo a `.github/workflows/ci.yml` que valide `github.event.pull_request.title` contra la gramática de 2.1 (evaluar `amannn/action-semantic-pull-request` u equivalente) — corre solo en el evento `pull_request`, no en push. → job `pr-title`, `amannn/action-semantic-pull-request@v6`, `types` explícitos (verificado contra la doc real de la action, no supuesto), YAML validado con `js-yaml`.
- [ ] 2.3 El job SHALL bloquear el merge si el título no cumple — agregarlo a los checks obligatorios de branch protection en `develop` y `master` (mismo mecanismo que `verify`/`e2e`, Fase 1.3).
- [ ] 2.4 Verificar en un PR real (este mismo change) que el check aparece y pasa con un título bien formado.

## 3. Changelog dentro de la rama de release

- [x] 3.1 Documentar en `docs/git-branching-strategy.md` el paso nuevo — **corregido durante la implementación**: no va en el paso 4 ("antes de abrir el PR"), va en el **paso 2** ("Cortar un release"), inmediatamente después de `git checkout -b release/x.y.z develop` y antes de cualquier commit de estabilización — si se corriera más tarde, ya arrastraría los commits sucios de QA que esto busca evitar (ver `design.md`, Decisión 3, sección "Momento exacto"). Comando: `npx nx release --skip-publish --git-tag=false` (versión + `CHANGELOG.md` + commit, todo con el mismo número — probado en vivo) y luego push. `--git-tag=false` porque el comando combinado taggea de una por default, y acá el tag todavía no corresponde (recién después del merge, paso 4).
- [x] 3.2 El `git tag vX.Y.Z` del mismo paso, **después** de que el PR se mergeó, queda tal cual está hoy — plano, manual o scripteado, apuntando al merge commit. No usar `nx release version` de nuevo en este punto: ya se computó y comiteó la versión en 3.1, volver a correrlo intentaría recomputar desde cero y podría fallar o desalinearse. El tag sigue sin pasar por branch protection (Decisión 1).
- [x] 3.3 Confirmar que el `package.json` que sí se toca (`room-client-runtime`, `shared-contracts` — ver Decisión 4b) queda incluido en el mismo commit que `CHANGELOG.md`, dentro de la rama `release/*`, y no como un commit aparte fuera del gate de verificación. → Confirmado con `--dry-run`: `nx release --skip-publish --git-tag=false` hace un único "Committing changes with git" que incluye ambos `package.json` y `CHANGELOG.md` juntos.

## 4. Versión visible en el deploy

- [x] 4.1 Agregar un paso a `deploy-backend.yml` y a `deploy-web.yml` que escriba el tag desplegado (`git describe --tags` sobre el commit, o el input `ref` en el caso de un deploy manual) a `$GITHUB_STEP_SUMMARY`. → **Corregido de alcance**: el plan original solo mencionaba esos dos, pero el deploy automático real vive en los jobs `deploy-backend`/`deploy-web` de `ci.yml` (los workflows standalone son el camino manual/rollback). Se agregó a los 4 lugares. `--always` en `git describe` porque el job automático de `ci.yml` corre en el mismo push que trae el merge commit, y el tag del release se crea a mano *después* — puede no existir todavía en ese momento.
- [ ] 4.2 Verificar en un run real que el resumen del run muestra la versión sin tener que abrir los logs. **Pendiente a propósito**: forzar esto ahora significaría disparar un deploy real (a `dev`/`qa`/`prod`, con credenciales de AWS reales) solo para probar una línea de resumen — no se hizo sin permiso explícito. Se confirma naturalmente en el próximo deploy real, automático o manual.

## 5. Documentación

- [x] 5.1 `docs/hardening-roadmap.md`: cerrar la subsección 7.1, marcar sus checkboxes, agregar el bloque `> **Hecha** el <fecha>, change \`add-release-versioning\`. ...` con lo que quedó distinto (mismo estilo que las fases ya cerradas). También se corrigió "El problema"/"Qué hacer" (decían "no hay tags" y "ya está parcialmente configurado", ambos desactualizados).
- [x] 5.2 `docs/hardening-roadmap.md`: actualizar la fila de la Fase 7 en la tabla "Estado" (hoy "🟡 7.3 hecha · 7.1 y 7.2 pendientes") para reflejar 7.1 hecha.

## 6. Verificación local

- [x] 6.1 `npx nx affected -t lint test build --base=develop` para confirmar que no se rompió nada fuera de configuración/CI. → Corrió los 6 proyectos del workspace (esperable: `nx.json` es config global, cualquier cambio ahí marca todo como afectado) — verde, `Successfully ran targets lint, test, build for 6 projects`.
- [x] 6.2 `openspec validate --specs --strict` para confirmar que las specs nuevas/modificadas quedan bien formadas tras el sync. → 17/17 specs principales en verde (esto valida el estado actual del repo; el sync real de las deltas de este change ocurre recién al archivar).

## 7. Pull request

- [ ] 7.1 `git fetch origin && git rebase origin/develop` antes de abrir el PR.
- [ ] 7.2 Abrir PR contra `develop` con `gh pr create`, mensaje en Conventional Commits — este mismo título es, de hecho, el primer título que el check de la sección 2 va a verificar.
