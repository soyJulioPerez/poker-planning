## Why

Hasta el inicio de este change existía un único stack de AWS (`poker-planning-dev`, pese al nombre, de facto producción) al que apuntaban simultáneamente los usuarios reales de la web, los builds de preview mobile que usa QA/stakeholders, y las corridas de `test:e2e:aws` — todos compartiendo la misma tabla DynamoDB sin ningún aislamiento. Esta limitación ya estaba documentada como conocida en `docs/mobile-preview-builds.md` ("la solución sería un stack de AWS separado ('staging')") y fue explícitamente diferida como *non-goal* en `openspec/changes/archive/2026-07-22-automate-backend-deploy/design.md`. Además, cada push a `master` que toca el backend se desplegaba automáticamente a ese único stack sin ningún ambiente intermedio donde validar el cambio contra infraestructura real antes de que llegue a usuarios.

(Ese stack fue eliminado durante la implementación de este change — no hay usuarios en producción en este momento, lo cual simplifica la migración: los 3 stacks nuevos se crean desde cero, ver "What Changes".)

## What Changes

- Se introducen tres ambientes reales de backend desplegados en AWS: `dev`, `qa` y `prod`, cada uno como un stack de CloudFormation independiente (misma plantilla `infra/template.yaml`, distinto `stack_name` por ambiente vía nuevas secciones en `infra/samconfig.toml`).
- Se adoptan tres ramas de trabajo: `develop`, `release/*` y `master`, cada una asociada a un ambiente:
  - Push a `develop`: **no** dispara deploy automático; el ambiente `dev` se despliega manualmente (`workflow_dispatch`) cuando el desarrollador lo decide.
  - Push a cualquier rama `release/*`: dispara deploy automático al ambiente `qa` (un único stack QA compartido — cualquier `release/*` que se pushee despliega y pisa lo que hubiera, lo cual sirve además como mecanismo de rollback en QA).
  - Push a `master`: dispara deploy automático al ambiente `prod`, un stack nuevo (comportamiento de trigger equivalente al actual, pero apuntando a un stack `poker-planning-prod` recién creado en vez del stack existente).
- El workflow `.github/workflows/deploy-backend.yml` se extiende (no se reescribe) para aceptar el ambiente como parámetro (`--config-env`) y para soportar un input manual opcional de `ref` en `workflow_dispatch`, permitiendo re-desplegar un tag anterior al ambiente `prod` como mecanismo de rollback **sin reescribir la historia de `master`**.
- El workflow `.github/workflows/build-mobile.yml` (perfil-de-empaquetado EAS existente: `development`/`preview`/`production`, sin cambios en `eas.json`) gana un input separado de ambiente (`dev`/`qa`/`prod`) que selecciona el archivo `.env.<ambiente>` correspondiente antes de invocar `eas build`, desacoplando "cómo se empaqueta" de "a qué backend apunta".
- Se agregan `apps/mobile/.env.dev` y `apps/mobile/.env.qa` (análogos al `.env.production` ya existente, que pasa a apuntar al stack `prod` renombrado).
- `apps/web` queda explícitamente **fuera de alcance**: sigue desplegándose solo desde `master` a GitHub Pages, sin ambientes adicionales, hasta que se decida un mecanismo de hosting distinto de GitHub Pages (que no soporta múltiples ambientes de forma nativa).
- Se documenta la convención de branching (squash merge de features hacia `develop`; corte de `release/X.Y.Z` desde `develop` sin merge commit; promoción a `master` solo por fast-forward + tag de versión; sync de vuelta a `develop` vía un único merge real) como guía de trabajo, no como mecanismo forzado por tooling.
- Los 3 stacks (`poker-planning-dev`, `poker-planning-qa`, `poker-planning-prod`) se crean desde cero — el stack único anterior fue eliminado por el usuario durante la implementación, así que no hay orden de despliegue obligatorio ni migración de datos entre ellos.
- `apps/mobile/.env.dev`, `.env.qa`, `.env.production` y la constante `wsUrl` de `apps/web/src/environments/environment.aws.ts` quedan con placeholders inválidos a propósito (`PENDIENTE-desplegar-stack-...`) hasta que cada stack se despliegue y se conozca su URL real — así un intento de build/uso antes de tiempo falla de forma visible (error de conexión) en vez de conectarse silenciosamente a algo incorrecto o a una URL de un stack que ya no existe.

## Capabilities

### New Capabilities

(ninguna — este cambio extiende capacidades de deployment ya existentes, no introduce funcionalidad de producto nueva)

### Modified Capabilities

- `backend-deployment`: pasa de desplegar automáticamente un único stack en cada push a `master`, a soportar tres ambientes (`dev`/`qa`/`prod`) con triggers distintos por rama (`develop` manual, `release/*` y `master` automáticos) y un mecanismo de rollback a `prod` vía re-deploy de un ref/tag específico sin mover `master`.
- `mobile-preview-builds`: el disparo manual del build pasa de apuntar siempre al backend de producción (`apps/mobile/.env.production`), a aceptar un input de ambiente que selecciona el `.env` correspondiente, permitiendo generar un build con cualquier combinación de perfil EAS (empaquetado) y ambiente (backend).

## Impact

- `infra/samconfig.toml`: nuevas secciones de ambiente (`[dev.deploy.parameters]`, `[qa.deploy.parameters]`, `[prod.deploy.parameters]`), cada una con su `stack_name` y `parameter_overrides = "Environment=<ambiente>"`.
- `infra/template.yaml`: nuevo parámetro `Environment` (`dev`/`qa`/`prod`) usado para calcular `TableName`/`Name`/`StageName` con sufijo, de forma uniforme en los 3 ambientes — hallazgo durante la implementación, ver `design.md` (Decisión 1).
- `.github/workflows/deploy-backend.yml`: se extiende con lógica de ambiente por rama + inputs de `workflow_dispatch`.
- `.github/workflows/build-mobile.yml`: gana input de ambiente y paso de selección de `.env`.
- `apps/mobile/eas.json`: sin cambios (los perfiles existentes se mantienen tal cual).
- `apps/mobile/.env.dev`, `.env.qa`, `.env.production`: con placeholder inválido hasta que cada stack real exista (ver "What Changes").
- `apps/web/src/environments/environment.aws.ts`: constante `wsUrl` con placeholder inválido por la misma razón. No se toca `deploy-web.yml` ni se agregan ambientes nuevos de hosting para `web`.
- Ramas del repositorio: se formalizan `develop`, `release/*` y `master` como ramas de trabajo con significado operativo (hoy solo existe `master`).
- Cuenta de AWS: se crean 3 stacks CloudFormation nuevos (`poker-planning-dev`, `poker-planning-qa`, `poker-planning-prod`) — el stack único anterior fue eliminado. El Role IAM de OIDC existente (`docs/aws-oidc-setup.md`) necesita permisos sobre los 3.
