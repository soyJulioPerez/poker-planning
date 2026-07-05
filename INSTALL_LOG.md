# Registro de instalación y comandos

Este archivo deja constancia de los comandos ejecutados para instalar dependencias e inicializar el proyecto, en el orden en que se ejecutaron. Referencia: change `planning-poker-mvp` en `openspec/changes/planning-poker-mvp/`.

## Entorno verificado

```bash
node --version   # v22.22.3
npm --version    # 10.9.8
```

## 1. Fundación del monorepo (tarea 1.1)

### Intento 1 (descartado): preset `apps` vacío

```bash
npx create-nx-workspace@latest . --preset=apps --name=poker-planning --nxCloud=skip --interactive=false --packageManager=npm
```
Falló porque el directorio raíz no estaba vacío (`docs/`, `openspec/`, `.claude/` ya existían).

```bash
npx create-nx-workspace@latest nx-tmp --preset=apps --name=poker-planning --nxCloud=skip --interactive=false --packageManager=npm
```
Se generó en subcarpeta temporal `nx-tmp/` y luego se movió el contenido al root. Se descartó porque el preset `apps` (template `nrwl/empty-template`) usa TypeScript project references incompatibles con el generador `@nx/angular:application` (error: *"The Angular framework doesn't support a TypeScript setup with project references"*). Se eliminó todo (`node_modules`, `nx.json`, `package.json`, `tsconfig*.json`, `packages/`) y se reinició con el preset correcto.

### Intento 2 (usado): preset `angular-monorepo`

```bash
npx create-nx-workspace@latest nx-tmp --preset=angular-monorepo --appName=web --style=scss --routing=true --bundler=esbuild --e2eTestRunner=none --ssr=false --nxCloud=skip --interactive=false --packageManager=npm
```

Este preset (template `nrwl/angular-template`) trae una app de ejemplo tipo "tienda" (`shop`, `api`, libs `shop/*`, `api/products`, `shared/models`) ignorando `--appName`. Se conservó solo la configuración base del workspace (Nx, Angular, ESLint, Vitest/Jest) y se eliminaron los ejemplos:

```bash
rm -rf apps/shop apps/shop-e2e apps/api packages/api packages/shared packages/shop
```

Limpieza adicional de artefactos no deseados generados por Nx (git anidado, configuraciones de otros asistentes de IA, Nx Cloud no solicitado):

```bash
rm -rf .agents .codex .cursor .gemini .opencode .github .vscode .claude AGENTS.md opencode.json .git
```
(se preservó el `.claude/` propio del proyecto, no el generado por Nx)

Se removió manualmente la clave `"nxCloudId"` de `nx.json` (Nx Cloud no fue solicitado por el usuario).

Se detuvo el daemon de Nx para poder limpiar la carpeta temporal:
```bash
npx nx daemon --stop
```

### Instalación de plugins Nx para Angular/Node

```bash
npm install -D @nx/angular @nx/node @nx/js
```

### Generación de la app Angular `web`

```bash
npx nx generate @nx/angular:application apps/web --style=scss --routing=true --bundler=esbuild --unitTestRunner=vitest-analog --e2eTestRunner=none --no-interactive
```

### Generación de la app `realtime-api` (Node, para las Lambdas)

Primer intento con `--unitTestRunner=vitest` falló (el generador `@nx/node:application` solo acepta `jest` o `none`). Se usó:

```bash
npx nx generate @nx/node:application apps/realtime-api --framework=none --unitTestRunner=jest --e2eTestRunner=none --bundler=esbuild --no-interactive
```

### Generación de la librería compartida `shared-contracts`

```bash
npx nx generate @nx/js:library packages/shared-contracts --unitTestRunner=jest --bundler=tsc --linter=eslint --no-interactive
```

### Verificación de build

```bash
npx nx run-many --target=build --projects=web,realtime-api,shared-contracts
```
Resultado: los 3 proyectos compilan correctamente.

### Nota sobre cómo se ejecuta el proyecto

