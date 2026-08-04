## Why

Hoy toda la lógica de cliente de una sala (conexión WebSocket, reconexión, y estado reactivo de la sala) vive dentro de `apps/web/src/app/core/room-socket.service.ts`, acoplada a las APIs de Angular (`Injectable`/`signal`). Está planeada una app móvil como otro cliente del mismo backend `realtime-api`, y duplicar esta lógica implicaría corregir bugs y evolucionar el protocolo dos veces. El monorepo ya prueba que este patrón funciona: `packages/shared-contracts` es consumido hoy tanto por `apps/web` como por `apps/realtime-api`. Este change extiende ese patrón a la lógica de conexión/estado del lado cliente, antes de que exista la app móvil, para que la web pase a ser la primera consumidora de un runtime de cliente reusable en vez de la única.

## What Changes

- Extraer la lógica de conexión WebSocket, reconexión, y estado de sala que hoy está en `apps/web/src/app/core/room-socket.service.ts` a un paquete nuevo, agnóstico de framework.
- La lógica extraída expone el estado de la sala y el estado de conexión a través de una primitiva reactiva plana (no-Angular), para que pueda ser envuelta por signals de Angular hoy y por la reactividad de otro framework más adelante.
- El `RoomSocketService` de `apps/web` pasa a ser un adaptador delgado de Angular sobre el paquete nuevo (wiring de DI + envoltura en signals), dejando de ser el dueño de la lógica de conexión.
- Sin cambios en `apps/realtime-api` ni en el protocolo de mensajes — esto es una reestructuración exclusivamente del lado cliente.
- Sin cambios de comportamiento visibles para el usuario; es un refactor para habilitar reuso futuro, no un cambio de funcionalidad.

## Capabilities

### New Capabilities
- `room-client-runtime`: gestión de conexión/estado de sala agnóstica de framework (conectar, reconectar, enviar `ClientRequest`, exponer el estado derivado de `Room`/`ServerMessage`) que cualquier app cliente puede consumir, independientemente del framework de UI.

### Modified Capabilities
(ninguna — las capabilities de negocio existentes como `room-management` y `session-summary` mantienen sus requisitos actuales; solo cambia dónde vive la implementación interna de la lógica de cliente)

## Impact

- **Código afectado**: `apps/web/src/app/core/room-socket.service.ts` (pasa a ser un adaptador delgado), paquete nuevo `packages/room-client` (nombre tentativo, a definir en design).
- **No afectado**: `apps/realtime-api`, `packages/shared-contracts` (sigue siendo la fuente de tipos compartidos, consumida por el paquete nuevo), protocolo/contrato de mensajes.
- **Dependencias**: el paquete nuevo depende de `shared-contracts`; `apps/web` pasa a depender del paquete nuevo además de `shared-contracts`.
- **Riesgo**: regresiones en el comportamiento de reconexión/rejoin de sesión durante la extracción (esta área ya tiene un caso conocido — ver `openspec/known-issues.md`, "Direct room link in a new tab/browser never connects" — la extracción no debería arreglarlo ni empeorarlo de forma silenciosa; vale la pena dejarlo explícito en vez de mezclar un fix en este refactor).
