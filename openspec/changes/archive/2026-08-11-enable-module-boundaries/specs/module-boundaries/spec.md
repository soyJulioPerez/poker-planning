## ADDED Requirements

### Requirement: Todo proyecto del workspace declara sus tags

Todo proyecto del workspace SHALL declarar en su `project.json` al menos un tag de scope (`scope:*`) y uno de tipo (`type:*`). Un proyecto sin tags no puede participar de ninguna constraint, y la regla `@nx/enforce-module-boundaries` lo trata como incapaz de depender de nada.

El eje `scope:*` responde *"¿a qué parte del producto pertenece?"*. El eje `type:*` responde *"¿qué clase de artefacto es?"*.

#### Scenario: Cada proyecto tiene ambos ejes

- **WHEN** se inspecciona el `project.json` de cualquiera de los 6 proyectos del workspace
- **THEN** su array `tags` contiene exactamente un tag `scope:*` y un tag `type:*`

#### Scenario: Un proyecto nuevo sin tags no pasa desapercibido

- **WHEN** se agrega un proyecto al workspace sin tags y con un import de otro proyecto
- **THEN** `nx lint <proyecto>` falla con `A project without tags matching at least one constraint cannot depend on any libraries`

### Requirement: Las constraints reflejan la arquitectura real del workspace

La configuración de `@nx/enforce-module-boundaries` en `eslint.config.mjs` SHALL declarar una constraint por cada `scope:*` y `type:*` en uso, y NO SHALL declarar constraints para tags que ningún proyecto tiene.

En particular, `scope:shop` y `type:data` —boilerplate del generador de Nx— deben desaparecer: describen una arquitectura que este workspace no tiene.

#### Scenario: No quedan constraints huérfanas

- **WHEN** se comparan los `sourceTag` declarados en `eslint.config.mjs` contra los tags efectivamente asignados en los `project.json`
- **THEN** todo `sourceTag` corresponde a al menos un proyecto real
- **AND** `scope:shop` y `type:data` no aparecen en la configuración

### Requirement: El código compartido no depende de nadie

`shared-contracts` (`scope:shared`) SHALL depender únicamente de otros proyectos `scope:shared`. Es la base del grafo: contiene los contratos que consumen web, mobile y la API, y una dependencia hacia arriba invertiría la relación.

#### Scenario: shared-contracts intenta importar de un consumidor

- **WHEN** un archivo de `packages/shared-contracts` importa de `room-client-runtime`, `web`, `mobile` o `realtime-api`
- **THEN** `nx lint shared-contracts` falla con un error de `@nx/enforce-module-boundaries`

### Requirement: El runtime de cliente solo depende de lo compartido

`room-client-runtime` (`scope:client`) SHALL depender únicamente de proyectos `scope:client` o `scope:shared`. Es la lógica de sala común a web y mobile: si dependiera de una app dejaría de ser reutilizable, que es exactamente lo que el change `uncouple-client-logic` fue a resolver.

#### Scenario: El runtime importa de una app

- **WHEN** un archivo de `packages/room-client-runtime` importa de `web`, `mobile` o `realtime-api`
- **THEN** `nx lint room-client-runtime` falla con un error de `@nx/enforce-module-boundaries`

### Requirement: Las apps de cliente no se ven entre sí ni ven la API

`web` (`scope:web`) y `mobile` (`scope:mobile`) SHALL depender únicamente de `scope:client` y `scope:shared`, además de su propio scope. En particular no pueden importarse entre sí ni importar de `realtime-api`.

Comparten lógica a través de `room-client-runtime`, nunca directamente. La API es un servicio remoto al que se le habla por WebSocket, no una librería que se importa.

#### Scenario: La web importa del backend

- **WHEN** un archivo de `apps/web` importa de `apps/realtime-api`
- **THEN** `nx lint web` falla con un error de `@nx/enforce-module-boundaries`

#### Scenario: La web importa de mobile

- **WHEN** un archivo de `apps/web` importa de `apps/mobile`
- **THEN** `nx lint web` falla con un error de `@nx/enforce-module-boundaries`

