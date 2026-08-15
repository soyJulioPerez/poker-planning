## Why

Al verificar la Fase 4.2 (`add-backend-alarms`), forzando errores reales para probar que la alarma de `Errors` de Lambda dispara, se encontró que `connect.ts` y `disconnect.ts` no tienen `try`/`catch` alrededor de la mayor parte de su cuerpo — un fallo real ahí no deja ningún log JSON estructurado, solo el crash crudo con el que Lambda reporta una excepción no controlada. Revisando `default.ts` para confirmar que no tuviera el mismo problema, se encontró que sí lo tiene, acotado a sus dos primeras líneas (extracción de `connectionId`/`apiEndpoint` desde `event.requestContext`, antes de su `try`/`catch` existente).

## What Changes

- `connect.ts`: todo el cuerpo queda envuelto en `try`/`catch`. Un fallo real se loguea (`connection.open_failed`, con `connectionId`, error y stack) y se relanza.
- `disconnect.ts`: un `try`/`catch` exterior nuevo cubre lo que hoy no está protegido (extracción de `connectionId`, el `GetCommand` inicial, el `UpdateCommand`, el `DeleteCommand` final). Loguea `connection.close_failed` y relanza. El `try`/`catch` existente del broadcast best-effort (`connection.broadcast_failed`, que no relanza) queda intacto, anidado adentro.
- `default.ts`: las dos líneas de extracción de `connectionId`/`apiEndpoint` (antes del `try`/`catch` de `JSON.parse` ya existente) quedan envueltas en su propio `try`/`catch` chico. Loguea `action.malformed_event` (sin `connectionId`, no se conoce en este punto) y relanza. El resto del handler no cambia.
- Tests nuevos: `connect.spec.ts` (no existe hoy), un test nuevo en `disconnect.spec.ts` para el catch exterior, y un `default.spec.ts` mínimo (no existe hoy) acotado a este caso.
- `docs/known-issues.md`: corregir la entrada que documentó este hallazgo — decía que `default.ts` estaba completamente cubierto, y no es exacto.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `observability`: agrega el requisito de que un error al abrir/cerrar una conexión, o un evento sin el contexto mínimo esperado, tampoco desaparezca en silencio — hoy esa garantía solo cubre el procesamiento de las 10 acciones de `default.ts`.

## Impact

- `apps/realtime-api/src/handlers/connect.ts`, `disconnect.ts`, `default.ts`.
- `apps/realtime-api/src/handlers/connect.spec.ts` (nuevo), `disconnect.spec.ts` (extendido), `default.spec.ts` (nuevo).
- `docs/known-issues.md`: corrección de precisión.
- Sin cambios de infraestructura — es código de aplicación puro, no toca `infra/template.yaml`.
- Comportamiento observable por el cliente: sin cambios en los casos normales. En los casos de fallo real, `connect.ts` y `default.ts` pasan de comportamiento indefinido (dependía de dónde exactamente reventaba) a una falla consistente y logueada.
