# continuous-integration Specification

## Purpose
TBD - created by archiving change add-ci-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Toda propuesta de cambio pasa por una verificación automática

El sistema SHALL ejecutar `lint`, `test` y `build` automáticamente sobre cada pull request y sobre cada push a `develop`, `release/**` y `master`, y SHALL ejecutar además la suite de tests end-to-end cuando el cambio la alcance según el grafo de dependencias. Un fallo en cualquiera de esas tareas SHALL dejar el check en rojo.

Se cubren los tres eventos y no solo el pull request porque la regla de merge del repositorio es **squash** ([conventions.md](../../../docs/conventions.md)): el commit que aterriza en la rama de integración es uno nuevo, sintetizado en el merge, que nunca corrió como tal en el PR.

Los e2e corren **en paralelo** con `lint`/`test`/`build`, no después: son la etapa más lenta del portón y ponerlos en serie demoraría el feedback rápido sin ganar nada.

#### Scenario: Un PR con un test roto queda en rojo

- **WHEN** se abre o actualiza un pull request cuyo código rompe un test
- **THEN** el check de CI falla y queda visible como rojo en el pull request

#### Scenario: Un PR con un e2e roto queda en rojo

- **WHEN** se abre o actualiza un pull request cuyo código rompe un test end-to-end
- **THEN** el check de CI falla y queda visible como rojo en el pull request

#### Scenario: Un push a la rama de integración se verifica

- **WHEN** se pushea un commit a `develop`, a una rama `release/**` o a `master`
- **THEN** la misma verificación corre sobre ese commit, incluso si nació de un squash merge

#### Scenario: Un cambio solo de documentación no corre tareas

- **WHEN** el único cambio de un pull request está en `docs/` o en otro archivo de la raíz sin proyecto asociado
- **THEN** la verificación termina en verde sin ejecutar ninguna tarea, porque el único proyecto afectado es el raíz y no tiene targets

#### Scenario: El feedback rápido no espera a los e2e

- **WHEN** un pull request dispara tanto la verificación de `lint`/`test`/`build` como la suite end-to-end
- **THEN** ambas arrancan a la vez, y el resultado de la primera queda visible sin esperar a que la segunda termine

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

### Requirement: El alcance de los e2e lo decide el grafo, no una regla aparte

El sistema SHALL determinar si corresponde ejecutar la suite end-to-end usando el mismo grafo de dependencias de Nx que acota el resto de la verificación, y SHALL NOT usar una lista de rutas mantenida a mano.

Esto obliga a que la dependencia entre los tests end-to-end y las aplicaciones que ejercitan esté **declarada en el workspace**. No se puede inferir del código: los tests hablan con la app por HTTP y por el DOM, sin importar una sola línea de ella. Sin declararla, el grafo ve un proyecto aislado y la suite no correría casi nunca — un check verde que no prueba nada.

#### Scenario: Un cambio en la web alcanza a los e2e

- **WHEN** un pull request modifica únicamente archivos de `apps/web`
- **THEN** la suite end-to-end se ejecuta

#### Scenario: Un cambio en el backend alcanza a los e2e

- **WHEN** un pull request modifica únicamente archivos de `apps/realtime-api`
- **THEN** la suite end-to-end se ejecuta

#### Scenario: Un cambio en código compartido alcanza a los e2e por transitividad

- **WHEN** un pull request modifica `packages/shared-contracts`
- **THEN** la suite end-to-end se ejecuta, porque alcanza a las aplicaciones de las que depende

#### Scenario: Un cambio ajeno a las aplicaciones no ejecuta la suite

- **WHEN** un pull request modifica únicamente `docs/` o `apps/mobile`
- **THEN** la suite end-to-end no se ejecuta

#### Scenario: Una dependencia nueva entra al alcance sola

- **WHEN** una de las aplicaciones ejercitadas pasa a depender de un proyecto del workspace del que no dependía
- **THEN** un cambio en ese proyecto alcanza a la suite end-to-end, sin que nadie haya tenido que actualizar una lista de rutas

### Requirement: Los e2e corren contra un stack levantado por el propio pipeline

El sistema SHALL levantar las dependencias que la suite end-to-end necesita —base de datos, backend y frontend— como parte de la ejecución, y SHALL exponer ese mismo montaje como un comando reproducible en la máquina de desarrollo.

