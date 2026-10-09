## MODIFIED Requirements

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
