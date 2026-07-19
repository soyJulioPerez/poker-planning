# Estimation Session

## Purpose

TBD

## Requirements

### Requirement: Selección de mazo de estimación
El sistema SHALL permitir al moderador elegir, al crear la sala, entre un conjunto de mazos predefinidos (por ejemplo Fibonacci y variantes) que se usarán durante toda la sesión. El catálogo de mazos predefinidos SHALL incluir variantes con emojis decorativos junto al valor numérico o sigla (por ejemplo "Fibonacci con manos" y "T-Shirt con iconos"), donde el valor de voto real SHALL seguir siendo el número o sigla, independientemente del texto decorativo mostrado en la carta. Todos los mazos predefinidos SHALL incluir los mismos símbolos de pausa: "?" (no sé estimar), "☕" (pausa/café) y "🧉" (pausa/mate).

#### Scenario: Moderador selecciona un mazo al crear la sala
- **WHEN** el moderador crea una sala y selecciona uno de los mazos predefinidos disponibles
- **THEN** el sistema asocia ese mazo a la sala y lo utiliza para todas las rondas de votación de la sesión

#### Scenario: Mazo con variante visual conserva el valor de voto real
- **WHEN** un participante selecciona una carta de un mazo con texto decorativo (por ejemplo "✋☝ 6" en "Fibonacci con manos")
- **THEN** el sistema registra como voto el valor real asociado a esa carta (por ejemplo "6"), no el texto decorativo mostrado

#### Scenario: Símbolos de pausa disponibles en todos los mazos
- **WHEN** un participante visualiza el mazo de votación de cualquiera de los mazos predefinidos
- **THEN** el sistema ofrece tanto "☕" como "🧉" como cartas de pausa, además de "?"

### Requirement: Votación oculta
El sistema SHALL permitir que cada participante habilitado para votar emita un voto sobre la historia actual, manteniendo dicho voto oculto para el resto hasta el revelado.

#### Scenario: Participante emite su voto
- **WHEN** un participante selecciona una carta del mazo para la historia actual
- **THEN** el sistema registra su voto y muestra al resto de los participantes únicamente que ese participante ya votó, sin revelar el valor

### Requirement: Revelado simultáneo
El sistema SHALL permitir únicamente al moderador revelar los votos de la ronda actual, mostrando todos los votos a todos los participantes al mismo tiempo. El sistema SHALL rechazar el intento de revelar si la sala no tiene una historia actual con título asignado.

#### Scenario: Moderador revela los votos
- **WHEN** el moderador ejecuta la acción de revelar con al menos un voto emitido
- **THEN** el sistema muestra a todos los participantes el valor votado por cada uno, de forma simultánea

#### Scenario: Intento de revelar sin historia asignada
- **WHEN** el moderador intenta revelar los votos mientras `currentStoryTitle` de la sala es nulo
- **THEN** el sistema rechaza la acción y no cambia el estado de la ronda

### Requirement: Cálculo de promedio y moda
El sistema SHALL calcular y mostrar, tras el revelado, el promedio y la moda de los votos emitidos en la ronda. Para mazos cuyos valores no son numéricos pero tienen una escala numérica interna asociada (por ejemplo "T-Shirt Sizes", donde cada talla corresponde a un número interno), el sistema SHALL usar esa escala para el cálculo, sin exponer los números internos al usuario salvo como se especifica en "Resolución manual de la historia".

#### Scenario: Revelado con votos numéricos variados
- **WHEN** los votos revelados incluyen valores numéricos del mazo
- **THEN** el sistema muestra el promedio calculado y el valor (o valores, en caso de empate) que constituyen la moda

#### Scenario: Revelado con mazo de valores no numéricos con escala interna
- **WHEN** los votos revelados incluyen valores de un mazo no numérico que tiene una escala numérica interna asociada (por ejemplo tallas de "T-Shirt Sizes")
- **THEN** el sistema calcula el promedio y la moda usando esa escala interna, en vez de excluir esos votos del cálculo

### Requirement: Resolución manual de la historia
El sistema SHALL permitir únicamente al moderador definir el valor final de estimación de la historia actual tras el revelado, ya sea aceptando el promedio, aceptando la moda (solo cuando existe un único valor de moda y ese valor es numérico o corresponde a un valor con escala numérica interna), o seleccionando el voto de un participante puntual como puntuación definitiva (numérico o con escala numérica interna). Cuando la moda tiene más de un valor empatado, o cuando su único valor no es numérico ni tiene escala interna asociada (por ejemplo "?", "☕" o "🧉"), el sistema SHALL mostrar dichos valores como texto informativo, sin ofrecer un botón para aceptarlos directamente. Para mazos con escala numérica interna, el promedio SHALL redondearse al valor de la escala más cercano (por distancia lineal) antes de mostrarse como opción aceptable, mostrando la etiqueta del valor de mazo correspondiente (no el número interno) en el botón de aceptación. El sistema SHALL rechazar, tanto en la interfaz como en el servidor, cualquier intento de resolver la historia con un valor final que no sea numérico ni resuelva a un número mediante la escala interna del mazo.

