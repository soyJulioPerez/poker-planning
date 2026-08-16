## Why

`git tag v1.5.0` es la única forma en que este repo registra una versión — sin changelog, sin relación automática entre lo que corre en `prod` y un nombre legible de lo que cambió. Si `prod` se rompe, no hay respuesta rápida a "¿qué cambió?" más allá de leer el diff entero entre dos tags a mano. `nx release` está disponible en el workspace pero sin configurar (el bloque `release` de `nx.json` se eliminó por completo en la Fase 3.2, a propósito, hasta tener el diseño real).

## What Changes

- `nx.json` gana un bloque `release` mínimo: relación `fixed` (un solo número de versión para todo el repo, no por proyecto — ya decidido en la Fase 3.2), resolución de versión actual vía `git-tag` (no vía `package.json`, que en este repo no significa nada — queda en `0.0.0` para siempre, sin tocarlo).
- El paso 4 de `git-branching-strategy.md` ("Promoción a `master`") cambia: en vez de un `git tag v1.5.0` tipeado a mano, `nx release version` computa el próximo número de versión a partir de los tipos de commit desde el último tag (`feat`/`fix`/`BREAKING CHANGE`), y crea+empuja el tag — mismo momento del flujo, mismo mecanismo de push (los tags no están sujetos a branch protection).
- Un `CHANGELOG.md` nuevo en la raíz, generado con `nx release changelog --from <último-tag> --to develop` — acotado a `develop`, no a `master`, para no arrastrar los commits directos de estabilización de `release/*` (sin formato, no pasan por PR). El commit que agrega la entrada nueva se hace **dentro de la rama `release/*`**, antes de abrir el PR a `master` — así entra por el mismo gate de verificación que cualquier otro cambio a `master`, sin necesitar una excepción a la protección de rama.
- Un job nuevo en `ci.yml` que verifica que el **título del PR** siga Conventional Commits (no los commits individuales de la rama, que se descartan en el squash merge) — bloquea el merge si no cumple. Es upstream de este mismo change: si el título no tiene el formato correcto, el changelog generado desde `develop` sale mal.
- `deploy-backend.yml`/`deploy-web.yml` (o el resumen del run) muestran qué versión se desplegó, no solo el SHA del commit.

## Capabilities

### New Capabilities

- `release-versioning`: cómo el repo determina el próximo número de versión, genera su changelog y lo taggea, a partir de Conventional Commits.

### Modified Capabilities

- `continuous-integration`: nuevo requirement — el título de todo pull request contra `develop` o `master` SHALL seguir el formato de Conventional Commits, verificado en CI, bloqueante para el merge.

## Impact

- `nx.json` (bloque `release` nuevo)
- `.github/workflows/ci.yml` (job nuevo de lint del título del PR)
- `.github/workflows/deploy-backend.yml`, `.github/workflows/deploy-web.yml` (resumen del run con la versión desplegada)
- `docs/git-branching-strategy.md` (paso 4 corregido para reflejar el nuevo mecanismo)
- `docs/hardening-roadmap.md` (cierre de la Fase 7.1)
- `CHANGELOG.md` (nuevo, en la raíz)
- `packages/room-client-runtime/package.json`, `packages/shared-contracts/package.json`: su campo `version` pasa a actualizarse automáticamente en cada release (ver `design.md`, Decisión 4b) — son los únicos dos `package.json` del workspace
- No afecta código de aplicación (`apps/realtime-api`, `apps/web`, `apps/mobile` no tienen `package.json`, quedan sin cambios)
