## ADDED Requirements

### Requirement: `nx.json` no declara plugins que no infieren nada

Todo plugin registrado en el arreglo `plugins` de `nx.json` SHALL inferir al menos un target en al menos un proyecto del workspace. Un plugin registrado que no infiere nada en ningún proyecto no configura una capacidad del workspace: da la apariencia de una capacidad que no existe.

#### Scenario: Un plugin sin targets inferidos no queda registrado

- **WHEN** se inspecciona el arreglo `plugins` de `nx.json`
- **THEN** cada entrada corresponde a un plugin que infiere al menos un target en al menos uno de los proyectos del workspace

### Requirement: Las dependencias del workspace corresponden a algo que se usa

`package.json` SHALL NOT declarar como `devDependency` un paquete cuyos executores o generadores no son invocados por ningún target del workspace, salvo que sea una dependencia transitiva necesaria de un paquete que sí se usa.

#### Scenario: Ninguna devDependency queda huérfana

- **WHEN** se revisa `package.json`
- **THEN** cada `devDependency` es usada por algún target del workspace, o es requerida por otra que sí lo es

### Requirement: `nx.json` no declara un release de configuración inválida

Si `nx.json` declara un bloque `release`, este SHALL referenciar únicamente proyectos que existen en el workspace, y SHALL corresponder a un modelo de versionado que el repositorio efectivamente sigue.

#### Scenario: Sin bloque `release`, `nx release` usa el comportamiento por defecto de Nx

- **WHEN** no hay un bloque `release` en `nx.json`
- **THEN** `nx release` opera sobre el comportamiento por defecto en vez de fallar por una configuración que referencia un proyecto inexistente
