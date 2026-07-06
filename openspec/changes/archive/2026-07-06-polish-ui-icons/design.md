## Context

Tres ajustes visuales de bajo riesgo detectados en pruebas manuales del MVP. `ParticipantList` (`apps/web/src/app/ui/participant-list/`) ya usa el emoji ✓ junto al texto para el estado "votó"; el estado "esperando voto" solo muestra texto. `apps/web/public/favicon.ico` es el ícono genérico generado por el scaffold de Nx/Angular, referenciado desde `apps/web/src/index.html` vía `<link rel="icon">`. El mismo archivo `index.html` tiene `<title>web</title>`, el nombre por defecto del proyecto Nx, sin relación con "Planning Poker".

## Goals / Non-Goals

**Goals:**
- Que el estado "esperando voto" tenga la misma señal visual (ícono + texto) que el estado "votó".
- Que la pestaña del navegador muestre un ícono propio del proyecto en vez del genérico.
- Que el título de la pestaña identifique la aplicación como "Planning Poker".

**Non-Goals:**
- No se rediseña el resto de `ParticipantList` ni su lógica de estados.
- No se generan múltiples tamaños/formatos de favicon (apple-touch-icon, manifest, etc.) — solo se reemplaza el ícono principal de pestaña.
- No se anima el ícono de reloj de arena.
- No se agrega título dinámico por ruta/sala (ej. mostrar el `roomId` en el título) — solo se corrige el título estático global.

## Decisions

- **Ícono de "esperando voto"**: usar el emoji Unicode ⏳ como prefijo del texto existente, igual patrón que `✓ votó` en [participant-list.html](apps/web/src/app/ui/participant-list/participant-list.html). Se descarta un ícono SVG/librería externa por ser innecesario: el emoji no requiere assets ni dependencias nuevas y mantiene consistencia con el patrón ya establecido.
- **Favicon**: reemplazar `apps/web/public/favicon.ico` por un archivo SVG (`favicon.svg`) que renderiza el emoji ♠️ centrado vía `<text>`, y actualizar `index.html` para apuntar a `favicon.svg` con `type="image/svg+xml"`. Se elige SVG con emoji en lugar de un `.ico` diseñado a mano porque no requiere herramientas de edición de imágenes ni asset binario, se ve nítido en cualquier resolución, y los navegadores modernos soportan favicons SVG ampliamente.
- **Título de pestaña**: cambiar el `<title>` estático en `index.html` de "web" a "Planning Poker". Se descarta un título dinámico por ruta (por ejemplo incluir el código de sala) por ser innecesario para este ajuste puntual y quedar fuera del alcance de un fix de pulido visual.

## Risks / Trade-offs

- [Favicon SVG con emoji] → el renderizado del emoji puede variar levemente entre sistemas operativos/navegadores (distinta fuente de emoji). Mitigación: el símbolo ♠️ es suficientemente simple y universal como para verse reconocible en cualquier variante.
- [Navegadores muy antiguos sin soporte de favicon SVG] → riesgo bajo dado el público objetivo de la app (herramienta interna de equipo, navegadores modernos). No se agrega fallback `.ico` para mantener el cambio simple.
- [Título estático] → si en el futuro se quiere mostrar contexto dinámico en el título (ej. nombre de la sala), este cambio no lo cubre. Mitigación: no es un requisito actual; se puede abordar como una idea futura independiente si surge la necesidad.
