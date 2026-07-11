## Context

`packages/shared-contracts/src/lib/decks.ts` define un catálogo estático de `DeckOption { id, label, values: string[] }`, consumido tal cual por `AVAILABLE_DECKS` en el selector de "Crear sala" y por `VotingBoard`/`Card` para renderizar cada valor como una carta clickeable. Ningún valor tiene tipado o significado especial más allá de ser un string — el servidor (`apps/realtime-api`) nunca inspecciona el contenido de un voto salvo para intentar `Number(valor)` al calcular promedio/moda (`reveal.ts`) o al decidir si un voto es clickeable como resolución final (`reveal-panel.ts`). Esto significa que agregar valores nuevos al catálogo no requiere ningún cambio de lógica: cualquier string no numérico ya queda excluido de promedio y de "click para resolver" automáticamente.

## Goals / Non-Goals

**Goals:**
- Agregar 🧉 como símbolo de pausa adicional en los 3 mazos existentes, sin remover ☕.
- Agregar 2 mazos nuevos (`T-Shirt con iconos`, `Fibonacci con manos`) al catálogo `AVAILABLE_DECKS`, siguiendo el mismo patrón de `DeckOption` ya existente.
- Mantener el número/sigla visible en cada carta de los mazos nuevos (emoji es decorativo, no reemplaza la referencia numérica/alfabética).

**Non-Goals:**
- No se toca ninguna lógica de votación, revelado, cálculo de promedio/moda, ni resolución de historia — ya funciona correctamente para valores no numéricos arbitrarios.
- No se implementa descomposición dinámica de números en emojis de manos — la combinación de emojis por valor de Fibonacci se define fija, a mano, en el catálogo.
- No se agrega configuración por sala para elegir entre ☕/🧉 — ambos coexisten siempre.

## Decisions

**1. Mate como valor adicional, no alternativa configurable**
Cada mazo pasa de `[...valores, '?', '☕']` a `[...valores, '?', '☕', '🧉']`. Alternativa descartada: hacerlo configurable por sala (elegir ☕ o 🧉) — se descartó explícitamente por decisión del usuario, ya que agrega complejidad de configuración sin necesidad real (ambos símbolos significan lo mismo, no son mutuamente excluyentes para el equipo).

**2. Descomposición de manos fija por carta, no calculada**
Para `Fibonacci con manos`, cada valor numérico (0, 1, 2, 3, 5, 8, 13, 21, 34) tiene su combinación de emojis definida directamente en el catálogo, como entrada de `displayValues` (ver Decisión 3) paralela al `values` numérico real, no calculada por una función de descomposición en tiempo de ejecución. La descomposición usa: ✊=0, ☝=1, ✌=2, 🤟=3, ✋=5 (una mano completa), 👣=10 (huellas), 🧍=20 (persona de pie) — 👣 y 🧍 evitan repetir ✋ muchas veces, manteniendo la carta compacta en valores altos. Mapeo (`values[i]` → `displayValues[i]`):

| `values[i]` | `displayValues[i]` | Descomposición |
|-------|-----------------|-----------------|
| `'0'`  | `'✊ 0'`          | — |
| `'1'`  | `'☝ 1'`          | — |
| `'2'`  | `'✌ 2'`          | — |
| `'3'`  | `'🤟 3'`         | — |
| `'5'`  | `'✋ 5'`          | — |
| `'8'`  | `'✋🤟 8'`        | 5+3 |
| `'13'` | `'👣🤟 13'`       | 10+3 |
| `'21'` | `'🧍☝ 21'`       | 20+1 |
| `'34'` | `'🧍👣🤟☝ 34'`   | 20+10+3+1 |

*Alternativa descartada*: calcular la descomposición dinámicamente a partir del número (ej. `Math.floor(n/5)` manos + resto). Se descartó por decisión del usuario — es más simple de ajustar visualmente carta por carta, sin lógica de descomposición ni casos borde de legibilidad en valores altos, ya que el número siempre acompaña al emoji como referencia.

**3. `DeckOption` gana `displayValues?: string[]` paralelo a `values`**
`values[i]` sigue siendo el valor de voto real (lo que se envía al servidor, lo que se compara/parsea como número): `'0'`, `'1'`, ..., `'34'`, `'?'`, `'☕'`, `'🧉'`. `displayValues[i]`, si existe, es el string que se muestra en la carta (ej. `'✋☝ 6'`, `'🍼 XS'`), decorativo únicamente. `Card`/`VotingBoard` reciben ambos arrays; `Card` muestra `displayValues[i] ?? values[i]`, pero emite (`pick`) y compara selección (`selected()`) siempre contra `values[i]`. Esto mantiene `reveal.ts` y `reveal-panel.ts` sin ningún cambio: siguen operando sobre el voto real, nunca ven `displayValues`.

*Alternativa descartada*: mostrar solo el emoji sin número, mapeando emoji→valor en el servidor. Se descartó porque duplica la tabla de conversión en dos lugares (catálogo del cliente y lógica del servidor) y reintroduce el problema de legibilidad para valores altos que la decisión de "emoji + número juntos" ya evitaba.

**4. Valores no numéricos sin decoración de manos**
En `Fibonacci con manos`, "?", "☕" y "🧉" se mantienen exactamente iguales que en el mazo Fibonacci base (sin emoji de mano agregado), ya que no representan una cantidad a descomponer.

## Risks / Trade-offs

- [Riesgo] Strings de `displayValues` largos (ej. `'✋✋✋✋✋✋✌✌ 34'`) podrían desbordar visualmente una carta pequeña → Mitigación: ajuste de CSS (`font-size`/`white-space`) a validar manualmente al probar la UI; no requiere cambio de modelo de datos.
- [Riesgo] `displayValues` y `values` deben mantenerse alineados por índice (mismo largo, mismo orden) → Mitigación: test unitario en `decks.spec.ts` que verifica `displayValues.length === values.length` para cada mazo que lo defina.
- [Riesgo] Componentes existentes que iteran `deck.values` sin conocer `displayValues` (ej. si algo más además de `Card` los consumiera) seguirían funcionando porque `values` no cambia de significado — el riesgo es solo omitir actualizar `Card`/`VotingBoard` para leer `displayValues`, dejando la carta sin el emoji. Mitigación: cubierto explícitamente en tasks.md.

## Open Questions

Ninguna bloqueante — la separación `values`/`displayValues` resuelve el problema de fondo (voto real vs. texto decorativo) sin tocar `reveal.ts` ni `reveal-panel.ts`.
