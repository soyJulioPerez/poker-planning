# Configurar OIDC entre GitHub Actions y AWS (setup único)

Guía para el paso manual, de una sola vez, que hace falta antes de que `.github/workflows/deploy-backend.yml` pueda desplegar el backend automáticamente: crear un proveedor de identidad OIDC y un rol IAM en la cuenta de AWS que ya hostea `poker-planning-dev`.

Esto **no se puede automatizar dentro del propio workflow**: el workflow necesita el rol para autenticarse, así que el rol tiene que existir antes de que el workflow corra por primera vez. Es un problema del huevo y la gallina — se resuelve una única vez, a mano.

## Por qué OIDC en vez de un access key

Hoy, un despliegue manual (`sam deploy`, ver [aws-deployment.md](aws-deployment.md)) usa las credenciales de tu perfil AWS local — hoy mismo el usuario **root** de la cuenta, según ya advierte ese documento. La forma "obvia" de automatizar esto sería generar un Access Key ID + Secret Access Key y pegarlos como GitHub Secrets. Funcionaría, pero es una contraseña de larga duración: no expira sola, y si se filtra (un log mal configurado, un runner comprometido, un secret copiado a otro lado) sigue siendo válida hasta que alguien la revoque a mano.

OIDC (OpenID Connect) evita ese problema reemplazando "una contraseña compartida" por "una relación de confianza + tokens de corta duración":

```
┌─────────────────────┐        ┌──────────────────────────┐        ┌─────────────────┐
│   GitHub Actions     │        │   AWS STS                │        │   AWS (Lambda,   │
│   (el workflow run)  │        │   AssumeRoleWithWebIdentity│      │   DynamoDB, ...) │
└──────────┬───────────┘        └────────────┬─────────────┘        └────────┬────────┘
           │ 1. pide un JWT firmado           │                               │
           │    a GitHub (identity provider    │                               │
           │    token.actions.githubusercontent.com)                          │
           │                                   │                               │
           │ 2. presenta el JWT ──────────────▶│                               │
           │                                   │ 3. verifica firma contra      │
           │                                   │    la clave pública de GitHub │
           │                                   │    y compara claims (sub, aud)│
           │                                   │    contra el trust policy     │
           │                                   │    del IAM Role               │
           │◀── 4. credenciales temporales ────│                               │
           │    (~1 hora, sin necesidad         │                               │
           │    de rotación manual)             │                               │
           │                                   │                               │
           │ 5. usa esas credenciales para llamar a AWS (sam deploy) ─────────▶│
```

Puntos clave del mecanismo:

- **El JWT lo emite y firma GitHub**, no vos. Contiene *claims* (afirmaciones) verificables como `repo:soyJulioPerez/poker-planning:ref:refs/heads/master` — es decir, "este token fue emitido para una ejecución del workflow de este repo exacto".
- **AWS nunca ve ni almacena un secreto tuyo.** Solo configurás, una vez, que confía en los tokens firmados por `token.actions.githubusercontent.com`, *siempre que* el claim `sub` (subject) coincida con un patrón que vos definís (en este caso, este repo).
- **Las credenciales que resultan son temporales** (por defecto ~1 hora) y están limitadas a los permisos que le diste al rol. No hay nada que rotar ni revocar manualmente — expiran solas.
- Es el mismo patrón de federación de identidad que SSO/SAML: en vez de que cada sistema guarde su propia contraseña, todos confían en las aserciones firmadas de un proveedor de identidad común, acotadas por condiciones sobre esas aserciones.

## Prerrequisitos

- Acceso a la consola de AWS (o AWS CLI) de la cuenta que hostea `poker-planning-dev` — cuenta `343218183958`, región `us-east-2`.
- Saber el nombre exacto del repo en GitHub: `soyJulioPerez/poker-planning`.

## Paso 1 — Crear el proveedor de identidad OIDC

GitHub ya expone el proveedor OIDC públicamente; este paso solo le dice a *tu cuenta de AWS* que confíe en él.