En un monorepo Nx cada proyecto define sus propios "targets" (`build`, `serve`, `lint`, `test`) en su `project.json`, no en el `package.json` raíz. Se ejecutan con `npx nx <target> <project>` (ej. `npx nx serve web`).

Se agregaron scripts de conveniencia en el `package.json` raíz para no depender de recordar esa sintaxis:

```json
"scripts": {
  "start": "nx serve web",
  "start:api": "nx serve realtime-api",
  "build": "nx build web",
  "build:api": "nx build realtime-api",
  "test": "nx run-many --target=test --all",
  "lint": "nx run-many --target=lint --all"
}
```

Uso: `npm start` levanta el dev server de Angular; `npm run start:api` levanta la app Node de `realtime-api`.

## 2. Tipos compartidos (tarea 1.2)

No requirió instalación de paquetes nuevos; se agregó código en `packages/shared-contracts/src/lib/` (domain.ts, decks.ts, messages.ts) y se verificó con:

```bash
npx nx test shared-contracts
npx nx run-many --target=build --projects=web,realtime-api,shared-contracts
```

## 3. Infraestructura AWS SAM (tarea 1.3)

### Entorno verificado

```bash
sam --version   # SAM CLI, version 1.162.1
aws --version   # aws-cli/2.35.11
```

### SDKs de AWS para los handlers Lambda

```bash
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-apigatewaymanagementapi
npm install -D @types/aws-lambda
```

### Definición de infraestructura

Se creó `infra/template.yaml` (AWS SAM): tabla DynamoDB single-table (`poker-planning-rooms`, con TTL) y WebSocket API Gateway con rutas `$connect`, `$disconnect`, `$default`, cada una integrada a una Lambda distinta (`ConnectFunction`, `DisconnectFunction`, `DefaultFunction`). Los handlers están escritos en TypeScript en `apps/realtime-api/src/handlers/*.ts` y se compilan directamente desde el `template.yaml` usando `Metadata.BuildMethod: esbuild` (sin depender del build de Nx para estas funciones).

Runtime inicial `nodejs20.x` cambiado a `nodejs24.x` tras advertencia de `sam validate --lint` (nodejs20.x ya deprecado a la fecha).

### Validación y build

```bash
cd infra
sam validate --lint
sam build
```
Resultado: template válido, build exitoso (esbuild bundlea cada handler `.ts` sin necesidad de `package.json` en `infra/`).

### Bloqueo inicial: pruebas locales requieren Docker

```bash
sam local invoke DefaultFunction --event -
```
Falla con: *"Running AWS SAM projects locally requires a container runtime. Do you have Docker installed and running?"*. Docker no estaba instalado inicialmente; el usuario instaló Docker Desktop manualmente y se retomó desde ahí.

## 4. Desarrollo local con Docker + DynamoDB Local (tarea 1.4)

### Verificación de Docker

```bash
docker --version   # Docker version 29.6.1
docker ps
```

### DynamoDB Local en Docker

```bash
docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local:latest
```

### Creación de la tabla local

Importante: usar la misma región que devuelve `aws configure get region` (SAM CLI local invoke usa las credenciales/región reales del perfil AWS, no las que se definan en `env.json` — ver detalle completo en [docs/sam-local-dynamodb-local.md](docs/sam-local-dynamodb-local.md)):

```bash
aws configure get region   # ej. us-east-2
aws dynamodb create-table \
  --table-name poker-planning-rooms \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000 \
  --region us-east-2
```

### Ajuste necesario en el template para poder apuntar a DynamoDB Local

Se agregó `DYNAMODB_ENDPOINT` (vacío por defecto) como variable de entorno declarada en `infra/template.yaml`, ya que `sam local invoke --env-vars` solo puede sobreescribir variables ya declaradas en el template, no inyectar nuevas:

```yaml
Environment:
  Variables:
    TABLE_NAME: !Ref RoomsTable
    DYNAMODB_ENDPOINT: ''
```

Y en `apps/realtime-api/src/lib/dynamo-client.ts`, el cliente usa ese endpoint solo si está seteado:
```ts
const client = new DynamoDBClient({
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
});
```

### Archivo de variables de entorno para invocaciones locales

