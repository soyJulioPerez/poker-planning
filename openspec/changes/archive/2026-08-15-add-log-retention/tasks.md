# Tareas — Los logs dejan de acumularse para siempre

> **Los grupos 4, 6 y 7 tocan infraestructura compartida real.** Confirmar antes de cada
> uno, en el orden que están: `dev` primero, `prod` al final y con más cuidado —
> ver Decisión 3 del `design.md` antes de tocar el huérfano de `prod`.

## 1. Punto de partida

- [x] 1.1 Confirmar la retención actual: `aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/poker-planning-dev" --query "logGroups[].retentionInDays"` (con `MSYS_NO_PATHCONV=1` en Git Bash) debe dar `None` para los tres.
- [x] 1.2 Confirmar que `qa` no tiene log groups todavía (sus Lambdas nunca se invocaron): la misma consulta con prefijo `poker-planning-qa` debe dar vacío.
- [x] 1.3 Confirmar los tres nombres físicos activos por ambiente (`dev`, `qa`, `prod`), vía `aws cloudformation list-stack-resources --query "StackResourceSummaries[?ResourceType=='AWS::Lambda::Function'].PhysicalResourceId"`. Van a hacer falta en el grupo 5/7 para identificar los huérfanos transicionales.

## 2. `Mappings` de retención

- [x] 2.1 Agregar `Mappings.LogRetention` a `infra/template.yaml`: `dev: 7`, `qa: 7`, `prod: 14`.

## 3. Los tres `AWS::Logs::LogGroup`

- [x] 3.1 `ConnectLogGroup`, `DisconnectLogGroup`, `DefaultLogGroup`, con `LogGroupName: !Sub '/aws/lambda/poker-planning-${Environment}-<nombre>'` y `RetentionInDays: !FindInMap [LogRetention, !Ref Environment, Days]`.
- [x] 3.2 Agregar `LoggingConfig: { LogGroup: !Ref <Nombre>LogGroup }` a las `Properties` de cada una de las tres funciones.
- [x] 3.3 Validar la sintaxis del template antes de desplegar: `sam validate` (o el equivalente que use el flujo de deploy existente).

## 4. Deploy a `dev` — confirmar antes de ejecutar

- [x] 4.1 `nx deploy realtime-api --configuration=dev`.
- [x] 4.2 Generar una acción real (por ejemplo, `createRoom` por WebSocket) y confirmar que el log aparece en el log group **nuevo** (`/aws/lambda/poker-planning-dev-default`), no en el viejo.
- [x] 4.3 Confirmar la retención del log group nuevo: `RetentionInDays: 7`.

## 5. Limpieza en `dev`

- [x] 5.1 Identificar el/los log group(s) auto-generados que quedaron huérfanos con esta transición (los 3 nombres físicos confirmados en 1.3, que ya no reciben escritura).
- [x] 5.2 Borrarlos directamente — son descartables, mismo criterio que la limpieza del 2026-08-14.

## 6. Deploy a `qa` — confirmar antes de ejecutar

- [x] 6.1 `nx deploy realtime-api --configuration=qa`.
- [x] 6.2 Confirmar que los tres log groups nuevos existen con `RetentionInDays: 7`. Sin huérfanos que limpiar acá: `qa` no tenía logs previos.

## 7. Deploy a `prod` — confirmar antes de ejecutar, tratamiento distinto

- [x] 7.1 `nx deploy realtime-api --configuration=prod`.
- [x] 7.2 Confirmar que los tres log groups nuevos existen con `RetentionInDays: 14`.
- [x] 7.3 **No borrar** el/los huérfano(s) transicional(es) de `prod`. En su lugar: `aws logs put-retention-policy --log-group-name <el viejo> --retention-in-days 14`. Puede tener historial real de producción — se deja expirar solo, no se destruye de un saque.
- [x] 7.4 Confirmar que la retención quedó aplicada sobre el huérfano de `prod`.

## 8. Documentación

- [x] 8.1 `docs/aws-observability.md`: actualizar *"Encontrar el log group correcto"` — el nombre ya es predecible, no hace falta `describe-stack-resource` para las funciones desplegadas después de este change.
- [x] 8.2 `docs/hardening-roadmap.md`: nota breve sobre la retención agregada, enlazando este change. No es parte del criterio original de 4.1; se anota como su continuación directa.
