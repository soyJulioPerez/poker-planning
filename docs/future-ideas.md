# Ideas para futuras iteraciones

Backlog de ideas que surgen durante el uso/pruebas del MVP, pendientes de explorar y formalizar como un nuevo ciclo de OpenSpec (`/opsx:explore` → `/opsx:propose`) más adelante. No son tareas del `tasks.md` actual — son insumos para una futura ronda de diseño.

## Resolución de historia

- **Elegir el voto de un participante específico como resultado final**: además de aceptar promedio, moda, o ingresar un valor manual, el moderador podría seleccionar directamente el voto de un participante puntual (por ejemplo, el experto en esa funcionalidad o quien viene trabajando en ese feature) como la puntuación definitiva de la historia. Requiere explorar cómo se vería en la UI (¿click en el voto de esa persona en el reveal-panel?) y si el backend necesita una nueva acción o si `resolveStory` puede aceptar una referencia al participante en lugar de (o además de) un número.

## Control de tiempo y disciplina de votación

- **Temporizador para la ronda de votación**: el moderador podría configurar un límite de tiempo por ronda; al cumplirse, los participantes que no votaron quedan marcados con un voto nulo/vacío automáticamente (en vez de quedar indefinidamente "esperando voto"). A explorar: ¿el temporizador es configurable por sala o fijo?, ¿se muestra una cuenta regresiva visible a todos?, ¿qué pasa si el voto nulo entra en el cálculo de promedio/moda (probablemente se excluye, similar a "?" o "☕")?
- **Bloquear "Revelar" hasta que todos los votantes hayan votado**: actualmente el moderador puede revelar con solo un voto emitido (así lo define la spec actual: "con al menos un voto emitido"). Esta idea cambiaría esa regla para exigir que todos los participantes habilitados como votantes hayan votado antes de habilitar el botón. A explorar: ¿qué pasa si alguien se desconecta a mitad de la ronda (bloquearía indefinidamente)?, ¿debería combinarse con la idea del temporizador de arriba como vía de escape?, ¿el moderador podría tener una opción de "forzar revelado" igual, para no quedar bloqueado por un voto pendiente eterno?

## Toques de personalidad / humor

- **Frases sarcásticas al votar**: de forma ocasional (no siempre, para no volverse repetitivo/molesto), mostrar un mensaje humorístico relacionado con el valor votado. Ejemplos propuestos: "¿Otra vez 5? ¿No te sabes otro número?", "Solo 2 ptos... si es tan fácil hazla vos", "¡13!? ¿No estarás inflando la puntuación?". A explorar: ¿se dispara por patrón (mismo valor repetido, valor muy alto/bajo respecto al resto), o totalmente al azar? ¿Se muestra solo al propio votante o también a los demás? ¿Catálogo de frases editable/ampliable, quizás por mazo o tema?

## Mejoras de UI detectadas en pruebas manuales (no bloqueantes para el MVP)

- **Ícono de reloj de arena para "no ha votado"**: reemplazar el indicador textual "esperando voto" por un ícono de hourglass en `ParticipantList`, para comunicar visualmente (no solo con texto) que el participante aún no votó.
- **Revisar la pantalla inicial (`Home`)**: hay un botón que aparece en blanco/confuso. Aclarar la intención de diseño (¿era un botón de acción secundaria, un placeholder, o un estilo sin aplicar?) antes de decidir el fix.
- **Cambiar el favicon**: actualmente usa el favicon por defecto generado por Nx/Angular (genérico). Reemplazarlo por uno propio del proyecto (ej. relacionado a cartas de poker/planning poker).
