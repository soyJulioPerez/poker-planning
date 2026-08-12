## MODIFIED Requirements

### Requirement: Toda propuesta de cambio pasa por una verificación automática

El sistema SHALL ejecutar `lint`, `test` y `build` automáticamente sobre cada pull request y sobre cada push a `develop`, `release/**` y `master`, y SHALL ejecutar además la suite de tests end-to-end cuando el cambio la alcance según el grafo de dependencias. Un fallo en cualquiera de esas tareas SHALL dejar el check en rojo.

Se cubren los tres eventos y no solo el pull request porque la regla de merge del repositorio es **squash** ([conventions.md](../../../../docs/conventions.md)): el commit que aterriza en la rama de integración es uno nuevo, sintetizado en el merge, que nunca corrió como tal en el PR.

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

## ADDED Requirements

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
