# Estimation Session

## Purpose

Cubre la mecánica central de una ronda de Planning Poker: selección de mazo, votación oculta con las reglas de negocio aplicadas en el servidor (no solo en la interfaz), revelado simultáneo, cálculo de promedio y moda, y resolución manual de la historia por el moderador. Es distinta de `room-management`, que resuelve quién está en la sala; esta resuelve qué hacen una vez adentro.

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

El sistema SHALL rechazar el voto de un participante que no está habilitado como votante, y SHALL rechazar todo voto una vez que la ronda fue revelada. Un voto después del revelado no aporta: los demás ya vieron todos los valores, así que el sesgo de anclaje que la votación oculta busca evitar ya ocurrió. Para volver a votar existe la nueva ronda.

Ambas reglas SHALL hacerse cumplir **en el servidor**, con independencia de lo que permita la interfaz. Que la interfaz no ofrezca la acción no es una garantía: cualquier cliente desactualizado, reconexión con estado desfasado o regresión futura vuelve a abrir el camino. Es el mismo criterio que se aplicó al puntaje final en el change `2026-07-11-fix-mode-numeric-only`.

Mientras la ronda no fue revelada, un participante SHALL poder cambiar su voto: el voto nuevo reemplaza al anterior sin ser rechazado.

#### Scenario: Participante emite su voto
- **WHEN** un participante selecciona una carta del mazo para la historia actual
- **THEN** el sistema registra su voto y muestra al resto de los participantes únicamente que ese participante ya votó, sin revelar el valor

#### Scenario: Participante cambia de opinión antes del revelado
- **WHEN** un participante que ya votó selecciona otra carta, con la ronda todavía sin revelar
- **THEN** el sistema reemplaza su voto anterior por el nuevo, sin rechazar la acción

#### Scenario: Quien no está habilitado como votante no puede votar
- **WHEN** un participante cuyo estado es "no votante" —por ejemplo un moderador que se marcó como observador— intenta emitir un voto
- **THEN** el sistema rechaza la acción y no registra ningún voto para él

#### Scenario: No se admiten votos después del revelado
- **WHEN** un participante intenta votar mientras la ronda ya está revelada
- **THEN** el sistema rechaza la acción y no altera los votos de la ronda

#### Scenario: El rechazo no depende de la interfaz
- **WHEN** llega una solicitud de voto que la interfaz no habría permitido emitir
- **THEN** el sistema la rechaza igual, porque la validación vive en el servidor

### Requirement: Revelado simultáneo
El sistema SHALL permitir únicamente al moderador revelar los votos de la ronda actual, mostrando todos los votos a todos los participantes al mismo tiempo. El sistema SHALL rechazar el intento de revelar si la sala no tiene una historia actual con título asignado.

#### Scenario: Moderador revela los votos
- **WHEN** el moderador ejecuta la acción de revelar con al menos un voto emitido
- **THEN** el sistema muestra a todos los participantes el valor votado por cada uno, de forma simultánea

#### Scenario: Intento de revelar sin historia asignada
- **WHEN** el moderador intenta revelar los votos mientras `currentStoryTitle` de la sala es nulo
- **THEN** el sistema rechaza la acción y no cambia el estado de la ronda

### Requirement: Cálculo de promedio y moda
El sistema SHALL calcular y mostrar, tras el revelado, el promedio y la moda de los votos emitidos en la ronda. Todo mazo tiene una escala numérica para este cálculo: explícita (`numericValues`, para mazos cuyos valores no son numéricos por sí mismos, como "T-Shirt Sizes") o implícita (los propios valores numéricos del mazo, para mazos como Fibonacci o Powers of 2). El sistema SHALL mostrar a todos los participantes el promedio real de los votos, sin ajustarlo a la escala, con hasta 2 decimales, coma decimal y sin ceros de más. Cuando la escala es explícita, el sistema SHALL mostrar en su lugar las etiquetas de los valores de la escala que rodean al promedio (o la única etiqueta, si el promedio coincide con un valor de la escala), porque el número interno no significa nada para el equipo.

#### Scenario: Revelado con votos numéricos variados
- **WHEN** los votos revelados incluyen valores numéricos del mazo
- **THEN** el sistema muestra el promedio real de esos votos y el valor (o valores, en caso de empate) que constituyen la moda

#### Scenario: Revelado con mazo de valores no numéricos con escala interna
- **WHEN** los votos revelados incluyen valores de un mazo no numérico que tiene una escala numérica interna asociada (por ejemplo tallas de "T-Shirt Sizes")
- **THEN** el sistema calcula el promedio y la moda usando esa escala interna, en vez de excluir esos votos del cálculo

