## Why

`npm run dev:api` (el flujo documentado en `docs/local-dev-workflow.md` para probar el backend localmente) falla con `Cannot find module 'shared-contracts'` apenas se importa algo de ese paquete. El comando usa `tsx watch` sobre `apps/realtime-api/src/dev-server.ts`, una herramienta que no forma parte del stack de build de Nx y no resuelve el path mapping `shared-contracts` definido en `tsconfig.base.json` de la misma forma que sí lo resuelve Nx (vía `@nx/esbuild`, que compila el import a una ruta relativa real antes de ejecutar). El resultado es que hoy no hay forma de correr el backend local para probar cambios manualmente sin desplegar a AWS, lo cual ya causó una verificación incompleta en un change reciente (`tshirt-numeric-resolution`, ver `docs/future-ideas.md`).

## What Changes

- El target `main.ts` de `realtime-api` (hoy un placeholder `console.log('Hello World')`, generado por el scaffold de Nx y sin uso real) pasa a arrancar el servidor WebSocket de desarrollo (hoy vive en `dev-server.ts`), de modo que `nx serve realtime-api` levante ese servidor usando el executor nativo de Nx (`@nx/esbuild` + `@nx/js:node`), sin depender de `tsx`.
- `npm run dev:api` se actualiza para invocar `nx serve realtime-api` en vez de `tsx watch apps/realtime-api/src/dev-server.ts`, preservando el mismo comando de cara al usuario y el mismo comportamiento (mismo puerto `3001`, mismas variables de entorno para DynamoDB Local).
- `docs/local-dev-workflow.md` se actualiza para reflejar que el backend local corre ahora vía Nx.
- Se elimina la dependencia de `tsx` para este flujo (queda sin uso salvo que algo más del repo lo requiera).

## Capabilities

### New Capabilities
(ninguna — este cambio es tooling de desarrollo local, no agrega comportamiento observable de la aplicación)

### Modified Capabilities
(ninguna — no hay requirement de dominio afectado; no se toca ningún archivo bajo `openspec/specs/`)

## Impact

- `apps/realtime-api/src/main.ts`: pasa de placeholder a punto de entrada real del servidor de desarrollo.
- `apps/realtime-api/project.json`: sin cambios estructurales esperados en el target `serve` (ya usa el executor correcto); se confirma en `design.md` si hace falta ajustar variables de entorno (`DYNAMODB_ENDPOINT`, `AWS_REGION`, `TABLE_NAME`) que hoy pasa `cross-env` en el script de `package.json`.
- `package.json` (raíz): script `dev:api` actualizado.
- `docs/local-dev-workflow.md`: pasos actualizados.
- **No afecta** el despliegue a AWS (`infra/template.yaml`, `sam build`/`sam deploy`) — ese flujo compila directamente `apps/realtime-api/src/handlers/*.ts` con esbuild propio de SAM, sin relación con `main.ts` ni con los targets de Nx de `realtime-api`. Confirmado revisando `infra/template.yaml`: ningún recurso referencia `main.ts` ni el target `serve`.
- No afecta `apps/web` ni ningún componente de UI.
