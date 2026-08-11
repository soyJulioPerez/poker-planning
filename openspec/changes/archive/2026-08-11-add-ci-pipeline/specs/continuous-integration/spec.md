## ADDED Requirements

### Requirement: Toda propuesta de cambio pasa por una verificación automática

El sistema SHALL ejecutar `lint`, `test` y `build` automáticamente sobre cada pull request y sobre cada push a `develop`, `release/**` y `master`. Un fallo en cualquiera de las tres tareas SHALL dejar el check en rojo.

Se cubren los tres eventos y no solo el pull request porque la regla de merge del repositorio es **squash** ([conventions.md](../../../../docs/conventions.md)): el commit que aterriza en la rama de integración es uno nuevo, sintetizado en el merge, que nunca corrió como tal en el PR.

#### Scenario: Un PR con un test roto queda en rojo

- **WHEN** se abre o actualiza un pull request cuyo código rompe un test
- **THEN** el check de CI falla y queda visible como rojo en el pull request

#### Scenario: Un push a la rama de integración se verifica

- **WHEN** se pushea un commit a `develop`, a una rama `release/**` o a `master`
- **THEN** la misma verificación corre sobre ese commit, incluso si nació de un squash merge

#### Scenario: Un cambio solo de documentación no corre tareas

- **WHEN** el único cambio de un pull request está en `docs/` o en otro archivo de la raíz sin proyecto asociado
- **THEN** la verificación termina en verde sin ejecutar ninguna tarea, porque el único proyecto afectado es el raíz y no tiene targets

### Requirement: La verificación se acota al grafo de dependencias

El sistema SHALL ejecutar las tareas únicamente sobre los proyectos afectados por el cambio, determinados por el grafo de dependencias de Nx y no por una lista de rutas mantenida a mano.

Para eso necesita dos cosas que hoy no están y son fáciles de omitir: historia de git completa en el checkout (`fetch-depth: 0`), y un SHA base correcto — el del último commit verificado con éxito, no el commit anterior.

#### Scenario: Un cambio acotado no arrastra al resto del workspace

- **WHEN** un pull request modifica únicamente archivos de `apps/web`
- **THEN** no se ejecutan los tests de `realtime-api` ni de `mobile`, verificable en el log del job

#### Scenario: Un cambio en código compartido alcanza a sus consumidores

- **WHEN** un pull request modifica `packages/shared-contracts`
- **THEN** se ejecutan las tareas de `web`, `mobile` y `realtime-api`, que dependen de él

#### Scenario: Un cambio en configuración raíz alcanza a todo

- **WHEN** un pull request modifica `package.json`, `nx.json`, `tsconfig.base.json` o `eslint.config.mjs`
- **THEN** se ejecutan las tareas de los 6 proyectos

### Requirement: Ninguna tarea del pipeline depende de un servicio externo de pago

Ninguna tarea que corra en la verificación SHALL invocar un servicio remoto que consuma cuota o requiera credenciales de terceros.

Esto no es una preferencia de costos: `nx build mobile` invoca hoy `eas build`, que encola un build en los servidores de Expo. Un pull request que toque `packages/shared-contracts` —dependencia de mobile— lo dispararía sin que nadie lo pidiera.

#### Scenario: Construir mobile produce un bundle local

- **WHEN** se ejecuta el target de build de `mobile`
- **THEN** se genera un bundle local con bytecode Hermes para android e ios más el bundle web
- **AND** no se contacta ningún servicio remoto ni se requiere `EXPO_TOKEN`

#### Scenario: Construir mobile no ensucia el árbol de trabajo

- **WHEN** se ejecuta el target de build de `mobile`, tanto si termina bien como si falla
- **THEN** `apps/mobile/package.json` y `apps/mobile/package-lock.json` quedan sin modificar

### Requirement: `nx affected` funciona en local sin argumentos

El workspace SHALL declarar su rama base por defecto, de modo que `nx affected` se pueda ejecutar en local sin pasar `--base`.

Sin eso, Nx cae a `main`, que no existe en este repositorio, y el comando falla — justamente el comando que hay que poder probar antes de escribirlo en un YAML, donde cada error cuesta un push.

#### Scenario: Comprobar el alcance de un cambio antes de pushear

- **WHEN** una persona ejecuta `npx nx affected -t lint` sobre su rama, sin argumentos adicionales
- **THEN** el comando compara contra la rama de integración y lista los proyectos afectados, sin error de revisión de git
