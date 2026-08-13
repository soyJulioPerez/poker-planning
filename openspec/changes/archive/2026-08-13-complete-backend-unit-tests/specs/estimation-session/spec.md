## MODIFIED Requirements

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
