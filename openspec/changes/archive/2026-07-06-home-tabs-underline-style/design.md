## Context

`.home__tabs button` en `home.scss` usa hoy un estilo de "caja rellena": borde, `border-radius`, y para el estado activo (`.home__tab--active`) fondo negro sólido con texto blanco — el mismo lenguaje visual que `button[type='submit']` del formulario. Esto hace que la tab activa se perciba como un botón de acción presionable, en vez de un indicador de selección.

## Goals / Non-Goals

**Goals:**
- Que la tab activa se distinga claramente de un botón de acción (submit).
- Mantener buen contraste y legibilidad del texto en ambos estados (activo e inactivo).

**Non-Goals:**
- No se cambia el comportamiento funcional de las tabs (`setMode()`, `mode()`).
- No se rediseña el resto del formulario de `Home`.

## Decisions

- **Patrón underline**: quitar `background` y `border` de `.home__tabs button`, dejando solo `border-bottom` (transparente por defecto) que se colorea en `.home__tab--active`. El texto activo usa un color de énfasis (ej. el mismo negro `#1a1a1a` en peso `font-weight` mayor) en vez de fondo sólido invertido, para diferenciarse visualmente de `button[type='submit']`.

## Risks / Trade-offs

- [Menor "peso visual" de la tab activa al quitar el fondo sólido] → mitigado combinando el underline con un cambio de peso de fuente (`font-weight`) o color de texto, para que la tab activa siga siendo evidente de un vistazo.
