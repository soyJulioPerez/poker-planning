## Why

Se detectaron dos bugs en el flujo de "compartir link de sala", confirmados manualmente contra el sitio en producción (GitHub Pages):

1. **`shareLink` (el texto que el moderador copia y comparte) genera una URL incompleta**: usa `window.location.origin` y arma la ruta a mano (`/room/${roomId}`), ignorando el `base-href` real de la app (`/poker-planning/`). Si se comparte ese texto tal cual, produce un 404 real de GitHub Pages, sin fallback aplicable, porque la ruta generada no coincide con ninguna configurada.
2. **Un participante que abre el link correcto de una sala sin haber pasado antes por la pantalla de inicio (Home) queda colgado indefinidamente en "Conectando a la sala..."**: `RoomPage` solo intenta reconectar si existe una sesión previa en `sessionStorage` (mecanismo pensado para recargar la página dentro de una sesión ya establecida); si no hay sesión, no hace nada, y el usuario no tiene ninguna indicación de qué hacer.

Ambos bugs comparten el mismo síntoma de cara al usuario ("el link para unirse a la sala no funciona") y el mismo código (`room.ts`), así que se resuelven en el mismo cambio.

## What Changes

- `shareLink` se corrige para generar siempre una URL completa y correcta (respetando el `base-href` real de la app), en vez de reconstruir la ruta a mano.
- `RoomPage` detecta cuando no hay una sesión previa en `sessionStorage` para la sala actual y redirige automáticamente a Home, pasando el código de sala como query param (`/?room=<roomId>`), para que el formulario de "Unirse a sala" quede precargado con ese código.
- Home lee el query param `room` al inicializar y, si está presente, precarga el campo "Código de sala" y fuerza la tab "Unirse a sala" como activa.
- El comportamiento de reconexión existente (cuando sí hay sesión previa) no cambia.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `room-management`: el requirement "Creación de sala" se ajusta para que el link compartible generado sea siempre correcto y funcional. El requirement "Unión a sala vía link o código" se amplía para cubrir el caso de alguien que abre el link de una sala sin sesión previa: en vez de quedar sin ninguna indicación, el sistema lo redirige a la pantalla de "Unirse a sala" con el código precargado.

## Impact

- `apps/web/src/app/pages/room/room.ts`: corrección de `shareLink`; nueva lógica de redirección cuando no hay sesión previa.
- `apps/web/src/app/pages/home/home.ts` / `home.html`: lectura del query param `room` al inicializar, precarga del campo y de la tab activa.
- `apps/web/src/app/app.routes.ts`: sin cambios estructurales esperados (ya soporta query params por defecto en Angular Router).
- No afecta al backend (`apps/realtime-api`) — es un cambio puramente de enrutamiento/UX del lado del cliente.
