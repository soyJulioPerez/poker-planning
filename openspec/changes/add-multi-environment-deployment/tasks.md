## 1. Infraestructura (SAM)

Sin usuarios reales ni datos que proteger (el stack único anterior fue eliminado) — los 3 stacks se crean desde cero, en cualquier orden.

- [x] 1.1 Agregar `[dev.deploy.parameters]` a `infra/samconfig.toml` con `stack_name` (`poker-planning-dev`)
- [x] 1.2 Agregar `[qa.deploy.parameters]` a `infra/samconfig.toml` con `stack_name` (`poker-planning-qa`)
- [x] 1.3 Agregar `[prod.deploy.parameters]` a `infra/samconfig.toml` con `stack_name` (`poker-planning-prod`)
- [x] 1.3b Agregar el parámetro `Environment` a `infra/template.yaml` para sufijar `TableName`/`Name`/`StageName` de forma uniforme en los 3 ambientes
- [x] 1.4 Ampliar la policy/trust del Role de IAM (OIDC) existente para cubrir los `stack_name` nuevos — aplicado en AWS (`aws iam put-role-policy`)
- [x] 1.5 Desplegar el stack `dev` (`sam deploy --config-env dev`) — `poker-planning-rooms-dev`, `wss://difph1tcve.execute-api.us-east-2.amazonaws.com/dev`. (Nota: el primer intento usó un build cacheado desactualizado de `.aws-sam/build/` sin el parámetro `Environment`; se corrigió con `sam build` fresco antes de redesplegar)
- [x] 1.6 Desplegar el stack `qa` (`sam deploy --config-env qa`) — `poker-planning-rooms-qa`, `wss://49dfk436k7.execute-api.us-east-2.amazonaws.com/qa`
- [x] 1.7 Desplegar el stack `prod` (`sam deploy --config-env prod`) — `poker-planning-rooms-prod`, `wss://nv52vd8su1.execute-api.us-east-2.amazonaws.com/prod`

## 2. Ramas de git

- [x] 2.1 Crear la rama `develop` desde `master` — creada y pusheada
- [x] 2.2 Crear una rama `release/*` inicial de prueba desde `develop` — `release/1.0.0`, creada y pusheada

## 3. Pipeline de backend (`deploy-backend.yml`)

- [x] 3.1 Agregar trigger de `push` para `release/**` (además del ya existente para `master`), manteniendo los `paths` actuales
- [x] 3.2 Agregar lógica para derivar el ambiente (`prod` si la rama es `master`, `qa` si matchea `release/**`) y pasarlo como `--config-env` a `sam deploy`
- [x] 3.3 Agregar inputs a `workflow_dispatch`: `environment` (`dev`/`qa`/`prod`, requerido) y `ref` (opcional, para rollback de `prod` sin mover `master`)
- [x] 3.4 Cuando se provee `ref`, hacer checkout de ese ref específico antes de `sam build`/`sam deploy`, sin mover ningún puntero de rama
- [x] 3.5 Verificar que un push a `develop` NO dispara el workflow automáticamente — verificado: `gh run list --branch develop` no muestra ninguna corrida

## 4. Mobile — archivos de ambiente

- [x] 4.1 Actualizar `apps/mobile/.env.dev` con la URL WebSocket real del stack `dev`
- [x] 4.2 Actualizar `apps/mobile/.env.qa` con la URL WebSocket real del stack `qa`
- [x] 4.3 Actualizar `apps/mobile/.env.production` con la URL WebSocket real del stack `prod`

## 5. Web — actualizar apuntado a producción

- [x] 5.1 Actualizar la constante `wsUrl` en `apps/web/src/environments/environment.aws.ts` con la URL WebSocket real del stack `prod`

## 6. Pipeline de mobile (`build-mobile.yml`)

- [x] 6.1 Agregar input `environment` (`dev`/`qa`/`prod`) a `workflow_dispatch`, independiente del input/selección de perfil EAS existente
- [x] 6.2 Agregar paso que selecciona/copia el `.env.<environment>` correspondiente antes de invocar `eas build`
- [x] 6.3 Verificar que `apps/mobile/eas.json` no requiere cambios (los perfiles `development`/`preview`/`production` se mantienen tal cual)
- [x] 6.4 Probar la combinación perfil `preview` + `environment: dev` para confirmar que el desacople funciona — verificado en vivo, run [31135319827](https://github.com/soyJulioPerez/poker-planning/actions/runs/31135319827), éxito en 9m46s

## 7. Documentación

- [x] 7.1 Documentar la convención de branching (squash a `develop`, corte de `release/X.Y.Z`, fast-forward + tag hacia `master`, sync de vuelta a `develop`) — se creó `docs/git-branching-strategy.md`
- [x] 7.2 Actualizar `docs/mobile-preview-builds.md` para reflejar el nuevo input de ambiente y quitar la limitación ya resuelta ("comparte el backend de producción")
- [x] 7.3 Actualizar `docs/aws-deployment.md` con la nueva nomenclatura de stacks y el flujo de rollback de `prod`
- [x] 7.4 Actualizar `README.md` (sección "Despliegue a AWS") para mencionar los 3 ambientes

## 8. Verificación end-to-end

- [x] 8.1 Push a la rama `release/*` de prueba despliega automáticamente al stack `qa`, sin tocar `dev` ni `prod` — verificado en vivo, run [31134640527](https://github.com/soyJulioPerez/poker-planning/actions/runs/31134640527), éxito en 2m37s
- [x] 8.2 Disparo manual de `workflow_dispatch` con `environment: dev` despliega al stack `dev` — verificado en vivo, run [31135550135](https://github.com/soyJulioPerez/poker-planning/actions/runs/31135550135), éxito en 2m30s. Nota: `gh workflow run` sin `--ref` toma la definición del workflow en `master` (desactualizada, sin el input `environment`, hasta que 8.3 mergee); hay que apuntar explícitamente `--ref develop` (o la rama que corresponda) al disparar manualmente antes del merge a `master`
- [ ] 8.3 Push a `master` despliega al stack `prod` automáticamente
- [ ] 8.4 Disparo manual de `workflow_dispatch` con `environment: prod` y `ref` a un tag anterior redepliega esa versión sin mover el puntero de `master`
- [x] 8.5 Build de mobile conecta al ambiente elegido, desacoplado del perfil — verificado con `environment: dev` (run [31135319827](https://github.com/soyJulioPerez/poker-planning/actions/runs/31135319827)) en vez de `qa` como decía la redacción original; mismo mecanismo, misma cobertura
- [ ] 8.6 La web publicada en GitHub Pages conecta al stack `prod`

Todas las tareas de la sección 8 requieren que 1.4–1.7 (AWS real) y 2.1–2.2 (ramas) estén resueltas primero — quedan pendientes de una sesión donde el maintainer tenga credenciales AWS a mano.