**Por consola:**
1. IAM → **Identity providers** → **Add provider**.
2. Provider type: **OpenID Connect**.
3. Provider URL: `https://token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`
5. Click **Add provider**. (La consola actual de AWS resuelve el thumbprint del certificado automáticamente al crear el proveedor — no pide confirmarlo a mano.)

**Por CLI (equivalente):**
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea
```

> Si tu cuenta ya tiene un proveedor OIDC de GitHub Actions configurado (por ejemplo, de otro proyecto), **no crear uno nuevo** — un proveedor por combinación de cuenta AWS + `token.actions.githubusercontent.com` alcanza para todos los repos. Verificar con `aws iam list-open-id-connect-providers`.

## Paso 2 — Crear el IAM Role con su trust policy

El *trust policy* es la parte que implementa la condición "solo confío en tokens que afirmen ser de `soyJulioPerez/poker-planning`". Sin el `StringLike` sobre `sub`, cualquier repo público de GitHub podría asumir este rol — es el control de seguridad central de todo el mecanismo.

Crear un archivo `trust-policy.json` local (no commitear a la vez que se documenta el ARN resultante):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::343218183958:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:soyJulioPerez/poker-planning:*"
        }
      }
    }
  ]
}
```

- `aud` (audience) confirma que el token fue solicitado para hablar con AWS STS específicamente.
- `sub` (subject) con `StringLike ...:*` permite cualquier ref de este repo (ramas, tags, pull requests). Si se quisiera restringir a solo `master`, el valor sería `repo:soyJulioPerez/poker-planning:ref:refs/heads/master` con `StringEquals` en vez de `StringLike` — no lo hacemos acá porque el trigger `workflow_dispatch` puede correr desde otras ramas también, pero es una restricción válida a futuro si se quiere reducir superficie.

Crear el rol:

```bash
aws iam create-role \
  --role-name poker-planning-github-deploy \
  --assume-role-policy-document file://trust-policy.json
```

## Paso 3 — Adjuntar permisos mínimos para `sam deploy`

El rol necesita exactamente lo que `sam deploy` usa para gestionar los recursos de `infra/template.yaml`: CloudFormation, Lambda, API Gateway v2, DynamoDB, gestión de los roles de ejecución de las 3 Lambdas, y el bucket S3 administrado por SAM.

Crear `deploy-permissions-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFormationStackOps",
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateChangeSet",
        "cloudformation:DescribeChangeSet",
        "cloudformation:ExecuteChangeSet",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:GetTemplate",
        "cloudformation:GetTemplateSummary",
        "cloudformation:ListStackResources"
      ],
      "Resource": "arn:aws:cloudformation:us-east-2:343218183958:stack/poker-planning-dev/*"
    },
    {
      "Sid": "CloudFormationManagedStackOps",
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateChangeSet",
        "cloudformation:DescribeChangeSet",
        "cloudformation:ExecuteChangeSet",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:GetTemplate",
        "cloudformation:ListStackResources",
        "cloudformation:CreateStack"
      ],
      "Resource": "arn:aws:cloudformation:us-east-2:343218183958:stack/aws-sam-cli-managed-default/*"
    },
    {
      "Sid": "CloudFormationServerlessTransform",
      "Effect": "Allow",
      "Action": ["cloudformation:CreateChangeSet"],
      "Resource": "arn:aws:cloudformation:us-east-2:aws:transform/Serverless-2016-10-31"
    },
    {
      "Sid": "S3DeploymentBucket",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::aws-sam-cli-managed-default-samclisourcebucket-*",
        "arn:aws:s3:::aws-sam-cli-managed-default-samclisourcebucket-*/*"
      ]
    },
    {
      "Sid": "LambdaManagement",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:GetFunction",
        "lambda:DeleteFunction",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:GetPolicy",
        "lambda:TagResource"
      ],
      "Resource": "arn:aws:lambda:us-east-2:343218183958:function:poker-planning-*"
    },
    {
      "Sid": "ApiGatewayManagement",
      "Effect": "Allow",
      "Action": ["apigateway:*"],
      "Resource": "arn:aws:apigateway:us-east-2::/apis/*"
    },
    {
      "Sid": "DynamoDBTableManagement",
      "Effect": "Allow",
      "Action": [
        "dynamodb:DescribeTable",
        "dynamodb:CreateTable",
        "dynamodb:UpdateTable",
        "dynamodb:UpdateTimeToLive",
        "dynamodb:DescribeTimeToLive",
        "dynamodb:TagResource"
      ],
      "Resource": "arn:aws:dynamodb:us-east-2:343218183958:table/poker-planning-rooms"
    },
    {
      "Sid": "IamRoleManagementForLambdas",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:TagRole"
      ],
      "Resource": "arn:aws:iam::343218183958:role/poker-planning-dev-*"
    }
  ]
}
```