`infra/env.json` (obtener la IP del contenedor con `docker inspect dynamodb-local --format '{{.NetworkSettings.Networks.bridge.IPAddress}}'`, no usar `host.docker.internal`, que no resolvió de forma confiable en este entorno):

```json
{
  "ConnectFunction": {
    "TABLE_NAME": "poker-planning-rooms",
    "DYNAMODB_ENDPOINT": "http://172.17.0.2:8000",
    "AWS_REGION": "us-east-2"
  },
  "DisconnectFunction": {
    "TABLE_NAME": "poker-planning-rooms",
    "DYNAMODB_ENDPOINT": "http://172.17.0.2:8000",
    "AWS_REGION": "us-east-2"
  }
}
```

### Invocación y verificación

```bash
cd infra
sam build
echo '{"requestContext":{"connectionId":"test-conn-10"}}' | sam local invoke ConnectFunction --event - --env-vars env.json
# {"statusCode": 200, "body": "Connected"}

aws dynamodb get-item --table-name poker-planning-rooms --endpoint-url http://localhost:8000 --region us-east-2 \
  --key '{"PK":{"S":"CONN#test-conn-10"},"SK":{"S":"META"}}'
# Item persistido correctamente con ttl

echo '{"requestContext":{"connectionId":"test-conn-10"}}' | sam local invoke DisconnectFunction --event - --env-vars env.json
# {"statusCode": 200, "body": "Disconnected"}
```

Resultado: ambos handlers (`connect`, `disconnect`) verificados end-to-end contra DynamoDB Local corriendo en Docker, sin necesidad de desplegar a AWS. El detalle completo del proceso de debugging (por qué falló varias veces antes de funcionar) está documentado en [docs/sam-local-dynamodb-local.md](docs/sam-local-dynamodb-local.md) para no repetirlo en futuros desarrollos similares.

## 5. Incremento 1: crear sala + unirse + lista en vivo (tareas 2.1-2.8)

### SDKs y librerías adicionales

```bash
npm install ws
npm install -D @types/ws tsx cross-env
```

- `ws`: servidor WebSocket real usado por `apps/realtime-api/src/dev-server.ts`, un servidor de desarrollo local que emula las rutas `$connect`/`$disconnect`/`$default` de API Gateway invocando la misma lógica de negocio (`handleCreateRoom`, `handleJoinRoom`) que usan las Lambdas reales, sin depender de SAM/Docker para iterar rápido en el día a día.
- `tsx`: ejecuta `dev-server.ts` (TypeScript) directamente con watch mode.
- `cross-env`: setea variables de entorno de forma consistente entre bash y PowerShell.

### Scripts agregados en `package.json`

```json
"dev:api": "cross-env DYNAMODB_ENDPOINT=http://localhost:8000 AWS_REGION=us-east-2 TABLE_NAME=poker-planning-rooms tsx watch apps/realtime-api/src/dev-server.ts",
"dev:db:up": "docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local:latest",
"dev:db:create-table": "aws dynamodb create-table --table-name poker-planning-rooms --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE --billing-mode PAY_PER_REQUEST --endpoint-url http://localhost:8000 --region us-east-2"
```

Flujo de desarrollo día a día: `npm run dev:db:up` (una vez) → `npm run dev:db:create-table` (una vez, o cada vez que se recree el contenedor) → `npm run dev:api` (servidor WebSocket local) + `npm start` (Angular dev server).

### Playwright para verificación en navegador real

El paquete `@playwright/test` ya estaba instalado (parte del preset original de Nx), pero faltaban los navegadores:

```bash
npx playwright install chromium
```

Se usó un script Node puntual (`chromium.launch()`, dos `page`/contexto simulando dos usuarios) para verificar en un navegador real: crear sala, obtener el código, unirse desde otra "pestaña", y confirmar que ambos ven la lista de participantes actualizada en vivo (2 participantes). El script era temporal y se descartó tras la verificación; el patrón queda disponible para repetir verificaciones similares en próximos incrementos.

### Verificación end-to-end del Incremento 1

