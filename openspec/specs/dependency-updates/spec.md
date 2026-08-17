# dependency-updates Specification

## Purpose
TBD - created by archiving change add-dependabot-config. Update Purpose after archive.
## Requirements

### Requirement: Las actualizaciones de dependencias llegan agrupadas por familia

El sistema SHALL agrupar las actualizaciones de dependencias por familia reconocible (Angular, Nx, Expo/React Native, AWS SDK, lint/format, testing, tooling de build) en vez de abrir un pull request por paquete.

Un pull request por paquete, a la cadencia con la que aparecen versiones nuevas en un workspace de ~90 dependencias, se ignora — es el problema que este requisito existe para resolver.

#### Scenario: Varios paquetes de la misma familia se actualizan la misma semana

- **WHEN** hay actualizaciones disponibles para dos o más paquetes de una misma familia agrupada (por ejemplo, `@aws-sdk/client-dynamodb` y `@aws-sdk/lib-dynamodb`)
- **THEN** Dependabot abre un único pull request que incluye ambas actualizaciones, no uno por paquete

#### Scenario: Cada ecosistema npm del repositorio se cubre por separado

- **WHEN** hay actualizaciones disponibles tanto en el `package.json` raíz como en `apps/mobile/package.json`
- **THEN** Dependabot abre pull requests independientes para cada uno, agrupados según las reglas de su propio directorio

### Requirement: La cadencia de revisión es semanal

El sistema SHALL revisar actualizaciones disponibles con una cadencia semanal, no diaria, en todos los ecosistemas configurados.

#### Scenario: Aparece una versión nueva de una dependencia

- **WHEN** se publica una versión nueva de un paquete cubierto por la configuración
- **THEN** Dependabot la recoge en su próxima revisión semanal programada, no en una corrida diaria

### Requirement: Los pull requests de dependencias pasan por el mismo portón de CI que cualquier otro

El sistema SHALL abrir las actualizaciones de dependencias como pull requests normales contra `develop`, sujetos al mismo pipeline de verificación (`nx affected -t lint test build`, más los checks obligatorios de branch protection) que cualquier otro pull request del repositorio.

No SHALL existir un camino que permita a una actualización de dependencias llegar a `develop` o a `master` sin pasar por CI.

#### Scenario: Un pull request de Dependabot dispara el pipeline de CI

- **WHEN** Dependabot abre un pull request contra `develop`
- **THEN** el workflow `ci.yml` corre sobre ese pull request igual que sobre cualquier otro, y sus checks obligatorios (`verify`, `e2e`) se aplican antes de permitir el merge

#### Scenario: Una actualización que rompe un test deja el pull request en rojo

- **WHEN** una actualización de dependencias agrupada rompe un test o el build
- **THEN** el pull request queda con el check de CI en rojo y no se puede mergear, igual que con cualquier otro cambio

### Requirement: Angular, Nx y Expo/React Native quedan fuera del agrupado automático de versiones mayores

El sistema SHALL excluir las actualizaciones de versión mayor (`major`) de los paquetes de Angular, Nx y Expo/React Native de cualquier agrupación automática. Esas actualizaciones SHALL llegar como pull requests individuales, sin agrupar.

Las versiones `minor` y `patch` de esas mismas familias SHALL poder agruparse igual que el resto — la exclusión aplica específicamente a `major`, porque es el caso que requiere una migración asistida (`nx migrate`, `expo upgrade`) en vez de un bump mecánico de `package.json`.

#### Scenario: Una versión mayor de Angular no se agrupa con otras actualizaciones

- **WHEN** hay una actualización de versión mayor disponible para un paquete de la familia `@angular/*`
- **THEN** Dependabot abre un pull request individual para ese paquete, no lo incluye en el grupo `angular` ni en ningún otro grupo

#### Scenario: Una versión mayor de Nx no se agrupa con otras actualizaciones

- **WHEN** hay una actualización de versión mayor disponible para un paquete de la familia `@nx/*` o para `nx`
- **THEN** Dependabot abre un pull request individual para ese paquete, no lo incluye en el grupo `nx` ni en ningún otro grupo

#### Scenario: Una versión mayor de Expo o React Native no se agrupa con otras actualizaciones

- **WHEN** hay una actualización de versión mayor disponible para `expo`, `react-native`, o un paquete relacionado del ecosistema Expo/React Native
- **THEN** Dependabot abre un pull request individual para ese paquete, no lo incluye en el grupo `expo-react-native` ni en ningún otro grupo

#### Scenario: Una versión menor de Angular sí se agrupa

- **WHEN** hay actualizaciones de versión menor o de parche disponibles para varios paquetes de `@angular/*`
- **THEN** Dependabot las agrupa en un único pull request, igual que con cualquier otra familia
