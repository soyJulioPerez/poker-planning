## Why

La tab activa en la pantalla `Home` ("Unirse a sala" / "Crear sala") usa el mismo lenguaje visual (fondo negro sólido, texto blanco) que el botón de submit del formulario. Esto generó confusión real: un usuario intentó hacer click repetidamente sobre la tab ya seleccionada pensando que era un botón de acción que "no hacía nada".

## What Changes

- Cambiar el estilo de `.home__tabs button` / `.home__tab--active` en `home.scss` de un estilo de "caja rellena" (fondo sólido, borde) a un patrón de underline: sin fondo ni borde de caja, marcando la tab activa únicamente con una línea inferior de color.
- El comportamiento funcional de las tabs no cambia (siguen alternando entre `mode() === 'create'` y `'join'` mediante `setMode()`).

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `room-management`: se agrega al requisito "Unión a sala vía link o código" la exigencia de que el estilo de la tab seleccionada se distinga visualmente de un botón de acción del formulario (no solo que sea legible, como ya exigía el requisito).

## Impact

- Código afectado: [apps/web/src/app/pages/home/home.scss](apps/web/src/app/pages/home/home.scss), y posiblemente [apps/web/src/app/pages/home/home.html](apps/web/src/app/pages/home/home.html) si la nueva estructura visual lo requiere.
- No afecta lógica de `home.ts`, backend, ni otras pantallas.
