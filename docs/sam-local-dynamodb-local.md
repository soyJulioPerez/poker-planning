# Cómo probar Lambdas de SAM contra DynamoDB Local (Windows + Docker)

Notas de una sesión de debugging real. Guardado para no repetir el mismo proceso de prueba y error la próxima vez que se arme este tipo de entorno.

## Contexto

Se quería invocar Lambdas de un `template.yaml` de AWS SAM con `sam local invoke`, apuntando a una tabla DynamoDB corriendo localmente en Docker (`amazon/dynamodb-local`), sin desplegar nada a AWS real.

## Pasos que funcionan

1. **Levantar DynamoDB Local en Docker**
   ```bash
   docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local:latest
   ```

   Por defecto `amazon/dynamodb-local` guarda los datos en memoria: al hacer `docker stop`/`docker start` (o si el contenedor se recrea) **la tabla y sus datos se pierden** y hay que volver a crearla. Si se necesita persistencia entre reinicios, correr con `-jar DynamoDBLocal.jar -sharedDb -dbPath /data` y un volumen montado; para desarrollo puntual alcanza con recrear la tabla cada vez que se reinicia el contenedor.

2. **Obtener la IP del contenedor** (en vez de confiar en `host.docker.internal`)
   ```bash
   docker inspect dynamodb-local --format '{{.NetworkSettings.Networks.bridge.IPAddress}}'
   ```
   `host.docker.internal` puede no resolver de forma confiable desde el contenedor de emulación de Lambda (`public.ecr.aws/lambda/nodejs:*-rapid-*`) en Windows. Usar la IP directa del contenedor de DynamoDB (ej. `172.17.0.2`) es más confiable.

3. **Declarar la variable de entorno en el `template.yaml`, no solo en `env.json`**

   `sam local invoke --env-vars env.json` **solo puede sobreescribir variables que ya existen** en `Environment.Variables` del template — no puede inyectar variables nuevas. Si `DYNAMODB_ENDPOINT` no está declarada (aunque sea vacía) en el template, el override en `env.json` se ignora silenciosamente.

   ```yaml
   Globals:
     Function:
       Environment:
         Variables:
           TABLE_NAME: !Ref RoomsTable
           DYNAMODB_ENDPOINT: ''   # necesario para poder overridear en local
   ```

   En el código, tratar string vacío como "no seteado":
   ```ts
   const client = new DynamoDBClient({
     ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
   });
   ```

4. **SAM CLI ignora las credenciales/región que pongas en `env.json` para `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_REGION`**

   Aunque el `env.json` tenga `"AWS_ACCESS_KEY_ID": "local"`, SAM CLI local invoke termina inyectando las credenciales **reales** del perfil AWS configurado (`aws configure`) y la región real del perfil, no las del `env.json`. Esto se confirmó agregando un `console.log` temporal dentro del handler imprimiendo `process.env`.

   **Consecuencia práctica**: la tabla en DynamoDB Local debe crearse usando exactamente las mismas credenciales y región que usa tu perfil AWS real (`aws configure get region`), porque DynamoDB Local particiona los datos por combinación de credenciales+región/cuenta simulada:

   ```bash
   aws dynamodb create-table \
     --table-name poker-planning-rooms \
     --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
     --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
     --billing-mode PAY_PER_REQUEST \
     --endpoint-url http://localhost:8000 \
     --region <region-de-tu-perfil-aws>
   ```

   No uses `--region us-east-1` "porque sí" ni credenciales dummy al crear la tabla — usa la región que realmente devuelve `aws configure get region`.

5. **Invocar la función**
   ```bash
   echo '{"requestContext":{"connectionId":"test-1"}}' | sam local invoke ConnectFunction --event - --env-vars env.json
   ```

## Resumen del flujo de debugging que llevó a la causa raíz

Síntomas y cómo se fue acotando:

1. Error genérico `ResourceNotFoundException: Requested resource not found` → parecía de red.
2. Se verificó que `host.docker.internal` sí resolvía (con un contenedor `curl` de prueba) → no era de red.
3. Se agregó un `console.log(process.env)` temporal dentro del handler → reveló `endpoint: undefined` a pesar de estar en `env.json` → causa: la variable no estaba pre-declarada en el template.
4. Tras declarar `DYNAMODB_ENDPOINT: ''` en el template, el endpoint sí llegó, pero el error cambió a `Cannot do operations on a non-existent table` (mensaje más específico) → la conexión ya funcionaba, pero la tabla no existía para esas credenciales/región.
5. El mismo `console.log` reveló `accessKeyId` con un Access Key ID real (no `"local"` como se había puesto en `env.json`) → SAM CLI prioriza las credenciales del perfil AWS real sobre las del `env.json` para estas variables reservadas.
6. Se recreó la tabla con la región real del perfil (`us-east-2` en este caso) → funcionó.

**Lección general**: cuando `sam local invoke` se comporta de forma inesperada con variables de entorno, agregar un `console.log(process.env)` temporal dentro del handler es la forma más rápida de confirmar qué está realmente recibiendo el proceso, en vez de asumir que `env.json` se aplica tal cual se escribió.

## Alternativa a considerar a futuro

Para evitar esta fricción de credenciales/región, se podría:
- Usar `AWS_PROFILE` dedicado con una región fija y documentada para desarrollo local, o
- Envolver la creación de la tabla local en un script (`npm run db:local:setup`) que lea automáticamente `aws configure get region` y cree la tabla con esa región, evitando el desajuste manual.
