## Context

Hasta el inicio de este change existía un único stack de CloudFormation, `poker-planning-dev` (nombre heredado, de facto era el stack de producción), definido por `infra/template.yaml` y desplegado vía `infra/samconfig.toml` (una sola sección `[default.deploy.parameters]`). A ese único stack apuntaban simultáneamente y sin aislamiento: la web en producción (GitHub Pages, `environment.aws.ts`), los builds de preview mobile que usa QA/stakeholders (`apps/mobile/.env.production`, ver `docs/mobile-preview-builds.md`), y las corridas de `npm run test:e2e:aws`.

**Actualización durante la implementación**: el usuario eliminó ese stack (`sam delete`) y confirmó que no hay usuarios en producción en este momento. Esto simplifica el change — ya no hay datos ni tráfico real que proteger durante la migración; los tres stacks (`dev`, `qa`, `prod`) se crean desde cero, sin orden de despliegue obligatorio entre ellos ni riesgo de pérdida de datos reales.

Las salas son efímeras (TTL en DynamoDB, ver README) — no hay historial entre sesiones de todos modos.

Este change fue explorado a fondo con el usuario en modo `/opsx:explore` antes de proponerse; las decisiones de branching, triggers y rollback documentadas abajo reflejan esa conversación, no suposiciones de este documento.

## Goals / Non-Goals

**Goals:**
- Tres stacks de AWS reales e independientes (`dev`, `qa`, `prod`), cada uno con su propia tabla DynamoDB, API Gateway WebSocket y Lambdas — aislamiento real de datos entre QA y producción, que es el dolor concretamente documentado hoy.
- Triggers de deploy backend gobernados por rama: `develop` (manual), `release/*` (automático → qa), `master` (automático → prod).
- Mecanismo de rollback distinto por ambiente: QA se resuelve pisando (push de una versión vieja a `release/*`); PROD se resuelve re-desplegando un ref/tag específico sin reescribir la historia de `master`.
- Mobile puede apuntar a cualquiera de los 3 ambientes, desacoplado del perfil de empaquetado EAS (`development`/`preview`/`production` no cambian de significado).
- Los 3 workflows de CI existentes se extienden, no se reescriben desde cero.

**Non-Goals:**
- `apps/web` con múltiples ambientes — sigue desplegándose solo a `prod` vía GitHub Pages hasta que se decida (en un change futuro) un mecanismo de hosting distinto.
- Un stack QA por cada rama `release/*` — se decidió deliberadamente un único stack QA compartido (ver Decisión 2).
- Enforcement automatizado (branch protection de GitHub) de la convención de fast-forward-only hacia `master` — se documenta como convención de equipo en este change; queda como pregunta abierta si se automatiza después.
- Renombrar o reestructurar los perfiles de `apps/mobile/eas.json` — se mantienen `development`/`preview`/`production` tal cual, describiendo solo empaquetado.

## Decisions

### Decisión 1: Stacks de CloudFormation separados por ambiente, no un stack único con múltiples stages

Cada ambiente (`dev`/`qa`/`prod`) es un stack de CloudFormation completo e independiente (`infra/template.yaml` desplegado 3 veces con distinto `stack_name`), usando las secciones de ambiente nativas de `samconfig.toml` (`sam deploy --config-env qa`).

**Por qué:** el dolor real a resolver es que QA y producción comparten datos — eso solo se resuelve con tablas DynamoDB físicamente distintas. `infra/samconfig.toml` ya soporta múltiples secciones de configuración de forma nativa en SAM CLI, así que esto no requiere tooling nuevo, solo agregar secciones.

**Alternativa considerada:** un único stack con múltiples *stages* de API Gateway (`dev`/`qa`/`prod` como stages de un mismo `WebSocketApi`) — rechazada porque las Lambdas y la tabla DynamoDB seguirían siendo compartidas entre ambientes; no resuelve el problema de aislamiento de datos, solo cambiaría la URL. No es meaningfully más simple que parametrizar `stack_name`, dado que SAM ya lo soporta out-of-the-box.

**Corrección encontrada durante la implementación:** este documento asumía originalmente que `infra/template.yaml` no necesitaba cambios ("ya es parametrizable por stack, no hay valores hardcodeados de ambiente ahí"). Eso era falso: `RoomsTable.TableName` (`poker-planning-rooms`) y `WebSocketApi.Name` (`poker-planning-ws`) eran literales hardcodeados, no derivados de `AWS::StackName` — desplegar un segundo o tercer stack con el template tal cual habría fallado al intentar crear una tabla DynamoDB con un nombre ya existente (los nombres de tabla son únicos por cuenta+región). Se agregó un parámetro `Environment` (`dev`/`qa`/`prod`, default `dev`) al template, usado para calcular `TableName`/`Name`/`StageName` con sufijo uniforme por ambiente (`poker-planning-rooms-${Environment}`, etc.), incluido `dev`.

