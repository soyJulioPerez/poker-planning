# Los logs dejan de acumularse para siempre

## Why

Ningún log group de `realtime-api` tiene retención configurada. `infra/template.yaml` no declara ningún `AWS::Logs::LogGroup`, así que SAM deja que Lambda los cree automáticamente con el default de CloudWatch: **retención infinita**. Aplica a los tres ambientes por igual —el template es el mismo—.

**Y hay un segundo problema, del mismo origen.** El log group nace atado al nombre físico aleatorio de la función (`...-ConnectFunction-Xb1PWg5b3Dwb`). Cada vez que CloudFormation reemplaza una función —pasó varias veces en esta sesión: cambios de runtime, de configuración del build—, el log group viejo queda **huérfano**: sin nadie que lo administre, con retención infinita, invisible hasta que alguien lo va a buscar. Verificado el 2026-08-14: `dev` tenía 12 log groups, y solo 3 pertenecían al stack activo. Los otros 9 se borraron a mano, una vez — pero el mecanismo que los generó sigue intacto.

**Por qué ahora**: la Fase 4.1 dejó los logs con contenido útil por primera vez. Sin retención ni gestión del log group, ese contenido útil se va a acumular para siempre y va a seguir generando huérfanos en cada reemplazo de función futuro.

## What Changes

**El log group pasa a ser un recurso propio del stack**, no un efecto secundario de Lambda.
- Un `AWS::Logs::LogGroup` por función (`ConnectLogGroup`, `DisconnectLogGroup`, `DefaultLogGroup`), con nombre fijo y legible: `/aws/lambda/poker-planning-<ambiente>-connect`, siguiendo la misma convención que ya usan la tabla (`poker-planning-rooms-<ambiente>`) y la API (`poker-planning-ws-<ambiente>`).
- Cada función referencia su log group vía `LoggingConfig.LogGroup`. Es una propiedad mutable de Lambda (Advanced Logging Controls); cambiarla actualiza la función en su lugar, no la reemplaza.

**Esto resuelve retención y huérfanos con el mismo cambio.** Un log group con nombre fijo, gestionado por CloudFormation, sobrevive al reemplazo de la función que lo usa — deja de nacer huérfano en cada redeploy que fuerce un reemplazo.

**Retención diferenciada por ambiente**, vía `Mappings` indexado por el parámetro `Environment` que ya existe:

| Ambiente | Retención |
|---|---|
| `dev` | 7 días |
| `qa` | 7 días |
| `prod` | 14 días |

**Transición de una sola vez**: los log groups auto-generados que hoy están activos (3 en `dev`, 3 en `prod`; `qa` no tiene ninguno, sus Lambdas nunca se invocaron) quedan huérfanos apenas se despliegue este cambio — la función pasa a escribir en el log group nuevo. Se tratan distinto según el ambiente: los de `dev` son descartables (ya se limpiaron una vez); el de `prod` puede tener historial real de producción, así que no se borra de un saque — se le fija una retención y se deja expirar solo.

## Capabilities

### Modified Capabilities

- `observability`: se agrega el requirement de que los logs no se retienen indefinidamente, y de que el ciclo de vida del log group no depende del ciclo de vida de la función que escribe en él.

## Impact

**Infraestructura**
- `infra/template.yaml` — `Mappings.LogRetention`, tres recursos `AWS::Logs::LogGroup`, `LoggingConfig` en las tres funciones.

**Documentación**
- `docs/aws-observability.md` — la sección *"Encontrar el log group correcto"* se simplifica: el nombre pasa a ser predecible, no hace falta `describe-stack-resource`.
- `docs/hardening-roadmap.md` — nota de cierre parcial de la Fase 4 (retención no estaba en el criterio original de 4.1, pero es la continuación directa).

**Verificación con AWS real**: deploy a los tres ambientes y limpieza de los huérfanos transicionales. Acción sobre infraestructura compartida — se confirma antes de ejecutar, igual que el resto de esta fase.

**Fuera de alcance**
- **`LogFormat`, `ApplicationLogLevel`, `SystemLogLevel`** — las otras propiedades de Advanced Logging Controls. Powertools ya da formato JSON a nivel de aplicación; esto es un cambio de nivel de plataforma, sin relación con retención.
- **Alarmas y tracing** — Fases 4.2 y 4.3, sin cambios.
