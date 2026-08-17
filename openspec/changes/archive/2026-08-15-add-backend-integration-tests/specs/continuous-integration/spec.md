## ADDED Requirements

### Requirement: Las queries de `realtime-api` a DynamoDB se verifican contra una base real

`apps/realtime-api` SHALL tener una capa de tests de integración que ejecute sus queries a DynamoDB (single-table: claves compuestas, `begins_with`, TTL) contra una instancia real de DynamoDB Local, separada de los tests unitarios que mockean el SDK. Esta capa SHALL correr en CI, y SHALL crear y limpiar sus propios datos sin depender de estado compartido entre tests.

El target de tests unitarios existente SHALL seguir corriendo sin depender de Docker ni de DynamoDB Local.

#### Scenario: Una expresión de query incorrecta se detecta
- **WHEN** una query a DynamoDB usa una expresión de clave o de filtro incorrecta
- **THEN** el test de integración correspondiente falla contra la base real, aunque los tests unitarios mockeados sigan en verde

#### Scenario: Los tests unitarios no requieren Docker
- **WHEN** se ejecuta el target de tests unitarios de `realtime-api`
- **THEN** corre sin necesitar una instancia de DynamoDB Local ni Docker

#### Scenario: Los tests de integración no comparten estado
- **WHEN** corre la suite de tests de integración
- **THEN** cada test opera sobre datos propios que crea y limpia, sin depender del orden de ejecución ni de datos de otros tests

### Requirement: La cobertura de tests no baja del umbral ya alcanzado

`apps/realtime-api` SHALL tener un umbral de cobertura de tests configurado, fijado en el valor ya alcanzado por la suite en el momento de establecerlo. La verificación SHALL fallar si la cobertura baja de ese umbral.

#### Scenario: Una baja de cobertura deja la verificación en rojo
- **WHEN** un cambio reduce la cobertura de tests de `apps/realtime-api` por debajo del umbral configurado
- **THEN** la tarea de test correspondiente falla
