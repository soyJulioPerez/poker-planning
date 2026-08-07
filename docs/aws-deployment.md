# Cómo desplegar la API a AWS real

Guía para desplegar el backend (WebSocket API Gateway + Lambdas + DynamoDB) a una cuenta de AWS real, para probar contra infraestructura de verdad en vez del entorno local.

## Ambientes

Desde `openspec/changes/add-multi-environment-deployment`, hay tres stacks de CloudFormation independientes, cada uno con su propia tabla DynamoDB, API Gateway y Lambdas — sin datos compartidos entre ellos. Ver `docs/git-branching-strategy.md` para cómo se relacionan con las ramas del repo.

| Ambiente | `stack_name` | Tabla DynamoDB |
|---|---|---|
| `dev` | `poker-planning-dev` | `poker-planning-rooms-dev` |
| `qa` | `poker-planning-qa` | `poker-planning-rooms-qa` |
| `prod` | `poker-planning-prod` | `poker-planning-rooms-prod` |

Los 3 se crean desde cero (el stack único que existía antes de estos 3 ambientes fue eliminado) — no hay orden de despliegue obligatorio entre ellos.

Cada sección de `infra/samconfig.toml` (`[dev.deploy.parameters]`, `[qa.deploy.parameters]`, `[prod.deploy.parameters]`) fija su `stack_name` y pasa `Environment=<ambiente>` como `parameter_overrides` a `infra/template.yaml`, que es el que decide los nombres físicos de la tabla/API/stage a partir de ese parámetro (ver `Parameters.Environment` en el template).

## Advertencia sobre credenciales

Antes de desplegar, revisar qué credenciales usa `aws sts get-caller-identity`. Si el `Arn` termina en `:root`, se están usando las credenciales del usuario **root** de la cuenta — AWS desaconseja esto para tareas operativas. Lo recomendable es crear un usuario IAM (o rol) con permisos acotados a lo que este stack necesita (CloudFormation, Lambda, API Gateway v2, DynamoDB, IAM para crear roles de ejecución, S3 para el bucket de despliegue de SAM). Este proyecto se desplegó inicialmente con root por decisión explícita, pero no es la práctica recomendada para uso continuo.

## Prerrequisitos

- AWS CLI configurado (`aws sts get-caller-identity` debe funcionar).
- SAM CLI instalado (`sam --version`).
- Región configurada: los scripts de este proyecto asumen `us-east-2` (ajustar si tu cuenta/perfil usa otra).

## Desplegar (o actualizar) un ambiente

```bash
cd infra
sam build
sam deploy --config-env dev   # o qa / prod
```

`sam build` recompila los handlers (`esbuild`, definido en `Metadata.BuildMethod` de cada función en `template.yaml`). `sam deploy --config-env <ambiente>` usa la sección correspondiente de `samconfig.toml` — compara contra el stack existente de ese ambiente y solo actualiza lo que cambió (si no hay cambios, informa "No changes to deploy"). Para `qa` y `prod`, la primera vez crea el stack desde cero.

Si se necesita desplegar sin `samconfig.toml` (por ejemplo, para automatizarlo en un contexto distinto), se puede pasar todo explícito:

```bash
sam deploy \
  --stack-name poker-planning-qa \
  --region us-east-2 \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides Environment=qa \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset
```

`--resolve-s3` hace que SAM cree y gestione automáticamente un bucket S3 para subir el código empaquetado. `--capabilities CAPABILITY_IAM` es necesario porque el template crea roles IAM para las Lambdas.

## Qué se crea

Al desplegar un ambiente, CloudFormation crea (o actualiza) su stack con:

- Tabla DynamoDB (`PAY_PER_REQUEST`, con TTL habilitado — sin tráfico, el costo debería ser mínimo o nulo).
- WebSocket API Gateway con rutas `$connect`, `$disconnect`, `$default`.
- 3 funciones Lambda (`ConnectFunction`, `DisconnectFunction`, `DefaultFunction`) con sus roles IAM.
- Un stage con auto-deploy (llamado `dev` para el ambiente `dev` por continuidad histórica; `qa`/`prod` para esos ambientes).

Al finalizar, `sam deploy` imprime los Outputs del stack, entre ellos:

```
Key   WebSocketUrl
Value wss://<api-id>.execute-api.<region>.amazonaws.com/<stage>
```

Esa es la URL real a la que se puede conectar un cliente WebSocket para ese ambiente. Copiarla a `apps/mobile/.env.<ambiente>` y, para `prod`, también a la constante `wsUrl` en `apps/web/src/environments/environment.aws.ts`.

## Verificar que el despliegue funciona

### Con un script Node puntual

```js
// test-remote.mjs (ejecutar desde la raíz del proyecto para resolver 'ws' de node_modules)
import WebSocket from 'ws';

const ws = new WebSocket('wss://<api-id>.execute-api.<region>.amazonaws.com/<stage>');

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

El frontend usa `apps/web/src/environments/environment.aws.ts` (constante `wsUrl`), cargado en vez de `environment.ts` mediante `fileReplacements` cuando se compila/sirve con la configuración `aws` (`nx build web --configuration=aws` / `nx serve web --configuration=aws`) — ver `apps/web/project.json`. Por defecto, `environment.ts` usa `ws://localhost:3001` para el flujo de desarrollo local descrito en [local-dev-workflow.md](local-dev-workflow.md).

Para probar el frontend contra el stack real desplegado (hoy siempre `prod`, ya que `web` no tiene ambientes múltiples — ver `openspec/changes/add-multi-environment-deployment`):

1. Confirmar que `environment.aws.ts` tiene la URL `wss://...` correcta del stack `prod`.
2. `npx nx serve web --configuration=aws` (no hace falta levantar `dev:api` ni DynamoDB Local — el backend real ya está en AWS).
3. Probar en el navegador o con el script de Playwright descrito en [local-dev-workflow.md](local-dev-workflow.md).

## Rollback de `prod` sin reescribir `master`

Para redesplegar una versión anterior a `prod` sin mover el puntero de la rama `master` (ver `docs/git-branching-strategy.md`):

```bash
gh workflow run "Deploy backend to AWS" -f environment=prod -f ref=v1.4.0
```

Esto dispara `.github/workflows/deploy-backend.yml` con `workflow_dispatch`, haciendo checkout del tag `v1.4.0` y desplegándolo al stack `prod` — la rama `master` sigue apuntando a donde estaba.

## Verificar el estado de los datos reales

```bash
aws dynamodb scan --table-name poker-planning-rooms --region us-east-2         # dev
aws dynamodb scan --table-name poker-planning-rooms-qa --region us-east-2      # qa
aws dynamodb scan --table-name poker-planning-rooms-prod --region us-east-2    # prod
```

## Eliminar un stack (limpiar recursos de AWS)

Cuando ya no se necesite un ambiente desplegado:

```bash
sam delete --stack-name poker-planning-qa --region us-east-2 --no-prompts
```

Esto borra todos los recursos creados (Lambdas, API Gateway, tabla DynamoDB con todos sus datos, roles IAM) **solo de ese ambiente** — los otros stacks no se ven afectados. **Es destructivo e irreversible** — confirmar antes de correrlo que no hay datos que se quieran conservar.
