# Diseño — Los tres Lambdas dejan de ser una caja negra

## Context

```
   handlers/connect.ts       console.log('New connection', connectionId)
   handlers/disconnect.ts    console.log('Connection closed', ...)   + un catch mudo
   handlers/default.ts       CERO logging. El catch externo manda el error
                              al cliente y ahí termina.
```

Ya existe un precedente que resuelve la mitad del problema — pero solo en el emulador local. Durante la Fase 2 (tests del backend), `apps/realtime-api/src/main.ts` ganó:

```ts
function log(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ t: new Date().toISOString(), event, ...fields }));
}
```

Con eventos `connection.open`, `action.received`, `action.done`, `action.failed`. Fue lo que permitió diagnosticar la carrera de `handleConnect` en su momento. Este change lleva esa misma forma —evento + campos, JSON de una línea— a los tres Lambdas reales, con Powertools en vez de una función casera.

**Confirmado antes de diseñar esto**:

| | |
|---|---|
| Build de producción | SAM con `BuildMethod: esbuild` propio, `Format: cjs`, `Target: node24` — bundlea desde el `.ts` fuente, no desde `dist/` de Nx |
| `@aws-lambda-powertools/logger` | v2.34.0, sin dependencia dura de `@middy/core` (peer opcional) |
| `CreateRoomRequest` | no trae `roomId` — se genera dentro de `handleCreateRoom` |
| El `catch` de `disconnect.ts` | swallowed a propósito ("best-effort"), sin loguear nada |

## Goals / Non-Goals

**Goals:**

- Que un error en cualquiera de las 10 acciones deje rastro en CloudWatch, con stack completo.
- Que cada log de acción incluya `roomId`, incluida la creación de la sala.
- Que la pregunta *"¿qué pasó en la sala ABC123 hace 20 minutos?"* se conteste con una query, sin leer código.
- Instalar solo lo que este change usa.

**Non-Goals:**

- **`Tracer` y `Metrics` de Powertools.** Se instalan cuando 4.3 y 4.2 los necesiten.
- **Alarmas** — 4.2.
- **Logging dentro de cada acción individual.** El centralizado en `default.ts` alcanza para lo que pide el roadmap.
- **Cambiar qué hace cualquier acción.** Es observabilidad, no funcionalidad.

## Decisions

### Decisión 1: Powertools Logger, no una función casera

La función `log()` de `main.ts` funciona y está probada. La opción más barata sería copiarla a los tres handlers.

**Elegido**: `@aws-lambda-powertools/logger`.

Dos razones concretas, no genéricas:

**Es la práctica establecida** para este problema exacto —Lambda + Node+ TypeScript—, no una elección de gusto. Cuando se pidió no inventar flujos propios (branch protection, hace unos días), el mismo criterio aplica acá.

**Comparte familia con lo que 4.2 y 4.3 van a necesitar.** `Tracer` (X-Ray, para 4.3) y `Metrics` (CloudWatch, para 4.2) son paquetes hermanos con la misma convención de configuración. No se instalan ahora —Non-Goal explícito— pero cuando llegue el momento, el patrón ya está asentado en el repo.

**Costo real, verificado**: ~306 KB sin comprimir, sin dependencias duras nuevas (`@middy/core` es peer opcional, no se usa). El bundle de producción lo arma el esbuild propio de SAM por Lambda, con tree-shaking — no pasa por el `dist/` de Nx.

### Decisión 2: el logging se centraliza en `default.ts`

Las 10 acciones comparten forma: reciben `(apiEndpoint, connectionId, request)`, hacen su trabajo, y si algo excepcional pasa, la excepción sube sin capturar hasta el `catch` externo de `default.ts` (las validaciones normales —"no sos el moderador", "la sala no existe"— no son excepciones, son mensajes de error enviados al cliente; eso ya funciona y no cambia).

```ts
const started = Date.now();
logger.info('action.received', { connectionId, action: request.action, roomId: ... });

try {
  switch (request.action) { /* sin cambios */ }
  logger.info('action.done', { connectionId, action: request.action, roomId: ..., durationMs: Date.now() - started });
} catch (error) {
  logger.error('action.failed', { connectionId, action: request.action, roomId: ..., durationMs: Date.now() - started, error });
  await sendToConnection(...);  // sin cambios
}
```

**Elegido**: instrumentar `default.ts` una sola vez, no las 10 acciones.

Cubre el criterio de aceptación completo —entrada, salida, error, con `roomId` y `durationMs`— tocando un archivo en vez de diez. Es el mismo patrón que ya funcionó en `main.ts`, y es coherente con cómo se resolvió el logging del emulador durante la Fase 2: un solo punto de instrumentación en el enrutador, no dispersado.

### Decisión 3: `handleCreateRoom` devuelve el `roomId` que genera

