## ADDED Requirements

### Requirement: Las llamadas a servicios AWS dentro de una acción quedan trazadas con X-Ray

Cada invocación de las Lambdas de `realtime-api` (`connect`, `disconnect`, `default`) SHALL generar un trace de AWS X-Ray cuyo segmento raíz sea la invocación misma, con un subsegmento por cada llamada saliente a un servicio de AWS (DynamoDB, API Gateway Management API) realizada durante esa invocación, incluida su duración individual.

Esto no incluye el salto entrante desde API Gateway: X-Ray no soporta tracing para WebSocket APIs en API Gateway, solo para REST APIs. El segmento raíz del trace es la propia invocación de Lambda, no un segmento de API Gateway.

#### Scenario: Procesar una acción deja ver el tiempo de cada llamada a AWS
- **WHEN** el handler `default` procesa una acción que hace una o más llamadas a DynamoDB
- **THEN** el trace de esa invocación incluye un subsegmento por cada llamada, con su duración

#### Scenario: Un broadcast queda visible en el trace
- **WHEN** el procesamiento de una acción dispara un broadcast a otros participantes de la sala
- **THEN** el trace incluye un subsegmento por cada llamada a la API Gateway Management API involucrada en ese broadcast

### Requirement: El trace de una acción se puede filtrar por sala

El trace generado al procesar una acción en el handler `default` SHALL incluir, como annotations indexadas, el `roomId` de la sala involucrada (cuando exista) y el nombre de la acción, para poder ubicar los traces de una sala específica sin inspeccionar cada uno manualmente.

#### Scenario: Buscar los traces de una sala específica
- **WHEN** se necesita encontrar los traces correspondientes a una sala determinada
- **THEN** existe una annotation de `roomId` en cada trace que permite filtrarlos por ese valor, de forma análoga a como se filtran los logs
