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