Nota técnica (ya sin consecuencia práctica, dado que el stack `dev` anterior fue eliminado — ver Context): `TableName` es una propiedad *create-only* en CloudFormation (verificado contra el schema público vía `aws cloudformation describe-type`), así que si en el futuro se quisiera cambiar el nombre de una tabla ya desplegada, CloudFormation la reemplaza (crea una nueva vacía, borra la anterior) en vez de renombrarla in-place — vale tenerlo presente para cualquier cambio de nomenclatura futuro sobre un stack con datos reales. `Name` de la API sí se actualiza in-place sin ese problema.

### Decisión 2: Un único stack QA compartido, sin importar qué rama `release/*` lo dispare

Cualquier push a cualquier rama que matchee `release/**` despliega y pisa el mismo stack `poker-planning-qa`.

**Por qué:** es un proyecto de un solo desarrollador; nunca hay dos releases en curso en paralelo en la práctica. El comportamiento de "pisar" además funciona como mecanismo de rollback en QA sin necesitar nada adicional: pushear un tag viejo a una rama `release/*` vuelve a desplegar esa versión.

**Alternativa considerada:** un stack QA por rama de release (parametrizado con el nombre/versión) — rechazada como flexibilidad que nadie pidió todavía, consistente con el precedente de `automate-backend-deploy` de no construir mecanismos de promoción/multi-stage sin necesidad concreta.

### Decisión 3: `develop` no despliega automáticamente

Push a `develop` no dispara CI; el ambiente `dev` se despliega solo cuando el desarrollador lo dispara manualmente (`workflow_dispatch`).

**Por qué:** `develop` puede recibir commits frecuentes de trabajo en progreso (squash merges de features chicos); auto-desplegar cada uno sería ruido y podría dejar el stack `dev` en un estado intermedio roto mientras se itera. El disparo manual le da al desarrollador control sobre el momento.

**Alternativa considerada:** auto-deploy en cada push a `develop`, igual que `qa`/`master` — rechazada por la razón de ruido/estado intermedio arriba.

### Decisión 4: Rollback de PROD vía input de `ref` en `workflow_dispatch`, nunca force-push a `master`

Para revertir producción a una versión anterior, el workflow de deploy backend acepta un input opcional `ref` (tag/commit) en su disparo manual, y despliega ese ref al stack `prod` **sin mover el puntero de la rama `master`**.

**Por qué:** de todo este diseño, `master` es la única rama protegida explícitamente contra reescritura de historia (los merges hacia ella son siempre fast-forward — Decisión de branching, ver abajo). Permitir force-push como mecanismo de rollback rompería esa garantía justo en la rama que más importa mantener predecible, y force-push es en general una operación de mayor riesgo que vale la pena evitar cuando hay una alternativa igual de simple.

**Alternativa considerada:** el mismo mecanismo de "pisar por push" que QA, aplicado también a `master` — rechazada específicamente para PROD por el mayor blast radius de reescribir la rama que representa "lo que está vivo", aunque hubiera sido más simple de implementar de forma uniforme entre los 3 ambientes.

### Decisión 5: Ambiente de mobile como input separado del workflow, no como perfil EAS

`apps/mobile/eas.json` mantiene sus 3 perfiles actuales (`development`/`preview`/`production`, que describen únicamente el tipo de empaquetado). El ambiente (`dev`/`qa`/`prod`) es un input independiente del workflow `build-mobile.yml`, que selecciona el `.env.<ambiente>` correspondiente antes de invocar `eas build --profile <perfil>`.

**Por qué:** mantiene ortogonales dos ejes que son conceptualmente independientes — cómo se empaqueta vs. a qué backend apunta. Permite combinaciones como un apk `preview` apuntando a `dev` para debug puntual, sin necesitar un perfil EAS nuevo por cada combinación.

**Alternativa considerada (y descartada tras revisión del propio usuario durante la exploración):** renombrar los 3 perfiles EAS a `dev`/`qa`/`prod`, colapsando empaquetado y ambiente en un solo concepto — más simple de leer en el momento del disparo (`--profile qa` ya dice todo), pero fuerza a crear un perfil nuevo por cada combinación futura de empaquetado × ambiente.

### Decisión 6: Convención de branching documentada, no forzada por tooling en este change

Se documenta como práctica de equipo: features → `develop` por squash merge; corte de `release/X.Y.Z` desde `develop` (rama, no merge); bugfixes de estabilización commiteados directo sobre `release/X.Y.Z`; promoción a `master` solo por fast-forward (`git merge --ff-only`) + tag de versión — si no puede hacer fast-forward, falla en vez de crear un merge commit; sync de vuelta a `develop` vía un único merge real (el único aceptado en todo el flujo). Limpieza de ramas `release/*` tras merge queda a criterio del desarrollador, sin política automática.

