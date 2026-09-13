## MODIFIED Requirements

### Requirement: Un error o degradación real del backend dispara una notificación

Cuando el flag `AlarmsEnabled` esté activo para un ambiente, el sistema SHALL enviar una notificación por email cuando ocurra cualquiera de: la tasa de errores combinada de las Lambdas de `realtime-api` supere el umbral del ambiente en una ventana de 5 minutos, ocurra al menos un throttle de Lambda, la duración p99 combinada de las Lambdas supere el umbral configurado, o la tasa de `IntegrationError` del WebSocket API supere el umbral del ambiente.

El flag `AlarmsEnabled` SHALL estar apagado por defecto — tanto en el valor por defecto del parámetro de CloudFormation como en la configuración explícita de los 3 ambientes (`dev`, `qa`, `prod`). Mientras esté apagado en un ambiente, ninguno de los recursos de alarma ni el topic de notificación SHALL existir desplegado en ese ambiente.

#### Scenario: Errores de Lambda por encima del umbral notifican, con el flag activo
- **WHEN** el flag `AlarmsEnabled` está activo para el ambiente y la cantidad de errores combinados de las tres Lambdas en una ventana de 5 minutos supera el umbral configurado
- **THEN** se dispara una alarma que notifica por email

#### Scenario: Un throttle de Lambda notifica, con el flag activo
- **WHEN** el flag `AlarmsEnabled` está activo para el ambiente y ocurre al menos un throttle en cualquiera de las tres Lambdas
- **THEN** se dispara una alarma que notifica por email

#### Scenario: Duración p99 por encima del umbral notifica, con el flag activo
- **WHEN** el flag `AlarmsEnabled` está activo para el ambiente y el p99 de duración de la Lambda más lenta de las tres supera el umbral configurado
- **THEN** se dispara una alarma que notifica por email

#### Scenario: Errores de integración del WebSocket API notifican, con el flag activo
- **WHEN** el flag `AlarmsEnabled` está activo para el ambiente y la cantidad de `IntegrationError` del WebSocket API en una ventana de 5 minutos supera el umbral configurado
- **THEN** se dispara una alarma que notifica por email

#### Scenario: Con el flag apagado no existe ningún recurso de alarma
- **WHEN** el flag `AlarmsEnabled` está apagado para un ambiente
- **THEN** ni el topic SNS, ni la suscripción por email, ni ninguna de las 4 alarmas de CloudWatch existen desplegados en ese ambiente, sin importar la tasa de errores real

#### Scenario: El flag está apagado por defecto en los 3 ambientes
- **WHEN** se inspecciona la configuración de `dev`, `qa` y `prod`
- **THEN** el valor de `AlarmsEnabled` es `'false'` en los 3
