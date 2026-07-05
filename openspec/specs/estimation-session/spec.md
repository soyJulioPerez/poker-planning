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
El sistema SHALL permitir únicamente al moderador definir el valor final de estimación de la historia actual tras el revelado, ya sea aceptando el promedio, aceptando la moda, o ingresando un valor manual.

#### Scenario: Moderador acepta la moda como valor final
- **WHEN** el moderador, tras el revelado, elige aceptar el valor de la moda
- **THEN** el sistema asigna ese valor como la puntuación definitiva de la historia actual

#### Scenario: Moderador sobreescribe con un valor manual
- **WHEN** el moderador, tras el revelado, ingresa un valor distinto al promedio y a la moda sugeridos
- **THEN** el sistema asigna ese valor manual como la puntuación definitiva de la historia actual

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
