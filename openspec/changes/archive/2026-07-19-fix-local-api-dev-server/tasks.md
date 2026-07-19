## 1. Entry point del servidor de desarrollo

- [x] 1.1 Mover el contenido de `apps/realtime-api/src/dev-server.ts` a `apps/realtime-api/src/main.ts` (o dejar `dev-server.ts` como módulo separado e importarlo desde `main.ts` — decidir al implementar, ver Open Question en `design.md`) — decidido: contenido movido íntegro a `main.ts`, `dev-server.ts` eliminado
- [x] 1.2 Confirmar que `apps/realtime-api/project.json` (target `serve`) no requiere cambios: ya usa `@nx/esbuild:esbuild` + `@nx/js:node` sobre `main.ts`

## 2. Script npm

- [x] 2.1 Actualizar el script `dev:api` en `package.json` (raíz) para invocar `cross-env ... nx serve realtime-api` en vez de `cross-env ... tsx watch apps/realtime-api/src/dev-server.ts`, preservando las mismas variables de entorno (`DYNAMODB_ENDPOINT`, `AWS_REGION`, `TABLE_NAME`)
- [x] 2.2 Revisar si `tsx` queda sin ningún otro consumidor en el repo; si es así, quitarlo de `devDependencies` — confirmado sin otros consumidores, removido y `npm install` corrido para actualizar `package-lock.json`

## 3. Documentación

- [x] 3.1 Actualizar `docs/local-dev-workflow.md` para reflejar que `npm run dev:api` corre ahora vía Nx (sin cambiar los pasos de cara al usuario: mismo comando, mismo puerto)

## 4. Verificación manual

- [x] 4.1 Levantar DynamoDB Local (`npm run dev:db:up` o `docker start dynamodb-local`) y confirmar/crear la tabla (`npm run dev:db:create-table`)
- [x] 4.2 Correr `npm run dev:api` y confirmar que arranca sin el error `Cannot find module 'shared-contracts'`, mostrando el mensaje `Local WebSocket dev server listening on ws://localhost:3001` — confirmado, arranca sin error tras el build de Nx
- [x] 4.3 Con `npm start` (frontend) apuntando a `ws://localhost:3001` (descomentar esa línea en `room-socket.service.ts` temporalmente para la prueba), crear una sala, unirse con un segundo participante, votar, revelar y resolver una historia — confirmar que el flujo completo funciona igual que contra AWS — verificado con Playwright: sala creada, confirmada en DynamoDB Local (prueba definitiva de que corrió contra el backend local), voto/revelado/resolución completos
- [x] 4.4 Confirmar que guardar un cambio en un archivo de `apps/realtime-api/src/` dispara rebuild + restart automático (watch mode de `@nx/js:node`) — confirmado: nuevo Debugger ID en el log tras editar `main.ts`
- [x] 4.5 Confirmar que `nx build realtime-api` y el despliegue a AWS (`sam build`) siguen funcionando sin cambios — no deberían verse afectados por este change — ambos confirmados exitosos (`Successfully ran target build`, `Build Succeeded`)
- [x] 4.6 Repetir la verificación manual pendiente de `tshirt-numeric-resolution` (tareas 5.1-5.5 de ese change archivado) contra el backend local, ya que en su momento solo se pudo verificar contra AWS — verificado: mazo T-Shirt Sizes, voto "M", "Aceptar promedio (M)"/"Aceptar moda (M)" mostrados correctamente, historia resuelta con "M pts" (no número crudo)