1. `npm run dev:api` (dev-server WebSocket en `ws://localhost:3001`) y `npm start` (Angular en `http://localhost:4200`) corriendo en paralelo.
2. Prueba con dos clientes WebSocket simulados (script Node con la librería `ws`): moderador crea sala, participante se une, ambos reciben el `roomState` actualizado con los 2 participantes.
3. Prueba en navegador real con Playwright: mismo flujo, verificado visualmente vía DOM (`.participant-list__item`).

Ambas verificaciones confirmaron el comportamiento esperado.

## 6. Primer despliegue real a AWS

### Verificación de credenciales

```bash
aws sts get-caller-identity
```
Resultado: credenciales del usuario **root** de la cuenta (no un usuario IAM). Se avisó al usuario del riesgo (AWS desaconseja usar root para operaciones); decidió proceder igual con root para esta prueba. Ver advertencia completa en [docs/aws-deployment.md](docs/aws-deployment.md).

### Build y despliegue

```bash
cd infra
rm -rf .aws-sam
sam build
sam deploy \
  --stack-name poker-planning-dev \
  --region us-east-2 \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset
```

`--guided` no se pudo usar (requiere modo interactivo, no disponible en este entorno de ejecución); se pasaron los parámetros explícitos en su lugar.

Resultado: stack `poker-planning-dev` creado exitosamente en `us-east-2`. Outputs:
- `WebSocketUrl`: `wss://1wfuif29r2.execute-api.us-east-2.amazonaws.com/dev`
- `TableName`: `poker-planning-rooms`

### samconfig.toml manual

Como no se usó `--guided`, no se generó automáticamente `infra/samconfig.toml`. Se creó manualmente con los mismos parámetros, para que despliegues futuros solo requieran `sam deploy` sin repetir todos los flags. Verificado con `sam deploy` (sin argumentos) → `No changes to deploy`.

### Verificación end-to-end contra AWS real

1. Script Node puntual con `ws` conectando directo a la URL `wss://...` real: `createRoom` respondió correctamente con `roomState`, y el ítem quedó persistido en la tabla DynamoDB real (verificado con `aws dynamodb scan`).
2. Frontend Angular (`apps/web/src/app/core/room-socket.service.ts`): se cambió temporalmente la constante `WEBSOCKET_URL` a la URL real de AWS, se corrió `npm start`, y se verificó con el mismo patrón de script Playwright (dos páginas, crear sala + unirse) que el broadcast en tiempo real funciona correctamente contra la Management API real de API Gateway (a diferencia del entorno local, que usa un transporte simulado vía `registerLocalTransport`).
3. Se revirtió la constante a `ws://localhost:3001` para que el flujo de desarrollo diario siga usando el entorno local por defecto.

Guía completa de despliegue, verificación y cómo eliminar el stack: [docs/aws-deployment.md](docs/aws-deployment.md).

### Eliminación del stack tras la prueba

```bash
sam delete --stack-name poker-planning-dev --region us-east-2 --no-prompts
```

El usuario eliminó el stack `poker-planning-dev` una vez finalizada la prueba, para evitar dejar recursos activos en la cuenta de AWS generando costos innecesarios. Verificado con `aws cloudformation describe-stacks --stack-name poker-planning-dev --region us-east-2` → `Stack with id poker-planning-dev does not exist`. Actualmente no hay ningún stack desplegado; para volver a probar contra AWS real hay que repetir el paso de `sam deploy` descrito en [docs/aws-deployment.md](docs/aws-deployment.md).

## 7. Incremento 2: votación + revelado + promedio/moda (tareas 3.1-3.8)

No requirió instalar dependencias nuevas. Cambios de código relevantes:

- Backend: nuevas acciones `vote` (`apps/realtime-api/src/actions/vote.ts`) y `reveal` (`apps/realtime-api/src/actions/reveal.ts`, con cálculo de promedio/moda y validación de que solo el moderador puede revelar), enrutadas en `handlers/default.ts` y `dev-server.ts`.
- **Bug encontrado y corregido durante la implementación**: `buildRoomState` exponía el voto real de cada participante en el `Room` que se enviaba a todos por broadcast, violando el requirement de "votación oculta" (spec `estimation-session`). Se corrigió agregando `maskRoomForViewer` en `room-repository.ts` (oculta el voto de los demás participantes como `'hidden'` mientras `roundPhase !== 'revealed'`, dejando visible el propio) y `broadcastRoomState` en `broadcast.ts` (arma un mensaje personalizado por conexión en vez de uno idéntico para todos).
- Frontend: componentes `Card` (átomo), `VotingBoard` (organismo, tablero de mazo), `RevealPanel` (distribución de votos + promedio + moda) en `apps/web/src/app/ui/`. Se agregó `myName` como signal en `RoomSocketService` para que el frontend sepa "quién soy" tras navegar de `Home` a `RoomPage` (necesario para resaltar el propio voto y decidir si mostrar controles de moderador).

### Verificación end-to-end

Con el mismo flujo de `local-dev-workflow.md` (DynamoDB Local + `dev:api` + `npm start`) y un script Playwright puntual (dos páginas, Ana modera y vota "5", Bruno se une y vota "8"):

- Confirmado que antes de revelar, la vista de Bruno no expone el voto de Ana en ningún lado del DOM.
- Tras `reveal`, ambos ven `Ana: 5, Bruno: 8, Promedio: 6.5, Moda: 5, 8` (moda con empate correctamente mostrada como lista).
- Confirmado que el botón "Revelar votos" no aparece en la vista de un participante no-moderador (validación de UI), respaldado por la validación equivalente en el backend (`reveal.ts` rechaza si `name !== meta.moderatorName`).

Nota: durante esta sesión Docker Desktop se había cerrado entre sesiones de trabajo; hubo que reabrirlo manualmente (no se puede iniciar una app de escritorio con interfaz gráfica desde este entorno de terminal) antes de poder levantar DynamoDB Local de nuevo.

## 8. Fix: indicador de "ya votó" ausente en la lista de participantes

El usuario desplegó el stack a AWS real manualmente (`sam deploy`) y apuntó el frontend a esa URL para probar, notando que la lista de participantes no mostraba si alguien ya había votado — información que el moderador necesita para saber si puede revelar. El backend ya enviaba esa información enmascarada (`vote: 'hidden'` cuando alguien votó sin revelar), pero el componente `ParticipantList` no la usaba.

Cambios:
- `apps/web/src/app/ui/participant-list/participant-list.html`: agrega indicador "✓ votó" / "esperando voto" por participante conectado y habilitado para votar.
- `apps/web/src/app/pages/room/room.ts` / `room.html`: agrega un contador "X de Y votaron" visible para el moderador junto al botón de revelar.

Verificado con un script Playwright puntual contra el **stack real desplegado en AWS** (no local, ya que en ese momento el frontend apuntaba a la URL real): moderador ve "esperando voto" antes de que Bruno vote, y "✓ votó" inmediatamente después, sin mostrar el valor.

Nota al margen: se corrigió también un espacio inicial accidental en la constante `WEBSOCKET_URL` (`' wss://...'` → `'wss://...'`) que el usuario había introducido al pegar la URL real tras el despliegue manual.

## 9. Incremento 3: resolución de historia + nueva ronda + contadores acumulados (tareas 4.1-4.9)

No requirió instalar dependencias nuevas. Cambios de código relevantes:

- Backend: 4 acciones nuevas en `apps/realtime-api/src/actions/`: `resolve-story.ts` (acepta promedio/moda/valor manual, agrega la historia a `resolvedStories` con `list_append`, resetea la ronda a `idle`), `new-round.ts` (descarta votos sin resolver), `next-story.ts` (asigna `currentStoryTitle` y resetea la ronda), `set-moderator-is-voter.ts` (rechaza el cambio si `roundPhase !== 'idle'`). Se extrajo `resetVotes` a `lib/reset-votes.ts` por ser lógica compartida entre `resolveStory`/`newRound`/`nextStory`.
- Frontend: controles de resolución en `apps/web/src/app/pages/room/` (botones de aceptar promedio/moda, input de valor manual, nueva ronda, siguiente historia), toggle de "moderador vota" con `[disabled]` ligado a `roundPhase !== 'idle'`.

