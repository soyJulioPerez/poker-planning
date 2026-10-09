## Why

Tras el revelado, la web ofrece "Aceptar promedio (X)" con el promedio ya ajustado a la carta más cercana. Con votos 8, 8 y 13 en Fibonacci muestra "Aceptar promedio (8)", cuando el promedio real es 9,67: parece que el sistema no sabe calcular. El ajuste se introdujo en `2026-08-17-fix-average-scale-and-share-link-display` para no ofrecer un valor que no es ninguna carta; este change conserva ese objetivo (solo se acepta una carta), pero deja de esconder el promedio real.

## What Changes

- Tras el revelado, la web muestra a todos los participantes el promedio real con 2 decimales, coma decimal y sin ceros de más ("Promedio: 9,67", "Promedio: 8").
- En vez de "Aceptar promedio (X)", el moderador ve un botón por cada carta vecina del promedio: "Aceptar 8" y "Aceptar 13". Si el promedio coincide con una carta, un solo botón ("Aceptar 8").
- En mazos con escala interna explícita (T-Shirt Sizes) el número del promedio no significa nada para el equipo: se muestra "Promedio: entre M y L" y los botones usan las etiquetas ("Aceptar M", "Aceptar L"). Si coincide con una talla, "Promedio: M".
- "Aceptar moda (X)" deja de mostrarse cuando X ya es una de las cartas vecinas del promedio, para no repetir el mismo valor en dos botones. Si la moda es otra carta, el botón sigue.
- El servidor agrega a `RevealResult` dos campos: `rawAverage` (promedio real, 2 decimales) y `averageBounds` (las cartas vecinas en la escala del mazo). `average` no cambia: sigue siendo la carta más cercana, porque lo usan la app mobile y las versiones ya instaladas.

Fuera de alcance:
- El cálculo de la moda y su texto informativo (empates, valores no numéricos) quedan como están.
- La app mobile: sigue mostrando "Aceptar promedio (X)" con `average`. Queda una diferencia conocida con la web hasta un change propio de mobile.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `estimation-session`: "Cálculo de promedio y moda" pasa a mostrar el promedio real (o el rango de tallas, en escalas explícitas) en vez del ajustado a la carta más cercana. "Resolución manual de la historia" reemplaza la opción de aceptar el promedio ajustado por la de aceptar cualquiera de las cartas vecinas del promedio.

## Impact

- `packages/shared-contracts`: `RevealResult` gana `rawAverage: number | null` y `averageBounds: number[]` (uno o dos valores de la escala, vacío si no hay votos numéricos).
- `apps/realtime-api/src/lib/reveal-result.ts`: `computeRevealResult` calcula los dos campos nuevos; `average` mantiene su cálculo actual.
- `apps/web`: `room.html`/`room.ts` reemplazan el botón de aceptar promedio por el texto del promedio y los botones de cartas vecinas.
- `apps/mobile`: sin cambios. Los campos nuevos son aditivos y no rompen el contrato que usa.
- Salas con una ronda revelada al momento del deploy: su `revealResult` guardado no tiene los campos nuevos hasta el próximo revelado (ver design).