La reproducibilidad no es una comodidad: cuando el job falle, el diagnóstico empieza por reproducir lo que levantó el runner. Si ese conocimiento vive únicamente dentro de un YAML de CI, cada fallo cuesta un push para investigarlo.

#### Scenario: La suite arranca sin pasos manuales previos

- **WHEN** se ejecuta la suite end-to-end en modo integración continua
- **THEN** el backend y el frontend se levantan automáticamente desde artefactos ya construidos, y los tests esperan a que ambos acepten conexiones antes de arrancar

#### Scenario: El mismo montaje se reproduce en local

- **WHEN** una persona ejecuta en su máquina el comando de reproducción del modo de integración continua
- **THEN** se levanta el mismo stack que en el pipeline y la suite corre contra él

#### Scenario: El modo de iteración rápida no se altera

- **WHEN** una persona corre la suite con el entorno local ya levantado a mano
- **THEN** los tests corren contra ese entorno sin volver a levantar nada

### Requirement: Un fallo de e2e deja evidencia consultable sin reproducirlo

El sistema SHALL publicar los reportes y trazas de la suite end-to-end como artefacto de la corrida cuando haya fallos.

Un test end-to-end que falla en CI y solo deja un mensaje de timeout es indistinguible de un test inestable. La traza —que ya se genera en el primer reintento— es lo que separa un bug real de un flake, y sin publicarla se genera y se descarta.

#### Scenario: Un e2e fallido deja su traza descargable

- **WHEN** un test end-to-end falla en el pipeline
- **THEN** los reportes y trazas de la corrida quedan disponibles como artefacto descargable de esa corrida

### Requirement: Un job que no hizo falta no se confunde con uno que falló

Ningún job de verificación SHALL quedar en estado salteado por no corresponderle trabajo. Cuando no hay nada que verificar, el job SHALL terminar exitosamente sin ejecutar tareas.

En GitHub Actions un job salteado **arrastra a sus dependientes al mismo estado**. Como los deploys dependen de la verificación, un job de e2e que se saltea porque el cambio no lo alcanzaba apagaría los deploys en silencio — un modo de falla que no deja nada en rojo y que se descubre cuando alguien nota que producción no se actualizó.

Hoy la dependencia declarada entre los e2e y las aplicaciones hace que todo cambio desplegable alcance también a la suite, así que la situación no se da. La garantía igual tiene que estar escrita en la estructura del pipeline y no depender de esa coincidencia: el día que se agregue un job condicional más, o que cambie el alcance de los e2e, el modo de falla vuelve.

#### Scenario: Sin trabajo, el job termina en verde y no salteado

- **WHEN** un cambio no alcanza a la suite end-to-end según el grafo
- **THEN** el job termina exitosamente sin ejecutar la suite
- **AND** no queda en estado salteado, de modo que ningún job que dependa de él sea arrastrado a ese estado

### Requirement: Las ramas largas solo avanzan por pull request

El sistema SHALL rechazar todo push directo a `develop` y a `master`. Cualquier cambio en esas ramas SHALL entrar por un pull request.

La verificación automática existe desde la Fase 1.1, pero hasta ahora era posible esquivarla por completo: un push directo a `master` desplegaba a producción sin que ninguna tarea se hubiera ejecutado. Un portón que se puede rodear no es un portón.

Esto SHALL aplicar también a quien administra el repositorio. Una regla con excepción por rol no cambia nada cuando el repositorio lo mantiene una sola persona, que es justamente quien tendría la excepción.

#### Scenario: Un push directo a una rama larga es rechazado

- **WHEN** alguien intenta pushear un commit directamente a `develop` o a `master`
- **THEN** GitHub rechaza el push

#### Scenario: La regla no tiene excepción para administradores

- **WHEN** quien administra el repositorio intenta pushear directamente a una rama protegida
- **THEN** el push es rechazado igual que para cualquier otra persona

#### Scenario: La promoción de un release entra por pull request

- **WHEN** una rama `release/*` está lista para producción
- **THEN** se promueve abriendo un pull request contra `master`, no con un push directo
- **AND** el merge conserva los commits del release y agrega un commit de merge que identifica la versión

### Requirement: Un pull request no se puede mergear sin la verificación en verde

El sistema SHALL impedir el merge de un pull request cuyas tareas de verificación no hayan terminado exitosamente, y SHALL exigir que la rama esté al día con su base antes de permitirlo.

