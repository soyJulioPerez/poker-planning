# Los tres Lambdas dejan de ser una caja negra

## Why

Hay tres ambientes reales corriendo en AWS y **cero logging útil**. No es una exageración: `default.ts` —el handler que enruta las 10 acciones, donde vive toda la lógica de dominio— no tiene un solo `console.log`. Su `catch` externo manda el error al cliente por WebSocket y ahí termina; CloudWatch nunca se entera.

```ts
} catch (error) {
  await sendToConnection(apiEndpoint, connectionId, { type: 'error', message: ... });
}
// nada llega a CloudWatch. Si esto explota en prod, no hay rastro.
```

`connect.ts` y `disconnect.ts` sí tienen un `console.log` de texto plano cada uno, pero son los dos handlers que menos lógica ejecutan.

**Por qué ahora**: hay tres ambientes reales (`dev`, `qa`, `prod`) y el criterio práctico de esta fase —*"¿qué pasó en la sala ABC123 hace 20 minutos?"*— hoy no se puede contestar sin agregar un `console.log` y volver a desplegar.

## What Changes

**Logging estructurado con AWS Lambda Powertools**, no una función casera.
- `@aws-lambda-powertools/logger` en los tres handlers (`connect`, `disconnect`, `default`).
- Es la práctica establecida para observabilidad en Lambda+Node: define la forma del log JSON, agrega contexto de la invocación (cold start, request ID) sin código propio, y dado que también trae `Tracer` y `Metrics` en la misma familia de paquetes, las Fases 4.2 y 4.3 no arrancan de cero cuando les toque.
- Se instala solo `Logger` en este change. `Tracer`/`Metrics` quedan para cuando 4.3/4.2 los necesiten de verdad — mismo criterio que sacar `@nx/node` la semana pasada: no cargar dependencia sin uso.

**El logging se centraliza en `default.ts`**, no se repite en las 10 acciones.
- Un log de entrada antes del `switch` (`action.received`, con `connectionId`, `action`, `roomId` si el mensaje lo trae) y uno de salida después (`action.done` con `durationMs`, o `action.failed` con el error completo si el `catch` externo lo atrapa).
- Cubre las 10 acciones con un solo punto de instrumentación, en vez de tocar cada archivo de `actions/`.

**`handleCreateRoom` pasa a devolver el `roomId` que genera.**
- Es el único mensaje sin `roomId` en el request —la sala todavía no existe cuando llega—. Sin este cambio, la creación de una sala quedaría fuera de "cada log de acción incluye `roomId`". Cambio de firma mínimo: `Promise<void>` → `Promise<string>`.

**`connect.ts` y `disconnect.ts` migran de `console.log` a `Logger`.**
- De paso, el `catch` silencioso de `disconnect.ts` —el broadcast best-effort que hoy se traga cualquier error sin dejar rastro— pasa a loguearse como advertencia. Sigue sin relanzar (es best-effort a propósito), pero deja de ser invisible.

**Una query de CloudWatch Logs Insights, documentada y probada contra `dev`.**
- Nuevo `docs/aws-observability.md`, con la query que contesta la pregunta práctica del criterio de aceptación.

## Capabilities

### New Capabilities

- `observability`: qué garantiza el backend sobre sus propios logs — formato, campos obligatorios, y que un error nunca desaparece en silencio.

## Impact

**Código**
- `apps/realtime-api/src/lib/logger.ts` — nuevo, instancia compartida de `Logger`.
- `apps/realtime-api/src/handlers/connect.ts`, `disconnect.ts`, `default.ts` — migran a `Logger`.
- `apps/realtime-api/src/actions/create-room.ts` — `handleCreateRoom` devuelve `roomId`.
- `package.json` — `@aws-lambda-powertools/logger` en `dependencies` (se usa en runtime, no solo en build).

**Documentación**
- `docs/aws-observability.md` — nuevo.
- `docs/hardening-roadmap.md` — cierre de 4.1.

**Sin cambios de comportamiento del producto.** Nada de lo que ve un usuario cambia; solo lo que queda registrado del lado del servidor.

**Verificación con AWS real**: el último criterio —la query probada contra `dev`— necesita un deploy real al ambiente `dev` y una consulta contra CloudWatch Logs Insights de esa cuenta. Es una acción sobre infraestructura compartida; se marca explícitamente en `tasks.md` para confirmar antes de ejecutarla.

**Fuera de alcance**
- **4.2 — Alarmas en CloudWatch.** Change propio: necesita forzar un error real en `dev` y confirmar que llega la notificación a un email real.
- **4.3 — Tracing con X-Ray.** Change propio, marcado "(opcional)" en el roadmap.
- **Migrar las 10 acciones para que logueen sus propios pasos intermedios.** El log centralizado en `default.ts` ya cubre entrada, salida y error de cada una; loguear *dentro* de cada acción es una granularidad que ninguna parte del roadmap pide todavía.