> Los recursos con wildcard (`poker-planning-*`) están acotados por prefijo de nombre, no abiertos a toda la cuenta — así un uso indebido del rol queda limitado a los recursos de este proyecto. `apigateway:*` sobre `/apis/*` es más amplio porque IAM no soporta scoping fino por nombre de API en ese servicio; si se quiere endurecer más adelante, se puede acotar por tag una vez que el API Gateway ya exista.

Crear la policy y adjuntarla al rol:

```bash
aws iam put-role-policy \
  --role-name poker-planning-github-deploy \
  --policy-name poker-planning-sam-deploy \
  --policy-document file://deploy-permissions-policy.json
```

## Paso 4 — Registrar el Role ARN en GitHub

```bash
aws iam get-role --role-name poker-planning-github-deploy --query 'Role.Arn' --output text
```

Copiar el ARN resultante (algo como `arn:aws:iam::343218183958:role/poker-planning-github-deploy`) y agregarlo como **variable** del repositorio (no secret — un ARN de rol no es sensible por sí solo, ya que sin el token OIDC firmado no sirve para nada):

GitHub → repo → **Settings** → **Secrets and variables** → **Actions** → pestaña **Variables** → **New repository variable**:
- Name: `AWS_DEPLOY_ROLE_ARN`
- Value: el ARN copiado

## Verificación

Una vez hecho esto, `.github/workflows/deploy-backend.yml` puede autenticarse. Confirmar corriendo el workflow manualmente (`workflow_dispatch`) antes de depender del trigger automático — ver tarea 3.1 en `tasks.md` del change `automate-backend-deploy`.

Disparar el workflow manualmente con GitHub CLI:

```bash
gh workflow run "Deploy backend to AWS" --repo soyJulioPerez/poker-planning
```

Seguir la ejecución en vivo:

```bash
gh run watch --repo soyJulioPerez/poker-planning
```

(Si pide elegir un run porque hay varios recientes, seleccionar el más nuevo.)

Alternativa sin terminal: en GitHub → pestaña **Actions** → workflow **"Deploy backend to AWS"** → botón **"Run workflow"**.

Si `AssumeRoleWithWebIdentity` falla, los errores más comunes son:
- **`sub` no matchea**: revisar que el nombre del repo en el trust policy sea exactamente `soyJulioPerez/poker-planning` (case-sensitive).
- **`aud` no matchea**: el workflow debe declarar `permissions: id-token: write` y usar `aws-actions/configure-aws-credentials` sin overridear el audience por defecto (`sts.amazonaws.com`).
- **Acceso denegado en un recurso específico**: revisar que el ARN del recurso en la policy de permisos coincida exactamente con el nombre real (p. ej. si el nombre del stack o de la tabla cambiara).

## Limpieza (si se quiere revertir)

```bash
aws iam delete-role-policy --role-name poker-planning-github-deploy --policy-name poker-planning-sam-deploy
aws iam delete-role --role-name poker-planning-github-deploy
```

El proveedor OIDC (`token.actions.githubusercontent.com`) puede dejarse — no otorga ningún acceso por sí solo sin un rol que confíe en él.