Los checks obligatorios SHALL ser únicamente los de verificación. Los jobs de despliegue SHALL NOT ser obligatorios: están acotados por `if:` a `master` y `release/**`, así que en un pull request quedan salteados por diseño, y un check requerido que nunca reporta deja el pull request bloqueado de forma permanente.

La exigencia de estar al día reemplaza a la garantía que daba `git merge --ff-only` en la promoción a `master`: fallar cuando la rama de destino avanzó por otro lado.

#### Scenario: Un pull request con la verificación en rojo no se puede mergear

- **WHEN** un pull request tiene la tarea de verificación o la suite end-to-end en rojo
- **THEN** GitHub bloquea el merge hasta que ambas pasen

#### Scenario: Un pull request desactualizado no se puede mergear

- **WHEN** la rama base avanzó después de la última verificación del pull request
- **THEN** GitHub exige actualizar la rama y volver a verificar antes de permitir el merge

#### Scenario: Un job de despliegue salteado no bloquea el merge

- **WHEN** un pull request termina con las verificaciones en verde y los jobs de despliegue salteados
- **THEN** el pull request se puede mergear

### Requirement: Ningún proyecto pasa su verificación por no tener tests

Ningún proyecto del workspace SHALL declarar que su tarea de test pasa cuando no encuentra tests. La tarea de test de un proyecto sin tests SHALL fallar.

`apps/realtime-api` —donde vive toda la lógica de dominio del producto— está hoy en verde con cero cobertura gracias a esa opción. Mientras esté puesta, borrar todos los tests por accidente (un merge mal resuelto, un archivo que nunca se agrega) deja la verificación en verde y nadie se entera. Es configuración que da falsa sensación de cobertura, que es peor que no tenerla.

#### Scenario: Un proyecto sin tests deja la verificación en rojo

- **WHEN** se ejecuta la tarea de test de un proyecto que no tiene ningún archivo de tests
- **THEN** la tarea falla

#### Scenario: Perder los tests de un proyecto se nota

- **WHEN** los archivos de tests de un proyecto desaparecen del árbol de trabajo
- **THEN** la verificación queda en rojo en el pull request, en vez de pasar en silencio

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

### Requirement: La cadena de dependencias se audita en cada verificación

El sistema SHALL ejecutar `npm audit` sobre el `package-lock.json` de la raíz del repositorio en cada pull request y en cada push a `develop`, `release/**` y `master`, en un job independiente que corre en paralelo al resto de la verificación.

El sistema SHALL definir explícitamente un umbral de severidad: una vulnerabilidad de severidad `critical` SHALL dejar el job en rojo. Vulnerabilidades de severidad `high`, `moderate` o `low` SHALL quedar visibles en el log del job, pero SHALL NOT hacerlo fallar.

Este job SHALL NOT usar el exit code silenciado (`|| true` o equivalente): un umbral que no rompe nunca el build no es una auditoría, es un log que nadie lee.

`apps/mobile` tiene su propio `package-lock.json`, separado del de la raíz, y queda fuera del alcance de este requirement.

#### Scenario: Una vulnerabilidad crítica deja el job en rojo

- **WHEN** el árbol de dependencias instalado tiene al menos una vulnerabilidad de severidad `critical`
- **THEN** el job de auditoría de dependencias falla

#### Scenario: Una vulnerabilidad de severidad menor no rompe el job

- **WHEN** el árbol de dependencias instalado tiene vulnerabilidades de severidad `high`, `moderate` o `low`, y ninguna `critical`
- **THEN** el job de auditoría de dependencias termina exitosamente
- **AND** el detalle de esas vulnerabilidades queda visible en el log del job

#### Scenario: El job corre en paralelo, no en serie

- **WHEN** se dispara la verificación de un pull request o de un push a una rama larga
- **THEN** el job de auditoría de dependencias arranca al mismo tiempo que `verify`, `test-integration` y `e2e`, sin esperar a que ninguno termine

### Requirement: Una vulnerabilidad crítica bloquea el despliegue automático

El sistema SHALL impedir que `deploy-backend` y `deploy-web` se ejecuten si el job de auditoría de dependencias falló.

#### Scenario: Un deploy no arranca con una vulnerabilidad crítica sin resolver

- **WHEN** el job de auditoría de dependencias falla en un push a `master` o a una rama `release/**`
- **THEN** `deploy-backend` y `deploy-web` no se ejecutan
