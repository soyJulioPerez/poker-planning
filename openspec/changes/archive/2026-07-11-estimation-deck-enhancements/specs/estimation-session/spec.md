## MODIFIED Requirements

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
