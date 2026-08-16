## Why

El árbol de dependencias del repo (~90 devDependencies, más las de runtime) no se audita nunca en CI. Una vulnerabilidad conocida puede vivir meses sin que nadie se entere, porque enterarse depende hoy de que alguien corra `npm audit` a mano. Fase 5.2 del [hardening roadmap](../../../docs/hardening-roadmap.md).

## What Changes

- Job nuevo `dependency-audit` en `ci.yml`, en paralelo a `verify`/`test-integration`/`e2e` (mismo patrón que estableció la Fase 2.2 con `test-integration`: job nuevo, no anidado). Corre `npm audit --audit-level=critical` contra el único `package-lock.json` de la raíz.
- **Umbral de severidad definido explícitamente**: `critical` rompe el job. `high`, `moderate` y `low` quedan visibles en el log —`npm audit` los imprime siempre, el flag solo decide el exit code— pero no fallan la tarea. Ver `design.md` para los números que sustentan la elección: hoy hay 0 `critical` y 48 `high`, y los 48 son enteramente herramientas de build (Angular CLI, Nx, Expo CLI, Vite, Metro), no código de runtime.
- `dependency-audit` pasa a ser parte de `needs:` de `deploy-backend` y `deploy-web`, mismo criterio que ya aplica `test-integration`: nada se despliega si la auditoría encontró algo crítico.
- `docs/ci-pipeline.md` se actualiza con el job nuevo, para que el mapa del pipeline no quede desactualizado apenas se mergee esto.

**Fuera de alcance**: `apps/mobile` tiene su propio `package-lock.json`, separado del de la raíz. No se audita en este change — mismo criterio que la Fase 1.1 ya aplicó para excluir el build de mobile del gate (invoca un servicio externo, vive en un flujo aparte).

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `continuous-integration`: se agrega el requisito de que la cadena de dependencias se audite automáticamente en cada verificación, con un umbral de severidad explícito que decide qué rompe el pipeline y qué queda como aviso.

## Impact

- `.github/workflows/ci.yml`: nuevo job `dependency-audit`; `deploy-backend` y `deploy-web` ganan una entrada más en `needs:`.
- `docs/ci-pipeline.md`: fila nueva en la tabla de jobs y diagrama actualizado.
- `docs/hardening-roadmap.md`: cierre de la Fase 5.2.
- Sin cambios en código de aplicación (`apps/`, `packages/`).