#### Scenario: La web importa lógica compartida

- **WHEN** un archivo de `apps/web` importa de `room-client-runtime` o `shared-contracts`
- **THEN** `nx lint web` pasa sin errores de boundaries

### Requirement: La API solo depende de lo compartido

`realtime-api` (`scope:api`) SHALL depender únicamente de proyectos `scope:api` o `scope:shared`. No puede depender de `room-client-runtime`, que es código de cliente y no tiene lugar en un handler de Lambda.

#### Scenario: La API importa runtime de cliente

- **WHEN** un archivo de `apps/realtime-api` importa de `room-client-runtime`
- **THEN** `nx lint realtime-api` falla con un error de `@nx/enforce-module-boundaries`

### Requirement: Nadie depende de una aplicación

Ningún proyecto SHALL depender de un proyecto etiquetado `type:app`. Las aplicaciones son hojas del grafo: consumen librerías, no las proveen.

El eje `type:*` expresa esta regla declarativamente —ninguna constraint incluye `type:app` entre sus destinos permitidos— pero **hoy no es el mecanismo que la hace cumplir**. Las apps no tienen alias en `tsconfig.base.json`, así que el único modo de importarlas es por ruta relativa, y eso lo rechaza antes la sub-regla `Projects cannot be imported by a relative or absolute path` de la misma regla de ESLint.

O sea: la protección existe y es efectiva, pero por otra vía que la esperada. La constraint `type:*` pasa a ser el mecanismo activo en cuanto una app reciba un alias o aparezca una librería nueva. Se mantiene por eso, y porque documenta la intención de forma legible.

#### Scenario: Una librería importa de una app

- **WHEN** un proyecto `type:util` o `type:feature` importa de un proyecto `type:app`
- **THEN** `nx lint` de ese proyecto falla con un error de `@nx/enforce-module-boundaries`
- **AND** el error reportado es `Projects cannot be imported by a relative or absolute path`, no la violación de constraint por tag — verificado el 2026-08-10 importando `apps/web` desde `packages/shared-contracts`

### Requirement: El lint pasa en verde con los imports legítimos existentes

Con las constraints activas, `nx run-many -t lint --all` SHALL terminar sin ningún error de `@nx/enforce-module-boundaries` sobre el código existente. El grafo real del workspace ya respeta las reglas que se imponen; si algún import tuviera que moverse, es un hallazgo del change y no un ajuste silencioso de las reglas para acomodarlo.

#### Scenario: Lint limpio de boundaries en todo el workspace

- **WHEN** se ejecuta `nx run-many -t lint --all`
- **THEN** no se reporta ningún error de la regla `@nx/enforce-module-boundaries`

### Requirement: La regla está verificada, no solo configurada

El change SHALL incluir una verificación activa de que la regla efectivamente falla cuando se la viola. Una regla de boundaries que nunca se vio fallar no se sabe si funciona: puede estar deshabilitada, mal escrita o no alcanzar los archivos que se cree.

#### Scenario: Violación deliberada y reversión

- **WHEN** se agrega temporalmente un import de `apps/realtime-api` dentro de un archivo de `apps/web`
- **THEN** `nx lint web` falla con `@nx/enforce-module-boundaries`
- **AND** al revertir el import, `nx lint web` vuelve a pasar sin errores de boundaries

#### Scenario: La verificación ejercita una constraint por tag

Un import relativo entre proyectos falla por una sub-regla distinta a las constraints por tag. La verificación SHALL incluir al menos una violación por **alias** entre proyectos con tags incompatibles, de modo que el error reportado nombre los tags.

- **WHEN** se agrega temporalmente en `apps/realtime-api` un import por alias de `room-client-runtime`
- **THEN** `nx lint realtime-api` falla con `A project tagged with "scope:api" can only depend on libs tagged with "scope:api", "scope:shared"`
- **AND** al revertir el import, `nx lint realtime-api` vuelve a pasar sin errores de boundaries
