## Context

`computeRevealResult` (`apps/realtime-api/src/lib/reveal-result.ts`) calcula el promedio de los votos numéricos, lo redondea a 1 decimal y lo ajusta al valor más cercano de la escala del mazo (`deckScale`: `numericValues` si el mazo los tiene, o los propios valores parseados como número). Ese valor ajustado viaja como `RevealResult.average`, se guarda en `META.revealResult` al revelar y lo consumen:

- la web, en `room.html` (bloque `room__resolution`), con el botón "Aceptar promedio (`valueLabel(average)`)", visible solo para el moderador;
- la app mobile (`RoomScreen.tsx`), con el mismo botón.

Hoy el promedio solo aparece dentro de ese botón: los participantes que no moderan no lo ven.

## Goals / Non-Goals

**Goals:**
- Mostrar el promedio real tras el revelado, a todos los participantes.
- Ofrecer al moderador las cartas vecinas del promedio como opciones de resolución.
- No romper la app mobile ni las versiones instaladas.

**Non-Goals:**
- Cambiar el cálculo de la moda.
- Cambiar la UI de mobile.
- Validar en el servidor que el valor resuelto sea una carta vecina: hoy `resolveStory` acepta cualquier número finito (también el voto de un participante) y eso no cambia.

## Decisions

### D1. Campos nuevos en vez de cambiar `average`

`RevealResult` gana:

```ts
rawAverage: number | null;   // promedio real, redondeado a 2 decimales
averageBounds: number[];     // [inferior, superior] en la escala, [valor] si coincide, [] sin votos numéricos
```

`average` conserva exactamente su cálculo actual (carta más cercana).

*Alternativa descartada*: que `average` pase a ser el crudo. Mobile mostraría "Aceptar promedio (9.67)" y podría resolver con un valor que no es ninguna carta; las apps ya instaladas no se actualizan solas.

### D2. Cálculo de `averageBounds` en el servidor

Se parte de la escala del mazo (`deckScale`, sin duplicados y ordenada) y de `rawAverage` ya redondeado a 2 decimales. Usar el valor redondeado mantiene coherentes el texto y los botones: si se muestra "8", hay un solo botón "Aceptar 8".

- Si `rawAverage` coincide con un valor de la escala → `[ese valor]`.
- Si no → `[mayor valor < rawAverage, menor valor > rawAverage]`.
- Bordes: como el promedio está entre el voto mínimo y el máximo, y todo voto numérico es un valor de la escala, siempre hay vecino de cada lado. Igual, si faltara uno (mazo sin escala, dato inesperado), se devuelve solo el que exista; sin escala, `[]`.

*Alternativa descartada*: calcular las vecinas en cada cliente. Repite la lógica de la escala en web (y en mobile cuando se sume), y el servidor ya tiene el mazo a mano.

### D3. Formato del promedio en la web

`Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })`: coma decimal y sin ceros de más ("9,67", "8", "4,5"). Sin dependencias nuevas.

Texto según la escala:
- Escala implícita (Fibonacci, Powers of 2): "Promedio: 9,67".
- Escala explícita (`deck.numericValues`, T-Shirt): con el `valueLabel` existente, "Promedio: entre M y L" si hay dos vecinas, "Promedio: M" si hay una.
- Sin votos numéricos (`rawAverage === null`): no se muestra la línea.

### D4. Botones de resolución

En `room__resolution`, el botón "Aceptar promedio (X)" se reemplaza por un botón por cada valor de `averageBounds`, rotulado "Aceptar {valueLabel(valor)}", que llama al `resolveWith(valor)` existente. El botón "Aceptar moda" se oculta cuando el valor de la moda ya es una de las cartas vecinas (`acceptableMode` en `room.ts`); si es otra carta, se muestra como hoy.

*Ajuste durante la verificación manual*: el explore había decidido no tocar la moda, pero con votos 8, 8, 13 la sala mostraba "Aceptar 8" y "Aceptar moda (8)" juntos, dos botones para el mismo valor.

La línea del promedio se muestra fuera de `room__resolution`, para todos los participantes, dentro del panel de revelado (`reveal-panel`, input `average`): en la misma línea que la moda empatada, el promedio primero, porque es siempre un único valor y la moda puede ser una lista.

*Ajuste durante la verificación manual*: la primera versión ponía el promedio en su propia línea debajo del panel, y quedaba separado de la moda.

### D5. `revealResult` guardado antes del deploy

`META.revealResult` se calcula una vez, al revelar. Una sala que tenga una ronda revelada justo durante el deploy trae un `revealResult` sin los campos nuevos hasta el próximo revelado. La web lo trata así: sin `averageBounds`, usa `[average]` si `average` no es nulo (el mismo botón de hoy, con el texto nuevo "Aceptar X"); sin `rawAverage`, no muestra la línea del promedio. No hace falta migración: el caso dura una ronda.

## Risks / Trade-offs

- [Web y mobile muestran cosas distintas] Mobile sigue con "Aceptar promedio (8)" mientras la web muestra "Promedio: 9,67". → Diferencia conocida y aceptada en el explore; la spec `mobile-app` ("calculados igual que en la web") queda desalineada hasta un change de mobile.
- [Redondeo a 2 decimales] Un promedio como 7,996 se muestra "8" y ofrece un solo botón. → Es coherente con lo que se ve; la diferencia no cambia la decisión del equipo.

## Migration Plan

Sin migración de datos (ver D5). Deploy del backend antes que de la web, como siempre: la web nueva tolera un `revealResult` sin campos nuevos, y la web vieja ignora los campos nuevos. Rollback: revertir el deploy; los campos sobrantes en salas activas son inofensivos.

## Open Questions

(ninguna — las decisiones de producto quedaron cerradas en el explore)
