# Cómo levantar el entorno de desarrollo local y probar manualmente

Guía paso a paso para correr la app completa (frontend Angular + backend WebSocket + DynamoDB) en tu máquina, sin desplegar nada a AWS. Pensada para poder hacer pruebas manuales en el navegador.

## Por qué existe esto

`sam local invoke` (ver [sam-local-dynamodb-local.md](sam-local-dynamodb-local.md)) sirve para probar una Lambda puntual con un evento de ejemplo, pero no emula bien una WebSocket API completa (conexiones persistentes, broadcast a otros clientes). Para poder abrir el navegador y jugar con la app de verdad, se usa en cambio:

- Un **servidor WebSocket real** (`apps/realtime-api/src/main.ts`, con la librería `ws`) que expone las mismas acciones (`createRoom`, `joinRoom`, etc.) que usan las Lambdas, ejecutando exactamente la misma lógica de negocio (`handleCreateRoom`, `handleJoinRoom`, ...). Se arranca vía `nx serve realtime-api` (executor `@nx/js:node`), igual que el resto de los proyectos del monorepo — no depende de ninguna herramienta externa a Nx.
- **DynamoDB Local** en Docker, igual que en el flujo de `sam local invoke`.
- El **dev server de Angular** normal (`nx serve web`).

## Requisitos

- Docker corriendo (`docker ps` no debe dar error).
- Dependencias instaladas (`npm install` en la raíz del repo).

## Paso a paso

### 1. Levantar DynamoDB Local

```bash
npm run dev:db:up
```

Esto corre `docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local:latest`. Si el contenedor ya existe (de una sesión anterior), en vez de esto usar:

```bash
docker start dynamodb-local
```

### 2. Crear la tabla (solo la primera vez, o si el contenedor se recreó)

```bash
npm run dev:db:create-table
```

Internamente corre `aws dynamodb create-table ... --endpoint-url http://localhost:8000 --region us-east-2`.

**Importante**: la región usada (`us-east-2` en los scripts) debe coincidir con la que devuelve `aws configure get region` en tu máquina — ver la explicación completa de por qué en [sam-local-dynamodb-local.md](sam-local-dynamodb-local.md). Si tu perfil AWS usa otra región, edita `dev:db:create-table` y la variable `AWS_REGION` de `dev:api` en `package.json` para que coincidan.

Si el contenedor de DynamoDB Local se reinicia (`docker stop` / `docker start` de una sesión vieja, o se borra y se vuelve a crear), los datos en memoria se pierden y hay que volver a correr este comando (dará `ResourceInUseException` si la tabla ya existe, lo cual es la señal de que no hace falta recrearla).

### 3. Levantar el servidor WebSocket local (backend)

```bash
npm run dev:api
```

Esto corre `nx serve realtime-api` (build con `@nx/esbuild` + ejecución con `@nx/js:node`, con recarga automática al guardar cambios), escuchando en `ws://localhost:3001`, apuntando a la tabla `poker-planning-rooms` en DynamoDB Local.

Deberías ver:
```
Local WebSocket dev server listening on ws://localhost:3001
```

### 4. Levantar el frontend Angular

En otra terminal:

```bash
npm start
```

Levanta el dev server de Angular en `http://localhost:4200`. El frontend está configurado para conectarse a `ws://localhost:3001` (ver `apps/web/src/app/core/room-socket.service.ts`).

### 5. Probar manualmente en el navegador

1. Abrir `http://localhost:4200`.
2. Pestaña "Crear sala": poner un nombre, elegir mazo, crear sala. Deberías navegar automáticamente a `/room/<CODIGO>` y ver el código de sala para compartir.
3. Abrir una **segunda pestaña** (o ventana en incógnito) en `http://localhost:4200`.
4. Pestaña "Unirse a sala": pegar el código de la sala creada, poner otro nombre, unirse.
5. Verificar que ambas pestañas muestran la lista de participantes actualizada en vivo (sin recargar la página).

### 6. Apagar todo al terminar

```bash
docker stop dynamodb-local
```

Y cerrar (Ctrl+C) los procesos de `npm run dev:api` y `npm start`.

## Verificar sin abrir el navegador manualmente (suite e2e)

Existe una suite de tests end-to-end con Playwright en el proyecto Nx `e2e/` (`e2e/playwright.config.mts`, `e2e/estimation-flow.spec.ts`), que reemplaza la necesidad de scripts ad-hoc o de probar manualmente cada flujo.

