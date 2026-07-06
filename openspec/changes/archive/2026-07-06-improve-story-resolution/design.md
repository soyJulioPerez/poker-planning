## Context

`room.html`, en la fase `roundPhase === 'revealed'`, muestra `app-reveal-panel` (lista de votos revelados + promedio/moda en texto) seguido de `room__resolution` (botones aceptar promedio/moda, input de valor manual, botón nueva ronda) y `room__next-story` (input + botón para la siguiente historia). `RevealPanel` hoy es un componente puramente de presentación (`result = input.required<RevealResult>()`), sin conocimiento de si el viewer es moderador ni forma de emitir eventos hacia el padre. `room.ts` ya expone `resolveWith(score: number)`, que envía `resolveStory` con cualquier `finalScore` numérico — no distingue si el valor viene del promedio, la moda, o (hasta ahora) de un input manual.

## Goals / Non-Goals

**Goals:**
- Reducir la fase de resolución a las opciones que realmente se usan: aceptar promedio, aceptar moda (solo cuando tiene un único valor), o elegir el voto de un participante.
- Integrar visualmente "Nueva ronda" con la lista de votos que reinicia.
- No ofrecer la opción de definir la próxima historia hasta que la actual esté resuelta.

**Non-Goals:**
- No se cambia el backend (`resolveStory` en `apps/realtime-api`): sigue aceptando cualquier `finalScore` numérico; el cliente simplemente ahora obtiene ese número del voto de un participante en lugar de un input libre.
- No se agrega ninguna restricción server-side sobre qué valores son válidos como `finalScore` (eso ya fue identificado como una idea separada en el backlog: "No aceptar '?' o '☕' como valor final").
- No se rediseña el layout general de `room.html` más allá de lo descrito; la sección de participantes y el resto de la pantalla no cambian.

## Decisions

- **Click en voto como resolución**: `RevealPanel` agrega un nuevo `input<boolean>()` (ej. `isModerator`) y un `output<number>()` (ej. `resolveVote`). Cada `<li>` de `reveal-panel__votes` se vuelve clickeable solo cuando `isModerator()` es `true` y el voto es numérico (los símbolos "?"/"☕" no son válidos como puntuación, consistente con la idea ya anotada en el backlog); al hacer click, emite el valor. `room.ts` conecta ese output a `resolveWith(...)`, reutilizando la lógica existente sin cambios en el backend.
- **Texto de ayuda condicional**: se muestra un texto breve ("Click en un voto para usarlo como puntuación final") solo cuando `isModerator()` es `true`, para no confundir a participantes que no pueden resolver la historia.
- **Eliminación del input de valor manual**: se remueve `manualScore` de `room.ts` y el bloque `room__manual-score` de `room.html`, ya que su caso de uso queda cubierto por elegir el voto de un participante (o, si ningún voto sirve, por "Nueva ronda" para pedir una re-votación).
- **Moda con empate**: se mantiene el comportamiento de solo ofrecer un botón "Aceptar moda (X)" cuando `mode.length === 1`. Cuando hay más de un valor empatado, no se ofrece ningún botón de moda; en su lugar, la línea de texto "Moda: ..." se muestra únicamente en ese caso (`mode.length > 1`), ya que ahí el empate no tiene otra forma de comunicarse (a diferencia del promedio, que siempre tiene un único botón).
- **"Nueva ronda" dentro de `RevealPanel`**: se agrega otro `output<void>()` (ej. `newRound`) y un botón con ícono de refresh, ubicado antes de la lista de votos en el mismo contenedor flex, con el espaciado (`gap`) ya usado entre tarjetas de voto. `room.ts` conecta ese output a la función `newRound()` existente.
- **Eliminar bloque de "próxima historia" en `revealed`**: se remueve ese fragmento de `room.html` sin reemplazo — la funcionalidad ya existe en `room__current-story`, visible una vez que `roundPhase` vuelve a `idle` tras `resolveStory`.

## Risks / Trade-offs

- [Quitar el valor manual] → un moderador que quería forzar un valor que ningún participante votó (ej. redondear a un valor del mazo) pierde esa opción directa. Mitigación: puede pedir una nueva ronda de votación, o (si surge la necesidad) se puede reconsiderar en una futura iteración; se documenta como comportamiento intencional (**BREAKING** de cara al usuario, ya señalado en el proposal).
- [Click en voto] → riesgo de clicks accidentales que resuelvan la historia con un valor no deseado. Mitigación: es una acción explícita del moderador (no del votante), y el flujo ya requiere una confirmación implícita al hacer click sobre un valor visible; se puede reconsiderar agregar una confirmación si en la práctica resulta un problema.
- [Votos no numéricos] → si el voto de un participante es "?" o "☕", no tiene sentido habilitar el click para usarlo como puntuación. Mitigación: el componente solo activa la interacción sobre votos que parseen como número.
