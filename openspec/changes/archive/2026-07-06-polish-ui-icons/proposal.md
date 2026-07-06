## Why

Pruebas manuales del MVP detectaron tres detalles de pulido visual: el estado "esperando voto" en la lista de participantes solo se comunica con texto (a diferencia de "votó", que ya usa un ícono ✓ junto al texto), la app usa el favicon genérico generado por Nx/Angular en vez de uno propio del proyecto, y el título de la pestaña del navegador muestra "web" (nombre por defecto del proyecto Nx) en vez del nombre real de la aplicación.

## What Changes

- En `ParticipantList`, acompañar el texto "esperando voto" con el emoji ⏳ (reloj de arena), replicando el mismo patrón visual ya usado en "✓ votó" (ícono + texto, estático, sin animación, sin nuevas dependencias).
- Reemplazar `apps/web/public/favicon.ico` (favicon genérico de Nx/Angular) por un favicon SVG simple que muestra el emoji ♠️ (palo de poker), y actualizar el `<link rel="icon">` en `apps/web/src/index.html` para apuntar al nuevo archivo.
- Cambiar el `<title>` en `apps/web/src/index.html` de "web" a "Planning Poker".

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `room-management`: se agrega al requisito "Lista de participantes en vivo" la indicación de que el estado "esperando voto" debe mostrarse con el ícono ⏳ junto al texto (paralelo al ícono ✓ ya usado para "votó"). El favicon y el título de pestaña no forman parte de ninguna capacidad de negocio existente y no requieren spec propia.

## Impact

- Código afectado: [apps/web/src/app/ui/participant-list/participant-list.html](apps/web/src/app/ui/participant-list/participant-list.html), [apps/web/src/index.html](apps/web/src/index.html) (favicon + `<title>`), y un nuevo archivo de favicon en `apps/web/public/`.
- No afecta backend, WebSockets, ni contratos compartidos (`shared-contracts`).
- Sin cambios de comportamiento funcional; puramente visual.
