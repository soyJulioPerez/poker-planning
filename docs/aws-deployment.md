# Cómo desplegar la API a AWS real

Guía para desplegar el backend (WebSocket API Gateway + Lambdas + DynamoDB) a una cuenta de AWS real, para probar contra infraestructura de verdad en vez del entorno local.

## Advertencia sobre credenciales

Antes de desplegar, revisar qué credenciales usa `aws sts get-caller-identity`. Si el `Arn` termina en `:root`, se están usando las credenciales del usuario **root** de la cuenta — AWS desaconseja esto para tareas operativas. Lo recomendable es crear un usuario IAM (o rol) con permisos acotados a lo que este stack necesita (CloudFormation, Lambda, API Gateway v2, DynamoDB, IAM para crear roles de ejecución, S3 para el bucket de despliegue de SAM). Este proyecto se desplegó inicialmente con root por decisión explícita, pero no es la práctica recomendada para uso continuo.

## Prerrequisitos

- AWS CLI configurado (`aws sts get-caller-identity` debe funcionar).
- SAM CLI instalado (`sam --version`).
- Región configurada: los scripts de este proyecto asumen `us-east-2` (ajustar si tu cuenta/perfil usa otra).

## Primer despliegue

```bash
cd infra
sam build
sam deploy --guided
```

`--guided` es interactivo: pregunta nombre de stack, región, si confirmar el changeset, etc., y al final genera `infra/samconfig.toml` con esas respuestas guardadas para despliegues futuros.

Si se necesita hacerlo sin modo interactivo (por ejemplo, para automatizarlo o ejecutarlo en un entorno no interactivo), se puede pasar todo explícito:

```bash
sam deploy \
  --stack-name poker-planning-dev \
  --region us-east-2 \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset
```

`--resolve-s3` hace que SAM cree y gestione automáticamente un bucket S3 para subir el código empaquetado, sin tener que crear uno a mano. `--capabilities CAPABILITY_IAM` es necesario porque el template crea roles IAM para las Lambdas.

Este proyecto ya tiene un `infra/samconfig.toml` con estos valores guardados, así que en la práctica alcanza con:

```bash
cd infra
sam build
sam deploy
```

## Qué se crea

Al desplegar, CloudFormation crea (stack `poker-planning-dev`):

- Tabla DynamoDB `poker-planning-rooms` (`PAY_PER_REQUEST`, con TTL habilitado — sin tráfico, el costo debería ser mínimo o nulo).
- WebSocket API Gateway (`poker-planning-ws`) con rutas `$connect`, `$disconnect`, `$default`.
- 3 funciones Lambda (`ConnectFunction`, `DisconnectFunction`, `DefaultFunction`) con sus roles IAM.
- Un stage `dev` con auto-deploy.

Al finalizar, `sam deploy` imprime los Outputs del stack, entre ellos:

```
Key   WebSocketUrl
Value wss://<api-id>.execute-api.<region>.amazonaws.com/dev
```

Esa es la URL real a la que se puede conectar un cliente WebSocket.

## Verificar que el despliegue funciona

### Con un script Node puntual

```js
// test-remote.mjs (ejecutar desde la raíz del proyecto para resolver 'ws' de node_modules)
import WebSocket from 'ws';

const ws = new WebSocket('wss://<api-id>.execute-api.<region>.amazonaws.com/dev');

ws.on('open', () => {
  ws.send(JSON.stringify({
    action: 'createRoom',
    moderatorName: 'Ana',
    deckId: 'fibonacci',
    moderatorIsVoter: true,
  }));
});

ws.on('message', (data) => {
  console.log('recv:', data.toString());
  ws.close();
});

ws.on('error', (err) => console.error('error:', err.message));
ws.on('close', () => process.exit(0));
```

```bash
node test-remote.mjs
```

Si responde con un mensaje `roomState`, el stack funciona de punta a punta (API Gateway → Lambda → DynamoDB → respuesta al cliente).

### Contra el frontend real (Angular apuntando a AWS)

El frontend usa una constante `WEBSOCKET_URL` en [apps/web/src/app/core/room-socket.service.ts](../apps/web/src/app/core/room-socket.service.ts) (por defecto `ws://localhost:3001`, para el flujo de desarrollo local descrito en [local-dev-workflow.md](local-dev-workflow.md)).

Para probar el frontend contra el stack real desplegado:

1. Editar temporalmente esa constante con la URL `wss://...` que imprimió `sam deploy`.
2. `npm start` (no hace falta levantar `dev:api` ni DynamoDB Local — el backend real ya está en AWS).
3. Probar en el navegador o con el script de Playwright descrito en [local-dev-workflow.md](local-dev-workflow.md).
4. **Importante**: revertir la constante a `ws://localhost:3001` antes de seguir trabajando localmente, para no depender de la infraestructura real en el día a día (y evitar tráfico/costos innecesarios).

Nota: esta constante hardcodeada es deliberadamente simple para el estado actual del proyecto. Si se necesita alternar entre entornos con frecuencia, conviene introducir el mecanismo estándar de Angular (`fileReplacements` / archivos `environment.ts`) — no se hizo todavía porque no era necesario para este MVP.

## Verificar el estado de los datos reales

```bash
aws dynamodb scan --table-name poker-planning-rooms --region us-east-2
```

## Actualizar el stack tras cambios en el código

```bash
cd infra
sam build
sam deploy
```

`sam build` recompila los handlers (`esbuild`, definido en `Metadata.BuildMethod` de cada función en `template.yaml`). `sam deploy` compara contra el stack existente y solo actualiza lo que cambió (si no hay cambios, informa "No changes to deploy").

## Eliminar el stack (limpiar recursos de AWS)

Cuando ya no se necesite el entorno desplegado:

```bash
sam delete --stack-name poker-planning-dev --region us-east-2 --no-prompts
```

Esto borra todos los recursos creados (Lambdas, API Gateway, tabla DynamoDB con todos sus datos, roles IAM). **Es destructivo e irreversible** — confirmar antes de correrlo que no hay datos que se quieran conservar.