#### Scenario: Promedio real que no coincide con ninguna carta del mazo
- **WHEN** en un mazo con escala implícita (por ejemplo Fibonacci) los votos son 8, 8 y 13
- **THEN** el sistema muestra "Promedio: 9,67", sin ajustarlo a la carta más cercana

#### Scenario: Promedio real que coincide con una carta del mazo
- **WHEN** en un mazo con escala implícita el promedio real es un valor entero de la escala (por ejemplo votos 8, 8 y 8)
- **THEN** el sistema muestra "Promedio: 8", sin decimales

#### Scenario: Promedio de un mazo con escala explícita
- **WHEN** en un mazo como "T-Shirt Sizes" el promedio real cae entre dos tallas de la escala (por ejemplo entre M y L)
- **THEN** el sistema muestra "Promedio: entre M y L" en vez del número interno

#### Scenario: Promedio de un mazo con escala explícita que coincide con una talla
- **WHEN** en un mazo como "T-Shirt Sizes" el promedio real coincide con el número interno de una talla (por ejemplo M)
- **THEN** el sistema muestra "Promedio: M"

### Requirement: Resolución manual de la historia
El sistema SHALL permitir únicamente al moderador definir el valor final de estimación de la historia actual tras el revelado, ya sea aceptando una de las cartas vecinas del promedio, aceptando la moda (solo cuando existe un único valor de moda y ese valor es numérico o corresponde a un valor con escala numérica interna), o seleccionando el voto de un participante puntual como puntuación definitiva (numérico o con escala numérica interna). Las cartas vecinas del promedio son los valores de la escala del mazo inmediatamente inferior y superior al promedio real, o el único valor de la escala que coincide con él; el sistema SHALL ofrecer un botón de aceptación por cada una, rotulado con la etiqueta del valor de mazo correspondiente. El sistema SHALL NOT ofrecer el botón de aceptar la moda cuando su valor ya es una de las cartas vecinas del promedio. Cuando la moda tiene más de un valor empatado, o cuando su único valor no es numérico ni tiene escala interna asociada (por ejemplo "?", "☕" o "🧉"), el sistema SHALL mostrar dichos valores como texto informativo, sin ofrecer un botón para aceptarlos directamente. El sistema SHALL rechazar, tanto en la interfaz como en el servidor, cualquier intento de resolver la historia con un valor final que no sea numérico ni resuelva a un número mediante la escala del mazo.

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

#### Scenario: Moderador elige entre las dos cartas vecinas del promedio
- **WHEN** el moderador, tras el revelado con un mazo como "Fibonacci", visualiza un promedio real de 9,67 (votos 8, 8 y 13)
- **THEN** el sistema le ofrece los botones "Aceptar 8" y "Aceptar 13", y al elegir uno asigna ese valor como puntuación definitiva

#### Scenario: Promedio que coincide con una carta ofrece un solo botón
- **WHEN** el moderador, tras el revelado, visualiza un promedio real que coincide con una carta del mazo (por ejemplo 8)
- **THEN** el sistema le ofrece un único botón "Aceptar 8"

#### Scenario: Moderador acepta una talla vecina del promedio en un mazo con escala interna explícita
- **WHEN** el moderador, tras el revelado con un mazo como "T-Shirt Sizes", visualiza un promedio que cae entre M y L
- **THEN** el sistema le ofrece los botones "Aceptar M" y "Aceptar L", y al elegir uno asigna el número interno de esa talla como puntuación definitiva

#### Scenario: La moda no se repite si ya es una carta vecina del promedio
- **WHEN** el moderador, tras el revelado con votos 8, 8 y 13, visualiza las opciones de resolución
- **THEN** el sistema le ofrece "Aceptar 8" y "Aceptar 13", sin un botón "Aceptar moda (8)" adicional

#### Scenario: La moda se ofrece si no es una carta vecina del promedio
- **WHEN** el moderador, tras el revelado con votos 3, 3, 3 y 21 (promedio 7,5, entre 5 y 8), visualiza las opciones de resolución
- **THEN** el sistema le ofrece "Aceptar 5", "Aceptar 8" y "Aceptar moda (3)"

#### Scenario: Solo el moderador ve los botones de cartas vecinas
- **WHEN** un participante que no es el moderador visualiza el revelado
- **THEN** el sistema le muestra el promedio, pero no los botones para aceptar las cartas vecinas

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

