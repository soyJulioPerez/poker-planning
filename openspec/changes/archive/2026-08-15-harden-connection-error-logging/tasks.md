## 1. Handlers

- [x] 1.1 `connect.ts`: envolver el cuerpo completo en `try`/`catch`. Loguear `connection.open_failed` con `connectionId`, error y stack. Relanzar.
- [x] 1.2 `disconnect.ts`: agregar un `try`/`catch` exterior nuevo que cubra la extracción de `connectionId`, el `GetCommand` inicial, el `UpdateCommand` y el `DeleteCommand` final. Loguear `connection.close_failed` con el contexto disponible, error y stack. Relanzar. No tocar el `try`/`catch` existente del broadcast best-effort — queda anidado adentro tal cual está.
- [x] 1.3 `default.ts`: envolver las dos líneas iniciales (extracción de `connectionId` y `apiEndpoint`) en un `try`/`catch` propio, separado del de `JSON.parse`. Loguear `action.malformed_event` con error y stack (sin `connectionId`, no se conoce en este punto). Relanzar.

## 2. Tests

- [x] 2.1 Crear `connect.spec.ts`: camino feliz (conecta y loguea `connection.open`) y el catch nuevo (el `PutCommand` falla, loguea `connection.open_failed`, la promesa rechaza).
- [x] 2.2 Extender `disconnect.spec.ts`: un test para el catch exterior nuevo (por ejemplo, el `GetCommand` inicial falla, loguea `connection.close_failed`, la promesa rechaza).
- [x] 2.3 Crear `default.spec.ts` mínimo: un evento sin `requestContext` loguea `action.malformed_event` y la promesa rechaza.
- [x] 2.4 `nx test/lint/build realtime-api`.

## 3. Documentación

- [x] 3.1 Corregir la entrada de `docs/known-issues.md` sobre este hallazgo: aclarar que el hueco de las líneas de extracción del contexto del evento es compartido por los tres handlers, distinguiéndolo de las llamadas a DynamoDB de `connect`/`disconnect` (esas sí con valor real de producción).

## 4. Verificación contra `dev` real

- [x] 4.1 Desplegar a `dev`.
- [x] 4.2 Repetir `aws lambda invoke --payload '{}'` contra `ConnectFunction` (la misma prueba que forzó la alarma en la Fase 4.2).
- [x] 4.3 Confirmar en CloudWatch Logs que esta vez aparece `connection.open_failed` en JSON estructurado, no el crash crudo de Lambda visto anteriormente.
