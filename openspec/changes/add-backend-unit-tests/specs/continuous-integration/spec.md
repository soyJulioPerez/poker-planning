## ADDED Requirements

### Requirement: Ningún proyecto pasa su verificación por no tener tests

Ningún proyecto del workspace SHALL declarar que su tarea de test pasa cuando no encuentra tests. La tarea de test de un proyecto sin tests SHALL fallar.

`apps/realtime-api` —donde vive toda la lógica de dominio del producto— está hoy en verde con cero cobertura gracias a esa opción. Mientras esté puesta, borrar todos los tests por accidente (un merge mal resuelto, un archivo que nunca se agrega) deja la verificación en verde y nadie se entera. Es configuración que da falsa sensación de cobertura, que es peor que no tenerla.

#### Scenario: Un proyecto sin tests deja la verificación en rojo

- **WHEN** se ejecuta la tarea de test de un proyecto que no tiene ningún archivo de tests
- **THEN** la tarea falla

#### Scenario: Perder los tests de un proyecto se nota

- **WHEN** los archivos de tests de un proyecto desaparecen del árbol de trabajo
- **THEN** la verificación queda en rojo en el pull request, en vez de pasar en silencio
