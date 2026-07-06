# Estimation Session

## Purpose

TBD

## Requirements

### Requirement: Selección de mazo de estimación
El sistema SHALL permitir al moderador elegir, al crear la sala, entre un conjunto de mazos predefinidos (por ejemplo Fibonacci y variantes) que se usarán durante toda la sesión.

#### Scenario: Moderador selecciona un mazo al crear la sala
- **WHEN** el moderador crea una sala y selecciona uno de los mazos predefinidos disponibles
- **THEN** el sistema asocia ese mazo a la sala y lo utiliza para todas las rondas de votación de la sesión

### Requirement: Votación oculta
El sistema SHALL permitir que cada participante habilitado para votar emita un voto sobre la historia actual, manteniendo dicho voto oculto para el resto hasta el revelado.

#### Scenario: Participante emite su voto
- **WHEN** un participante selecciona una carta del mazo para la historia actual
- **THEN** el sistema registra su voto y muestra al resto de los participantes únicamente que ese participante ya votó, sin revelar el valor

### Requirement: Revelado simultáneo
El sistema SHALL permitir únicamente al moderador revelar los votos de la ronda actual, mostrando todos los votos a todos los participantes al mismo tiempo.

#### Scenario: Moderador revela los votos
- **WHEN** el moderador ejecuta la acción de revelar con al menos un voto emitido
- **THEN** el sistema muestra a todos los participantes el valor votado por cada uno, de forma simultánea

### Requirement: Cálculo de promedio y moda
El sistema SHALL calcular y mostrar, tras el revelado, el promedio y la moda de los votos numéricos emitidos en la ronda.

#### Scenario: Revelado con votos numéricos variados
- **WHEN** los votos revelados incluyen valores numéricos del mazo
- **THEN** el sistema muestra el promedio calculado y el valor (o valores, en caso de empate) que constituyen la moda

### Requirement: Resolución manual de la historia
El sistema SHALL permitir únicamente al moderador definir el valor final de estimación de la historia actual tras el revelado, ya sea aceptando el promedio, aceptando la moda (solo cuando existe un único valor de moda), o seleccionando el voto numérico de un participante puntual como puntuación definitiva. Cuando la moda tiene más de un valor empatado, el sistema SHALL mostrar dichos valores como texto informativo, sin ofrecer un botón para aceptarlos directamente.

#### Scenario: Moderador acepta la moda como valor final
- **WHEN** el moderador, tras el revelado, la moda tiene un único valor y el moderador elige aceptarlo
- **THEN** el sistema asigna ese valor como la puntuación definitiva de la historia actual

#### Scenario: Moda empatada se muestra solo como texto informativo
- **WHEN** el moderador visualiza el revelado y la moda tiene más de un valor empatado
- **THEN** el sistema muestra los valores empatados como texto, sin un botón para aceptar la moda directamente

#### Scenario: Moderador selecciona el voto de un participante como valor final
- **WHEN** el moderador, tras el revelado, selecciona el voto numérico de un participante puntual
- **THEN** el sistema asigna ese valor como la puntuación definitiva de la historia actual

### Requirement: Nueva ronda de votación
El sistema SHALL permitir únicamente al moderador reiniciar la votación de la historia actual, descartando los votos previos de la ronda.

#### Scenario: Moderador inicia una nueva ronda tras no llegar a consenso
- **WHEN** el moderador ejecuta la acción de nueva ronda después de un revelado
- **THEN** el sistema descarta los votos anteriores de esa historia y habilita a los participantes a votar nuevamente

### Requirement: Avance a la siguiente historia
El sistema SHALL permitir al moderador, una vez resuelta la historia actual, avanzar a una nueva historia reiniciando el estado de votación.

#### Scenario: Moderador avanza tras resolver la historia
- **WHEN** el moderador confirma la puntuación final de la historia actual y avanza a la siguiente
- **THEN** el sistema registra la historia resuelta y habilita una nueva ronda de votación en estado limpio

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