#### Scenario: Moderador acepta la moda como valor final
- **WHEN** el moderador, tras el revelado, la moda tiene un único valor numérico y el moderador elige aceptarlo
- **THEN** el sistema asigna ese valor como la puntuación definitiva de la historia actual

#### Scenario: Moda empatada se muestra solo como texto informativo
- **WHEN** el moderador visualiza el revelado y la moda tiene más de un valor empatado
- **THEN** el sistema muestra los valores empatados como texto, sin un botón para aceptar la moda directamente

#### Scenario: Moda con único valor no numérico no se puede aceptar
- **WHEN** el moderador visualiza el revelado y la moda tiene un único valor no numérico y sin escala interna asociada (por ejemplo "☕" o "🧉")
- **THEN** el sistema muestra ese valor como texto informativo, sin ofrecer un botón para aceptarlo como puntuación final

#### Scenario: Servidor rechaza una resolución con valor no numérico
- **WHEN** el servidor recibe una solicitud de resolución de historia cuyo valor final no es un número finito
- **THEN** el sistema rechaza la acción y no registra la historia como resuelta

#### Scenario: Moderador selecciona el voto de un participante como valor final
- **WHEN** el moderador, tras el revelado, selecciona el voto numérico de un participante puntual
- **THEN** el sistema asigna ese valor como la puntuación definitiva de la historia actual

#### Scenario: Moderador acepta la moda de un mazo con escala interna
- **WHEN** el moderador, tras el revelado con un mazo como "T-Shirt Sizes", la moda tiene un único valor de talla (por ejemplo "M") y el moderador elige aceptarlo
- **THEN** el sistema asigna como puntuación definitiva el número interno correspondiente a esa talla

#### Scenario: Moderador acepta el promedio de un mazo con escala interna
- **WHEN** el moderador, tras el revelado con un mazo como "T-Shirt Sizes", visualiza el botón de aceptar promedio
- **THEN** el sistema muestra la etiqueta de la talla más cercana al promedio calculado, y al aceptar asigna el número interno de esa talla como puntuación definitiva

#### Scenario: Moderador selecciona el voto de talla de un participante como valor final
- **WHEN** el moderador, tras el revelado con un mazo como "T-Shirt Sizes", selecciona el voto de talla de un participante puntual
- **THEN** el sistema asigna como puntuación definitiva el número interno correspondiente a esa talla

### Requirement: Nueva ronda de votación
El sistema SHALL permitir únicamente al moderador reiniciar la votación de la historia actual, descartando los votos previos de la ronda.

#### Scenario: Moderador inicia una nueva ronda tras no llegar a consenso
- **WHEN** el moderador ejecuta la acción de nueva ronda después de un revelado
- **THEN** el sistema descarta los votos anteriores de esa historia y habilita a los participantes a votar nuevamente

### Requirement: Avance a la siguiente historia
El sistema SHALL permitir al moderador, una vez resuelta la historia actual, avanzar a una nueva historia reiniciando el estado de votación. Mientras no haya una nueva historia con título asignado, el sistema SHALL mostrar a todos los participantes el resultado de la última historia resuelta (título y puntaje final), si existe.

#### Scenario: Moderador avanza tras resolver la historia
- **WHEN** el moderador confirma la puntuación final de la historia actual y avanza a la siguiente
- **THEN** el sistema registra la historia resuelta y habilita una nueva ronda de votación en estado limpio

#### Scenario: Resultado de la última historia visible mientras se espera la siguiente
- **WHEN** una historia fue resuelta y todavía no se asignó título a la siguiente historia
- **THEN** el sistema muestra el título y puntaje final de la última historia resuelta junto con la indicación de que se espera al moderador

#### Scenario: Sin historial previo, no se muestra resultado
- **WHEN** ninguna historia fue resuelta todavía en la sesión y no hay una historia con título asignado
- **THEN** el sistema no muestra ningún resultado previo, solo la indicación de que se espera al moderador

### Requirement: Historia con título como precondición para votar
El sistema SHALL exigir que la sala tenga una historia actual con título asignado antes de permitir que un participante emita un voto. Si no hay historia asignada, el sistema SHALL rechazar el intento de voto, tanto en la interfaz (ocultando o deshabilitando el mazo de votación) como en el servidor.

#### Scenario: Participante intenta votar sin historia asignada
- **WHEN** un participante intenta emitir un voto mientras `currentStoryTitle` de la sala es nulo
- **THEN** el sistema rechaza el voto y no lo registra

#### Scenario: Interfaz no ofrece votar sin historia asignada
- **WHEN** un participante visualiza la sala mientras no hay una historia actual con título asignado
- **THEN** el mazo de votación no está disponible para seleccionar una carta

#### Scenario: Participante vota una vez asignada la historia
- **WHEN** el moderador asigna un título a la historia actual y un participante habilitado como votante selecciona una carta
- **THEN** el sistema registra su voto normalmente
