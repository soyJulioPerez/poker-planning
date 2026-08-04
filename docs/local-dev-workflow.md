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

## Probar la app mobile (Expo)

La app `apps/mobile` (Expo/React Native, agregada en el change `add-mobile-app`) reusa `packages/shared-contracts` y `packages/room-client-runtime` tal cual, y se conecta al mismo backend WebSocket que la web (`apps/realtime-api`). El camino más rápido para probarla sin instalar Android Studio ni Xcode es un dispositivo físico con la app **Expo Go**.

### Requisitos

- Backend local corriendo — mismos pasos 1-3 de la sección anterior (`npm run dev:db:up`, `npm run dev:db:create-table` la primera vez, `npm run dev:api`).
- Un celular (Android o iOS) con la app **Expo Go** instalada (Play Store / App Store).
- El celular y la PC en la **misma red Wi-Fi** (no una red de invitados/aislada — algunos routers domésticos bloquean que los dispositivos se vean entre sí).

### 1. Configurar la URL del backend para tu red local

`apps/mobile/.env` trae como default `EXPO_PUBLIC_WS_URL=ws://localhost:3001`, que funciona para un emulador/simulador corriendo en la misma máquina, pero **no** para un dispositivo físico: `localhost` en el celular apunta al celular mismo, no a la PC.

Para un dispositivo físico, creá `apps/mobile/.env.local` (gitignored — es específico de tu red, no se commitea) con la IP LAN de tu PC:

```bash
# apps/mobile/.env.local
EXPO_PUBLIC_WS_URL=ws://<IP-LAN-DE-TU-PC>:3001
```

Para encontrar tu IP LAN en Windows:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notlike '169.254.*' }
```

Usá la IP del adaptador Wi-Fi real (ej. `Wi-Fi` o `Wi-Fi 2`), no las de adaptadores virtuales (`vEthernet (...)`).

**Importante**: las variables `EXPO_PUBLIC_*` se leen al arrancar el bundler de Metro, no en caliente. Si cambiás `.env.local` con el bundler ya corriendo, hay que reiniciarlo.

### 2. Levantar la app mobile

```bash
npm run start:mobile
```

Corre `cd apps/mobile && npx expo start` — el CLI de Expo directo, **no** el target `nx start mobile`.

**Por qué no usa Nx acá**: se probó primero con el target inferido `start` (`@nx/expo/plugin`, respaldado por Nx), pero en esta versión de `@nx/expo` (`23.0.1`) ese target sigue routeando internamente al executor deprecado `@nx/expo:start`, que lanza el CLI real de Expo vía `child_process.fork()` **sin conectar su stdout a una TTY real** (`stdio` en modo `pipe`, no `inherit` — confirmado leyendo `node_modules/@nx/expo/dist/src/executors/start/start.impl.js`). Expo CLI, al no detectar una terminal interactiva, no dibuja el QR ni imprime la URL, aunque el bundler funcione perfectamente. Se probó `nx g @nx/expo:convert-to-inferred` para migrar al mecanismo moderno, pero no aplica: el proyecto ya usa targets 100% inferidos (`apps/mobile/project.json` tiene `"targets": {}`), así que no hay nada que convertir — la limitación está en la implementación interna del plugin, no en la configuración del proyecto. Correr `expo start` directo evita el wrapper por completo.

### 3. Escanear el QR

- **Android**: abrir Expo Go → "Scan QR code" (el escaneo se hace desde adentro de la app, no desde la cámara nativa).
- **iOS**: escanear con la app Cámara nativa, que ofrece abrir el link en Expo Go.

Debería cargar la pantalla Home (`apps/mobile/src/app/screens/HomeScreen.tsx`, con las tabs "Unirse a sala"/"Crear sala").

### Si Expo Go rechaza el proyecto ("requires a newer version of Expo Go")

El SDK de Expo del proyecto (`expo` en `package.json`, hoy `~54.0.36`) tiene que coincidir con la versión de Expo Go instalada en tu celular — Expo Go solo soporta un SDK específico por versión publicada en la store, no siempre el más nuevo de npm. La app te dice qué SDK espera ("Supported SDK XX") al fallar; si no coincide con el `expo` del proyecto, hay que bajar (o subir) el SDK del proyecto con `expo install --fix` y realinear las versiones correlacionadas (`react`, `react-native`, `react-native-svg`, etc. — ver commits de este change para el detalle de qué se realineó).

### Si no conecta

- **Firewall de Windows**: la causa más común. Puede estar bloqueando conexiones entrantes al puerto `3001` (backend) o `8081` (Metro bundler) desde la red local. Si el QR carga pero crear/unirse a una sala no hace nada, revisar reglas de firewall entrantes para esos puertos.
- **IP cambió**: si la PC se reconecta al Wi-Fi y le asignan otra IP, hay que actualizar `apps/mobile/.env.local` y reiniciar el bundler.
- **Backend caído**: si `dev:api` se reinicia y el contenedor de DynamoDB Local había perdido la tabla (`ResourceNotFoundException`), hay que correr `npm run dev:db:create-table` de nuevo y relanzar `npm run dev:api`.
- **Red aislada**: routers domésticos con "modo invitado" o aislamiento de clientes AP impiden que el celular vea la PC aunque estén en el mismo Wi-Fi — probar conectando ambos a un hotspot simple, o desactivando el aislamiento en la config del router.

### Validar el bundle sin dispositivo (CI-friendly)

Para confirmar que la app compila y que Metro resuelve correctamente `shared-contracts`/`room-client-runtime` sin necesitar un dispositivo ni Expo Go:

```bash
npx nx export mobile
```

Genera un bundle de producción real para web/iOS/Android en `apps/mobile/dist` (gitignored). Sirve como chequeo rápido de que no hay nada roto en la resolución de módulos del monorepo antes de probar en un dispositivo.

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