### Verificación end-to-end (DynamoDB Local + dev-server + Playwright)

Se restauró temporalmente `DYNAMODB_ENDPOINT`/`WEBSOCKET_URL` al flujo local (el stack de AWS del incremento anterior ya había sido eliminado por el usuario). Con dos páginas simuladas (Ana modera, Bruno participa):

- Toggle de moderador presente y confirmado **deshabilitado** mientras hay una ronda activa (votando).
- Votación + revelado + "Aceptar moda" (ambos votan 5): contadores actualizan a "1 historia estimada, 5 pts".
- "Nueva ronda" tras revelar: descarta la ronda sin sumar historia (contadores permanecen en "0 historias, 0 pts").
- Revelado + "Usar valor manual" (21, ni promedio ni moda de esa ronda): contadores reflejan "1 historia, 21 pts" — confirma que el moderador puede sobreescribir libremente.
- `nextStory` con título "Historia 2": el encabezado de la sala refleja el nuevo título actual.

Todos los casos funcionaron según lo esperado en la primera pasada.

## 10. Incremento 4: reconexión + resumen final (tareas 5.1-5.5)

No requirió instalar dependencias nuevas. Cambios de código relevantes:

- Backend: nueva acción `closeRoom` (`apps/realtime-api/src/actions/close-room.ts`), que arma el `RoomSummary` (historias resueltas + total) desde `resolvedStories` ya persistido en el ítem de sala, y hace broadcast del mensaje `roomClosed`. La reconexión por nombre+sala (5.1) ya estaba cubierta desde el Incremento 1 (`joinRoom` reutiliza el ítem existente); se confirmó sin cambios de código.
- Frontend: fix del bug de refresh en blanco (reportado por el usuario con capturas de DevTools) — `RoomSocketService` ahora persiste `{roomId, name}` en `sessionStorage` (`saveSession`/`clearSession`) y expone `rejoinIfNeeded(roomId)`, invocado desde el constructor de `RoomPage`: si `room()` sigue `null` tras cargar y hay una sesión guardada para ese `roomId`, reconecta el WebSocket y reenvía `joinRoom` automáticamente. Se agregó también la pantalla de resumen final (`room__summary`) y el botón "Cerrar sala" para el moderador.

### Verificación end-to-end (DynamoDB Local + dev-server + Playwright)

- **Reconexión tras refresh**: se creó una sala, se votó "8", se recargó la página (`page.reload()`) — la sala reconectó automáticamente (ya no queda en "Conectando a la sala...") y el voto "8" se mantuvo seleccionado tras la recarga.
- **Resumen final**: se resolvió una historia (moda = 5) y se cerró la sala con el moderador — tanto el moderador como el participante vieron la pantalla de resumen con "Historia sin título: 5 pts, Total: 5 pts".

Ambos casos funcionaron en la primera pasada tras el fix.

## 11. Cierre del MVP (tareas 6.1-6.2)

- **6.1**: se reescribió `README.md` completo (antes era el placeholder genérico generado por Nx, con referencias a proyectos de ejemplo `shop`/`api` ya eliminados). Ahora documenta el stack, el flujo de uso completo (crear sala → compartir → unirse → votar → revelar → resolver → reconexión → cerrar sala), la deuda técnica de identidad por nombre+sala, y enlaces a toda la documentación en `docs/`.
- **6.2**: revisión final end-to-end de los 4 incrementos en una sola sesión continua (DynamoDB Local + dev-server + Playwright), con 2 participantes simulados. Se cubrieron 9 checks en secuencia: sala + lista en vivo, votación oculta + revelado con cálculo correcto de promedio/moda, resolución de dos historias distintas (una con "Aceptar promedio", otra con valor manual tras usar "Nueva ronda" en el medio), contadores acumulados correctos (2 historias, 14.5 pts), reconexión tras refresh sin pérdida de estado, y resumen final coincidente para ambos participantes. Todos los checks pasaron en la primera ejecución.

Con esto se completan las 36 tareas de `tasks.md` del change `planning-poker-mvp`.
