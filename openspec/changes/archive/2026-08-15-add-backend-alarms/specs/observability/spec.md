## ADDED Requirements

### Requirement: Un error o degradación real del backend dispara una notificación

El sistema SHALL enviar una notificación por email cuando ocurra cualquiera de: la tasa de errores combinada de las Lambdas de `realtime-api` supere el umbral del ambiente en una ventana de 5 minutos, ocurra al menos un throttle de Lambda, la duración p99 combinada de las Lambdas supere el umbral configurado, o la tasa de `IntegrationError` del WebSocket API supere el umbral del ambiente.

#### Scenario: Errores de Lambda por encima del umbral notifican
- **WHEN** la cantidad de errores combinados de las tres Lambdas en una ventana de 5 minutos supera el umbral configurado para el ambiente
- **THEN** se dispara una alarma que notifica por email

#### Scenario: Un throttle de Lambda notifica
- **WHEN** ocurre al menos un throttle en cualquiera de las tres Lambdas
- **THEN** se dispara una alarma que notifica por email

#### Scenario: Duración p99 por encima del umbral notifica
- **WHEN** el p99 de duración de la Lambda más lenta de las tres supera el umbral configurado
- **THEN** se dispara una alarma que notifica por email

#### Scenario: Errores de integración del WebSocket API notifican
- **WHEN** la cantidad de `IntegrationError` del WebSocket API en una ventana de 5 minutos supera el umbral configurado para el ambiente
- **THEN** se dispara una alarma que notifica por email

### Requirement: El umbral de errores no genera ruido desproporcionado por ambiente

El umbral de errores (tanto de Lambda como de `IntegrationError`) SHALL configurarse independientemente por ambiente, siguiendo el mismo criterio que ya separa la retención de logs por ambiente: el umbral de `prod` SHALL ser igual o más estricto que el de `dev`/`qa`, nunca más permisivo.

#### Scenario: El umbral de producción es igual o más estricto que el de desarrollo
- **WHEN** se comparan los umbrales de error configurados de `dev` y de `prod`
- **THEN** el de `prod` es igual o menor, nunca mayor
