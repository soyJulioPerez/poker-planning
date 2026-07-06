## Why

Pruebas manuales sobre la pantalla inicial (`Home`) detectaron dos problemas de UI: el texto de la tab actualmente seleccionada no es visible (se pierde el contraste entre fondo y texto), y la tab "Crear sala" queda seleccionada por defecto cuando la mayoría de quienes abren el link de la app en realidad buscan unirse a una sala existente, no crear una nueva.

## What Changes

- Corregir el estilo de `.home__tab--active` / `.home__tabs button` en `home.scss` para que el texto de la tab seleccionada sea siempre legible (contraste adecuado entre fondo y color de texto).
- Cambiar el valor inicial del signal `mode` en `home.ts` de `'create'` a `'join'`, de forma que la tab "Unirse a sala" quede seleccionada por defecto al cargar la pantalla `Home`.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `room-management`: se agregan dos escenarios de UI al requisito "Unión a sala vía link o código" — la tab "Unirse a sala" debe quedar seleccionada por defecto en la pantalla inicial, y el texto de la tab seleccionada debe ser siempre legible (contraste adecuado). No cambia el comportamiento funcional de crear/unirse a salas.

## Impact

- Código afectado: [apps/web/src/app/pages/home/home.ts](apps/web/src/app/pages/home/home.ts), [apps/web/src/app/pages/home/home.scss](apps/web/src/app/pages/home/home.scss), [apps/web/src/app/pages/home/home.html](apps/web/src/app/pages/home/home.html) (sin cambios de estructura esperados, solo posible ajuste de clases si hace falta).
- No afecta APIs, backend, ni websockets.
- No hay cambios de datos ni de contrato entre cliente y servidor.