`CreateRoomRequest` no trae `roomId` —no puede, la sala no existe todavía—. Sin resolver esto, la creación de una sala quedaría con un log de entrada sin `roomId` y uno de salida también sin él: exactamente el caso que el criterio de aceptación pide cubrir ("cada log de una acción incluye `roomId`, para poder reconstruir la sesión de una sala").

**Elegido**: cambiar la firma de `handleCreateRoom` de `Promise<void>` a `Promise<string>`, devolviendo el `roomId` generado. `default.ts` lo captura en el `case 'createRoom'` y lo usa para el log de salida.

```ts
case 'createRoom': {
  const createdRoomId = await handleCreateRoom(apiEndpoint, connectionId, request);
  roomId = createdRoomId;
  break;
}
```

**Alternativa descartada — loguear sin `roomId` en la creación**: es la salida más barata, pero deja exactamente el momento más importante de la sesión de una sala —cuándo y por quién se creó— fuera de lo que se puede reconstruir. Es el peor lugar posible para tener el hueco.

**Alternativa descartada — leer el `roomId` desde el mensaje `roomState` que ya se envía al cliente**: acoplaría el logging del servidor a la forma del mensaje saliente, y ese mensaje puede cambiar por razones que no tienen nada que ver con logging.

**Costo**: el único test que se toca es `create-room.spec.ts`, y no se rompe — los tests actuales no usan el valor de retorno, así que agregarlo es compatible hacia atrás.

### Decisión 4: el `catch` mudo de `disconnect.ts` pasa a loguear, sin dejar de ser best-effort

```ts
try {
  const room = await buildRoomState(roomId);
  if (room) { await broadcastToRoom(...); }
} catch {
  // El broadcast es best-effort: un fallo aqui no debe impedir limpiar la conexion.
}
```

El comentario explica por qué no relanza. No explica por qué no deja rastro. Encontrado al leer el archivo para este change — mismo patrón que el hueco de `isVoter` que apareció escribiendo tests la semana pasada: un silencio que nadie puso ahí a propósito, solo nunca se completó.

**Elegido**: agregar `logger.warn('connection.broadcast_failed', { connectionId, roomId, error })` dentro del `catch`, sin relanzar. Sigue siendo best-effort —la limpieza de la conexión no depende de que el broadcast funcione— pero deja de ser invisible.

### Decisión 5: dónde vive la instancia de `Logger`

Tres Lambdas, tres bundles independientes (`connect.ts`, `disconnect.ts`, `default.ts` son `EntryPoints` separados en `infra/template.yaml`).

**Elegido**: `apps/realtime-api/src/lib/logger.ts`, exportando una instancia única con `serviceName: 'realtime-api'`, importada por los tres handlers.

Cada bundle termina con su propia copia después del tree-shaking de esbuild — eso es normal y esperable con tres funciones separadas, no una duplicación evitable. La alternativa —instanciar `Logger` suelto en cada handler— funciona igual pero dispersa la configuración (`serviceName`, nivel de log) en tres lugares en vez de uno.

## Risks / Trade-offs

**[El bundle de producción crece]** → ~306 KB sin comprimir por Lambda, tree-shaken por esbuild. Con `MemorySize: 256` y `Timeout: 10`, no hay margen ajustado que este tamaño amenace. Se confirma con un deploy real a `dev` como parte de este change.

**[Cambiar la firma de `handleCreateRoom` rompe algo no previsto]** → Es un cambio de tipo de retorno en una función `async` que hoy nadie usa por su valor. `nx build` y `nx test` lo detectarían en el acto si algo dependiera del `void`.

**[La query de Logs Insights no se puede probar sin desplegar]** → Es una acción real sobre infraestructura compartida (`dev`). Queda marcada en `tasks.md` para confirmar antes de ejecutar, siguiendo el mismo criterio que los deploys a `qa`/`prod` de la Fase 1.

## Migration Plan

1. `npm install @aws-lambda-powertools/logger`.
2. `lib/logger.ts` con la instancia compartida.
3. `create-room.ts`: `handleCreateRoom` devuelve `roomId`.
4. `default.ts`: log de entrada/salida/error centralizado, usando el `roomId` devuelto para `createRoom`.
5. `connect.ts` y `disconnect.ts`: migrar a `Logger`, y loguear el `catch` de `disconnect.ts`.
6. Deploy real a `dev` (con confirmación previa) y verificación de la query de Logs Insights contra logs reales.
7. `docs/aws-observability.md` con la query documentada.

**Rollback**: revertir el commit. Los logs viejos en CloudWatch no se tocan ni se pierden; el cambio es aditivo sobre lo que se escribe de acá en adelante.

## Open Questions

Ninguna de alcance. Queda una verificación pendiente de ejecutar, no de decidir: correr la query real contra `dev` una vez desplegado.
