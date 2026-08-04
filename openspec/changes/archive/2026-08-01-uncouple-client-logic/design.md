## Context

Toda la lógica de conexión de un cliente a una sala vive hoy en `apps/web/src/app/core/room-socket.service.ts` (117 líneas). Además de la conexión WebSocket en sí, ese servicio mezcla tres cosas con distinto grado de portabilidad a un futuro cliente móvil:

1. **Protocolo/estado** (portable): abrir el socket, mandar `ClientRequest`, interpretar `ServerMessage`, mantener `room`/`roomInfo`/`connected`/`joinRejectedReason`/`roomSummary`/`errorMessage` como estado derivado. No depende de nada específico del navegador.
2. **APIs específicas de navegador** (no portables tal cual): `sessionStorage` para persistir la sesión (`saveSession`/`clearSession`/`getSessionFor`/`hasSessionFor`) y `environment.wsUrl` (config estilo Angular CLI) para la URL del socket.
3. **Forma reactiva del estado**: hoy expuesto como `signal()` de Angular, consumido directamente por los componentes de `apps/web`.

El repo ya tiene `rxjs` (`~7.8.0`) como dependencia directa del workspace (no solo de Angular), y `packages/shared-contracts` ya establece el patrón de "paquete Nx puro, sin Angular, consumido por múltiples apps".

## Goals / Non-Goals

**Goals:**
- Extraer (1) y aislar (2) para que un futuro cliente (Ionic, React Native, lo que sea) pueda reusar la lógica de conexión/estado sin arrastrar Angular ni `sessionStorage`/`window`.
- Mantener a `apps/web` funcionando exactamente igual (mismo comportamiento observable) usando el paquete nuevo por debajo.
- Definir un contrato de estado reactivo agnóstico de framework, consumible tanto por Angular como por cualquier otra reactividad.

**Non-Goals:**
- No se decide ni se construye ninguna app móvil en este change — solo se prepara el terreno.
- No se corrige el bug conocido de reconexión en pestaña nueva (ver `openspec/known-issues.md`); se preserva el comportamiento actual, bug incluido.
- No se extraen componentes de UI (`ui/voting-board`, `ui/card`, etc.) — eso depende de una decisión de framework móvil que todavía no está tomada.
- No se cambia el protocolo de mensajes ni `apps/realtime-api`.

## Decisions

### 1. Paquete nuevo: `packages/room-client`
Mismo patrón que `packages/shared-contracts` (lib Nx con `tsconfig.lib.json`, `project.json`, path alias en `tsconfig.base.json`). Depende de `shared-contracts` para los tipos (`ClientRequest`, `ServerMessage`, `Room`, etc.), no depende de Angular.

**Alternativa considerada:** ponerlo dentro de `apps/web/src/app/core` pero marcado como "reusable". Rechazada: si vive dentro de `apps/web`, una futura app móvil tendría que depender de `apps/web` (una app), no de un paquete — rompe el aislamiento y arrastraría transitivamente config de Angular.

### 2. Estado reactivo expuesto como Observables de RxJS, no signals
El paquete expone el estado (`room$`, `connected$`, `joinRejectedReason$`, etc.) como `Observable`/`BehaviorSubject` de RxJS en vez de `signal()` de Angular o un event-emitter casero.

**Por qué:** RxJS ya es una dependencia directa del workspace (no viene solo de Angular), es la forma reactiva más agnóstica de framework disponible sin agregar una dependencia nueva, y Angular la interopera de forma nativa (`toSignal()`), así que `apps/web` no pierde ergonomía.

**Alternativas consideradas:**
- *Signals de Angular*: descartado — obligaría a cualquier consumidor no-Angular a traer `@angular/core` solo por el tipo de estado.
- *Callbacks/event-emitter propio*: descartado — reinventa lo que RxJS ya da (multicast, último valor, composición), con más código propio para mantener.

`RoomSocketService` en `apps/web` pasa a ser un adaptador delgado: envuelve cada `Observable` del paquete con `toSignal()` y expone los mismos signals que hoy (`room`, `connected`, etc.), así que **ningún componente que consume `RoomSocketService` cambia**.

### 3. Persistencia de sesión y config de conexión, inyectadas por la app consumidora
- Se define una interfaz mínima `SessionStore` (`get(roomId): {name} | null`, `save(roomId, name): void`, `clear(): void`) dentro de `packages/room-client`. `apps/web` provee una implementación basada en `sessionStorage` (la misma lógica que hoy tiene `getSessionFor`/`saveSession`/`clearSession`).
- La URL del WebSocket deja de leerse de `environment.wsUrl` dentro del paquete; se recibe como parámetro de configuración al construir el cliente. `apps/web` sigue resolviéndola desde `environment.ts` y se la pasa.

**Por qué:** `sessionStorage` y `environment.ts` (build-time config de Angular CLI) no existen en un cliente móvil. Inyectar ambos como dependencias mantiene el paquete verdaderamente agnóstico sin especular sobre qué mecanismo de storage/config usará la futura app móvil.

## Risks / Trade-offs

- **[Riesgo] Drift de comportamiento durante la extracción** (ej. orden de eventos, manejo de `pendingMessages` al reconectar) → Mitigación: el repo ya tiene cobertura e2e de Playwright sobre reconexión y flujo de sala (`add-e2e-playwright-tests`, `add-e2e-room-moderation-coverage`, `add-e2e-estimation-rules-coverage`); correr esa suite antes y después de la extracción como red de regresión, no solo unit tests del paquete nuevo.
- **[Riesgo] La interfaz `SessionStore` queda mal diseñada por no conocer aún el mecanismo real de storage móvil** → Mitigación: mantenerla mínima (3 métodos, mismo shape que el uso actual) en vez de anticipar necesidades móviles hipotéticas; se puede extender cuando exista la app móvil real.
- **[Trade-off] Un nivel extra de indirección en `apps/web`** (adaptador + paquete, en vez de un servicio único) a cambio de portabilidad futura → aceptado explícitamente porque es el propósito del change.
