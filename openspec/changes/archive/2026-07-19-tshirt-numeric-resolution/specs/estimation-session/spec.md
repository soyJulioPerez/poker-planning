## MODIFIED Requirements

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
