# Tareas — Los tres Lambdas dejan de ser una caja negra

> **El grupo 6 toca infraestructura compartida real (`dev`).** Confirmar antes de correrlo,
> igual que se hizo con los deploys de la Fase 1. Todo lo anterior es local.

## 1. Punto de partida

- [x] 1.1 Confirmar que `default.ts` no tiene logging: `grep -n "console\.\|logger\." apps/realtime-api/src/handlers/default.ts` debe dar vacío.
- [x] 1.2 Confirmar la versión de Powertools a instalar: `npm view @aws-lambda-powertools/logger version`.

## 2. Instalar y configurar Powertools

- [x] 2.1 `npm install @aws-lambda-powertools/logger` — **sin `-D`**: se usa en runtime, va a `dependencies`, igual que los `@aws-sdk/*`.
- [x] 2.2 Crear `apps/realtime-api/src/lib/logger.ts` con una instancia única de `Logger`, `serviceName: 'realtime-api'`.

## 3. `handleCreateRoom` devuelve el `roomId`

- [x] 3.1 Cambiar la firma de `handleCreateRoom` en `create-room.ts` de `Promise<void>` a `Promise<string>`, devolviendo el `roomId` generado.
- [x] 3.2 Confirmar que `create-room.spec.ts` sigue en verde sin tocarlo — los tests actuales no usan el valor de retorno.
- [x] 3.3 `nx build realtime-api` en verde con el nuevo tipo de retorno.

## 4. Centralizar el logging en `default.ts`

- [x] 4.1 Log de entrada (`action.received`) antes del `switch`, con `connectionId`, `action`, y `roomId` si el mensaje lo trae.
- [x] 4.2 Capturar el `roomId` devuelto por `handleCreateRoom` en el `case 'createRoom'` para usarlo en el log de salida de esa acción.
- [x] 4.3 Log de salida (`action.done`) después del `switch`, con `durationMs`.
- [x] 4.4 Log de error (`action.failed`) en el `catch` externo, con el error completo (mensaje + stack) y el mismo contexto — **antes** de `sendToConnection`, no después: si el envío al cliente fallara también, el log de la causa original no debe depender de eso.
- [x] 4.5 Confirmar en el mock del test (o inspección manual) que `logger.error` recibe el objeto `Error`, no solo su mensaje — es lo que hace que Powertools serialice el stack.

## 5. `connect.ts` y `disconnect.ts`

- [x] 5.1 `connect.ts`: reemplazar `console.log('New connection', connectionId)` por `logger.info('connection.open', { connectionId })`.
- [x] 5.2 `disconnect.ts`: reemplazar el `console.log` de texto por `logger.info('connection.close', { connectionId, roomId, name })`.
- [x] 5.3 `disconnect.ts`: agregar `logger.warn('connection.broadcast_failed', { connectionId, roomId, error })` dentro del `catch` mudo del broadcast best-effort, **sin** relanzar la excepción — sigue siendo best-effort, deja de ser invisible.

## 6. Verificación con AWS real — confirmar antes de ejecutar

- [x] 6.1 Deploy a `dev`: `nx deploy realtime-api --configuration=dev`.
- [x] 6.2 Generar actividad real: crear una sala, votar, revelar, desde la web apuntando a `dev` o con un cliente WebSocket de prueba.
- [x] 6.3 En CloudWatch Logs Insights (log group de la función `default`), escribir y probar la query que reconstruye la actividad de esa sala por `roomId` y ventana de tiempo.
- [x] 6.4 Forzar un error real (por ejemplo, un `roomId` inexistente en una acción que no lo valide, o interrumpir la tabla momentáneamente si es seguro) y confirmar que el log de error aparece con stack completo.
- [x] 6.5 Confirmar que el log del `catch` de `disconnect.ts` es alcanzable: no es necesario forzarlo en `dev` si el camino ya se ejercita en los tests unitarios; anotar cuál de las dos vías se usó.

## 7. Documentación

- [x] 7.1 Crear `docs/aws-observability.md` con la query de Logs Insights documentada, y el ejemplo de cómo contestar *"¿qué pasó en la sala X hace N minutos?"*.
- [x] 7.2 `docs/hardening-roadmap.md`: cerrar 4.1, anotando la decisión de Powertools sobre función casera y el hallazgo del `catch` mudo de `disconnect.ts`.