### Instalar el navegador (solo la primera vez)

```bash
npx playwright install chromium
```

### Correr los tests contra el backend local

**Importante**: a diferencia de lo que podría esperarse, esta suite **no levanta el backend ni el frontend automáticamente**. Se intentó que `playwright.config.mts` orquestara todo (`nx serve realtime-api` + `nx serve web` como parte de `webServer`), pero Nx lo detecta como una invocación recursiva del mismo target (`Recursive task invocation detected`) — el plugin `@nx/playwright` ya infiere automáticamente que esos targets deben correr antes de los tests a partir del propio comando, así que declararlo también dentro de `webServer.command` termina invocándolos dos veces. Por eso, en modo local, hay que levantar el entorno manualmente antes de correr los tests — son los mismos pasos 1-4 de arriba, ni más ni menos:

```bash
# Terminal 1: DynamoDB Local (si no está corriendo)
npm run e2e:db:up

# Terminal 2: backend
npm run dev:api

# Terminal 3: frontend
npm start

# Terminal 4 (o la misma que uses para comandos puntuales): correr los tests
npx nx e2e e2e
```

`npm run test:e2e` existe como atajo, pero **solo** levanta DynamoDB Local (`e2e:db:up`) y corre los tests — igual asume que ya tenés `dev:api` y `npm start` corriendo en otras terminales. Si no lo están, los tests van a fallar intentando conectar a `ws://localhost:3001` / `http://localhost:4200` sin nadie escuchando ahí.

### Correr los tests contra AWS

```bash
npm run test:e2e:aws
```

Este modo sí es autocontenido: Playwright levanta `web` con la configuración de AWS (`environment.aws.ts`) automáticamente, sin necesitar nada del backend local — los tests corren contra el stack real ya desplegado. Cada corrida deja datos de prueba en la tabla real de AWS (sin limpieza automática todavía).

**Limitación conocida**: correr contra AWS es más lento e inestable que contra el backend local (WebSocket real en la nube, posible cold start de Lambda en la primera conexión). El spec ya tiene timeouts ampliados en este modo (90s generales, 30s para esperar navegación tras crear/unirse a una sala), pero igual pueden aparecer fallos intermitentes por timeout sin que sea un bug del test — si esto pasa, reintentar suele alcanzar. Si el timeout ocurre justo después de crear la sala (esperando la navegación a `/room/<código>`), es la Lambda tardando en responder al primer mensaje WebSocket, no un problema del flujo en sí.

**Si un solo navegador no alcanza**: hoy la suite corre solo en `chromium` (ver `e2e/playwright.config.mts`, sección `projects`) para mantenerla simple y reducir la carga concurrente contra el WebSocket real de AWS. Se puede reactivar `firefox`/`webkit` descomentando esa sección si hace falta cobertura cross-browser.

### Nota sobre selectores ambiguos

Si un texto de botón aparece más de una vez en la página (por ejemplo el tab "Unirse a sala" y el botón de submit "Unirse"), Playwright falla en "strict mode" con un error `resolved to 2 elements`. Solución: usar `{ exact: true }` o acotar con `.first()`/`.last()` para desambiguar — ver `e2e/estimation-flow.spec.ts` para ejemplos ya resueltos.

## Despliegue a producción

El frontend (`web`) se despliega automáticamente a GitHub Pages en cada push a `master` (`.github/workflows/deploy-web.yml`). El backend (`realtime-api`) también se despliega automáticamente a AWS en cada push a `master` que toque `apps/realtime-api/**`, `packages/shared-contracts/**` o `infra/**` (`.github/workflows/deploy-backend.yml`, ver [aws-oidc-setup.md](aws-oidc-setup.md) para el setup de credenciales). Ya no hace falta correr `sam deploy` a mano para que un cambio normal llegue a producción — el flujo manual descrito en [aws-deployment.md](aws-deployment.md) sigue disponible como fallback (por ejemplo, para forzar un redeploy sin cambios de código, o para desplegar a un stack separado de pruebas).

## Problema conocido: tests unitarios de Angular rotos

Los pasos de arriba no dependen de `nx test web` / `nx run web:vite:test` — esos tests unitarios de componentes están actualmente rotos por una incompatibilidad de versiones, ver [known-issues.md](known-issues.md). La verificación manual (o con Playwright) descrita en este documento es el camino recomendado mientras ese problema no se resuelva.
