## Context

`computeRevealResult` (`apps/realtime-api/src/actions/reveal.ts`) calcula `average` haciendo `Number(voto)` sobre cada voto y filtrando los que no son `Number.isFinite`. Los votos de T-Shirt Sizes (XS, S, M, L, XL, XXL) nunca son parseables como número, así que `average` siempre queda `null` para ese mazo, y tanto la moda como el click-to-resolve individual (`voteAsNumber` en `reveal-panel.ts`, `modeAsNumber` en `room.ts`) tampoco los reconocen como resolubles. El resultado es que una historia estimada con T-Shirt Sizes nunca puede resolverse por ninguna de las 3 vías existentes — una limitación preexistente al mazo, expuesta ahora al agregar "T-Shirt con iconos" y probarlo a fondo.

## Goals / Non-Goals

**Goals:**
- Permitir que los mazos T-Shirt (con y sin iconos) sean resolubles: promedio, moda y click-to-resolve individual deben funcionar igual que en los mazos numéricos.
- No modificar el comportamiento de mazos ya numéricos (Fibonacci, Powers of 2, Fibonacci con manos).
- Mantener `finalScore` como `number` en `ResolvedStory` (sin cambiar ese tipo) — el resultado de resolver con talla sigue siendo un número interno.

**Non-Goals:**
- No se agrega una UI que muestre la talla en `ResolvedStory`/reportes de sesión — sigue mostrándose el número guardado, igual que hoy para cualquier mazo.
- No se generaliza el mapeo a mazos futuros de forma dinámica más allá de agregar `numericValues` al catálogo cuando corresponda.

## Decisions

**1. `DeckOption` gana `numericValues?: Record<string, number>`**
Mapa opcional de valor de voto (string, tal cual aparece en `values`) → número interno usado solo para cálculo. `TSHIRT_DECK` y `TSHIRT_WITH_ICONS_DECK` definen `{ XS: 1, S: 2, M: 4, L: 8, XL: 16, XXL: 32 }` (potencias de 2, igual escala que `POWERS_OF_TWO_DECK`, decisión del usuario). Los demás mazos no definen este campo — su comportamiento no cambia, ya que sus valores ya son numéricos.

*Alternativa descartada*: escala secuencial 1-6. Se descartó por decisión explícita del usuario a favor de la consistencia con la escala exponencial ya usada en Powers of 2.

**2. `computeRevealResult` recibe el mazo de la sala, no solo los votos**
`handleReveal` ya tiene acceso a `meta.deckId`; se resuelve el `DeckOption` correspondiente (import de `AVAILABLE_DECKS` desde `shared-contracts`) y se pasa su `numericValues` (si existe) a `computeRevealResult`. Dentro de la función, la conversión a número pasa a ser: `numericValues?.[value] ?? Number(value)`, preservando el comportamiento actual para mazos sin `numericValues`.

**3. Redondeo del promedio a la talla más cercana (distancia lineal)**
Cuando el mazo tiene `numericValues`, el promedio crudo (ej. 4.7) se redondea al valor de la escala con menor diferencia absoluta (ej. `M`=4, ya que `|4.7-4|=0.7 < |4.7-8|=3.3`). El botón "Aceptar promedio" en la UI muestra la sigla de talla resultante (ej. "Aceptar promedio (M)"), y al aceptar se envía como `finalScore` el número interno de esa talla (4), no el promedio crudo. Para mazos sin `numericValues`, el promedio se sigue mostrando y aceptando como número crudo, sin cambios.

*Alternativa descartada*: distancia logarítmica. Se descartó por decisión del usuario a favor de la simplicidad de la distancia lineal directa.

**4. Moda y click-to-resolve individual usan el mismo mapa**
`modeAsNumber` (`room.ts`) y `voteAsNumber` (`reveal-panel.ts`) reciben el `numericValues` del mazo actual (vía un nuevo input/parámetro) y lo consultan antes de caer a `Number(valor)`. Un voto de talla como "M" se resuelve a 4 mediante el mapa, quedando disponible como opción clickeable igual que un voto numérico puro.

## Risks / Trade-offs

- [Riesgo] El botón "Aceptar promedio (M)" oculta el valor numérico crudo (4.7) que el usuario podría querer ver para entender el redondeo → Mitigación: aceptable por decisión explícita del usuario; no se muestra el crudo.
- [Riesgo] `computeRevealResult` ahora depende de resolver el `DeckOption` de la sala, acoplando `reveal.ts` a `shared-contracts` más de lo que ya estaba (ya importa tipos de ahí, así que el acoplamiento no es nuevo, solo se usa más superficie de esa dependencia).
- [Trade-off] Con `numericValues`, dos tallas distintas nunca colisionan en el mismo número (1,2,4,8,16,32 son todos distintos), así que no hay ambigüedad al mapear moda/click de vuelta a la sigla mostrada — la UI sigue mostrando la sigla original del voto (`entry.key`/`entry.value` en `reveal-panel.html`), no el número.

## Migration Plan

No aplica — cambio de código puro, sin datos persistentes de producción a migrar (salas efímeras).

## Open Questions

Ninguna bloqueante.