**Por qué documentar y no automatizar (branch protection rules de GitHub) en este change:** habilitar reglas de protección de rama es un paso de configuración manual en la consola de GitHub, similar en naturaleza al bootstrap manual de OIDC (`docs/aws-oidc-setup.md`) — un paso único, fuera de CI, que puede añadirse como follow-up sin bloquear la capacidad central de este change (desplegar a 3 ambientes). Queda como pregunta abierta.

## Risks / Trade-offs

- **[Risk]** Triplicar los stacks triplica el alcance de recursos AWS que el Role de OIDC necesita gestionar. → **Mitigación**: escopar los ARNs de la policy IAM por convención de nombre (`poker-planning-*`) en vez de ampliar a permisos más laxos, consistente con la filosofía de mínimo privilegio ya documentada en `docs/aws-oidc-setup.md`.
- **[Risk]** El patrón `release/**` matchea cualquier rama con ese prefijo — una rama experimental nombrada por error `release/algo` desplegaría silenciosamente al stack QA compartido. → **Mitigación**: ninguna automática en este change; queda documentado como filo conocido y como pregunta abierta (posible ajuste futuro del patrón, ej. `release/v*`).
- **[Trade-off]** Extender los 3 workflows existentes con lógica condicional de ambiente (en vez de crear workflows nuevos por ambiente) los hace más complejos de leer individualmente. → **Aceptado**: mantiene la cantidad de archivos de workflow estable y evita triplicar código de checkout/setup/build casi idéntico.
- **[Trade-off]** La convención de git (ff-only hacia `master`, squash hacia `develop`) depende de la disciplina del desarrollador mientras no haya branch protection configurado. → **Aceptado** para este change; ver Decisión 6.

## Migration Plan

Sin usuarios reales ni datos que proteger (ver Context), no hay orden de despliegue obligatorio entre `dev`/`qa`/`prod` — los 3 se crean desde cero y pueden desplegarse en cualquier orden.

1. Agregar `[dev.deploy.parameters]`, `[qa.deploy.parameters]`, `[prod.deploy.parameters]` a `infra/samconfig.toml`. *(hecho)*
2. Agregar el parámetro `Environment` a `infra/template.yaml` para nombres de recursos con sufijo uniforme en los 3 ambientes. *(hecho)*
3. Ampliar permisos/trust del Role de OIDC existente para cubrir los `stack_name` nuevos (`docs/aws-oidc-setup.md` — JSON actualizado, falta aplicar en AWS).
4. Desplegar los 3 stacks desde cero (`sam deploy --config-env dev|qa|prod`, en cualquier orden). Anotar la `WebSocketUrl` de cada output.
5. Actualizar `apps/mobile/.env.dev`, `.env.qa`, `.env.production` y la constante `wsUrl` en `apps/web/src/environments/environment.aws.ts` con las URLs reales del paso 4 (hoy tienen placeholders inválidos a propósito). Verificar que web y mobile conectan correctamente a sus respectivos ambientes.
6. Extender `.github/workflows/deploy-backend.yml`: mapeo rama → ambiente, e inputs de `workflow_dispatch` (`environment`, `ref` opcional). *(hecho)*
7. Extender `.github/workflows/build-mobile.yml` con el input de ambiente y el paso de selección de `.env`. *(hecho)*
8. Crear las ramas `develop` y una `release/*` inicial en el repo (hoy solo existe `master`).
9. Documentar la convención de branching. *(hecho — `docs/git-branching-strategy.md`)*
10. Verificar end-to-end: push a una rama `release/*` de prueba despliega QA; disparo manual despliega DEV; push a `master` despliega PROD; la web en GitHub Pages y los builds mobile "de producción" conectan al stack `prod`.

**Rollback de este change:** deshabilitar los nuevos triggers revierte al comportamiento actual de un solo stack en `master`; los stacks `dev`/`qa` nuevos pueden eliminarse de forma independiente (`sam delete`) sin afectar `prod`.

## Open Questions

- ¿Se configuran branch protection rules de GitHub sobre `master` (requerir historia lineal, restringir force-push) como parte de este change, o queda como convención documentada únicamente por ahora?
- ¿Vale la pena acotar el patrón `release/**` (ej. `release/v*`) para reducir el riesgo de una rama experimental disparando un deploy accidental a QA?
- ¿Dónde vive la documentación de la convención de branching — un doc nuevo (`docs/git-branching-strategy.md`) o una sección agregada a un doc existente?
