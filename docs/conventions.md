# Lineamientos del repositorio

Convenciones de trabajo de este proyecto: cómo se nombran las ramas, cómo se escriben los commits, dónde va cada documento y qué idioma se usa en cada lugar.

**Este documento no repite lo que ya está escrito en otro lado.** Para los temas que ya tienen su propia guía, hay un puntero. Lo que contiene de propio son las convenciones que hasta ahora vivían solo en la cabeza de quien las aplicaba.

## Dónde vive cada cosa

| Tema | Documento |
|---|---|
| Ramas, ambientes, rollback | [git-branching-strategy.md](git-branching-strategy.md) |
| Levantar el entorno local (web y mobile) | [local-dev-workflow.md](local-dev-workflow.md) |
| Desplegar a AWS por ambiente | [aws-deployment.md](aws-deployment.md) |
| Setup de credenciales OIDC (paso único) | [aws-oidc-setup.md](aws-oidc-setup.md) |
| Builds instalables de mobile para QA | [mobile-preview-builds.md](mobile-preview-builds.md) |
| Aprendizajes de los tests e2e | [e2e-lessons-learned.md](e2e-lessons-learned.md) |
| Plan de mejoras pendientes | [hardening-roadmap.md](hardening-roadmap.md) |
| Convenciones de Nx para agentes de IA | [../CLAUDE.md](../CLAUDE.md) |
| Comportamiento vigente del producto | `openspec/specs/` |
| Historial de decisiones de diseño | `openspec/changes/archive/` |

## Idioma

| Qué | Idioma |
|---|---|
| Identificadores de código (variables, funciones, archivos, tipos) | Inglés |
| Comentarios en el código | Español |
| Documentación (`docs/`, README) | Español |
| Artefactos de OpenSpec (`proposal.md`, `design.md`, `tasks.md`, specs) | Español |
| Mensajes de commit | Español (con el prefijo de tipo en inglés) |
| Nombres de rama | Inglés |

La regla de fondo: **lo que ejecuta una máquina va en inglés, lo que lee una persona va en español.**

> Los changes ya archivados en `openspec/changes/archive/` no se traducen retroactivamente: son un registro histórico de lo que se decidió y cuándo, no documentación viva.

## Git

### Nombres de rama

Formato: `<tipo>/<descripción-en-kebab-case>`

El `<tipo>` es el mismo vocabulario de Conventional Commits que ya se usa en los mensajes:

| Prefijo | Cuándo |
|---|---|
| `feature/` | funcionalidad nueva |
| `fix/` | corrección de bug |
| `refactor/` | reestructurar sin cambiar comportamiento |
| `docs/` | solo documentación |
| `chore/` | mantenimiento, dependencias, configuración |
| `ci/` | pipelines y workflows |
| `test/` | solo tests |

Reglas de forma:

- **kebab-case, todo en minúsculas** — `docs/hardening-roadmap`, no `docs/HardeningRoadmap`.
- **Sin acentos ni caracteres no ASCII.** Git los soporta, pero se rompen en URLs, en algunos runners de CI y al copiar entre sistemas.
- Las minúsculas no son cosmética: en Windows los refs son case-insensitive en el filesystem pero case-sensitive en Git, y `docs/Revision` vs `docs/revision` colisionan de formas confusas.

> Ramas anteriores a esta convención (`feature/ConfiguraciónDeAmbientes`, `refactor/ExtraerLogicaDeAplicacionWeb`) quedan como están. No se renombran retroactivamente.

### Mensajes de commit

[Conventional Commits](https://www.conventionalcommits.org/): `<tipo>: <descripción en español, en imperativo>`

```
feat: agrega spinner al entrar a una sala
fix: corrige el cálculo de moda para mazos no numéricos
docs: marca la tarea 8.4 como verificada en vivo
chore: configura skills y mcp de nx
```

Mismo conjunto de tipos que los prefijos de rama. Esta correspondencia no es casual: cuando se agregue `commitlint` (Fase 7.2 del roadmap), la validación sale gratis porque el vocabulario ya coincide.

### Merge a `develop`

**Squash merge es la regla. Fast-forward es la excepción.**

El flujo completo está en [git-branching-strategy.md](git-branching-strategy.md). El criterio para elegir entre uno y otro:

| | Cuándo | Cómo |
|---|---|---|
| **Squash** (regla) | Por defecto, siempre que no aplique la excepción | `git merge --squash <rama>` + `git commit` |
| **Fast-forward** (excepción) | La rama trae commits limpios y separados a propósito que vale la pena conservar en la historia | `git merge --ff-only <rama>` |

La prueba para usar fast-forward es exigente: **la historia de la rama tiene que estar ya exactamente como se la quiere ver en `develop`**. Sin `WIP`, sin "arregla typo", sin idas y vueltas. Si hay una sola cosa que no querrías ver en el log de `develop` dentro de un año, es squash.

No debería pasar seguido. La regla del squash existe porque la mayoría de las ramas acumulan ruido; la excepción existe porque aplastar una separación hecha con intención también destruye información.

*Ejemplo real*: la rama `docs/hardening-roadmap` se mergeó con `--ff-only` porque traía un `docs:` y un `chore:` deliberadamente separados, ambos con mensaje definitivo.

### Commit directo a `develop` — excepción temporal

**Aceptable** para cambios que no pueden romper un build ni un test —documentación, configuración de tooling— hechos por quien mantiene el repo.

**Esta excepción vence con la Fase 1.3 del [roadmap](hardening-roadmap.md).** Cuando GitHub exija PR para mergear a `develop`, deja de ser una decisión y pasa a ser imposible. No hay que acordarse de derogarla: se deroga sola.

El razonamiento, para que no se lea como pereza disfrazada de regla:

Con fast-forward, **ramificar y no ramificar producen una historia idéntica**. Cortar una rama desde `develop`, commitear y hacer `--ff-only` deja exactamente los mismos commits, en el mismo orden, que commitear directo. La rama no deja rastro de haber existido.

Entonces la rama no vale por la historia que produce, sino por ser **el punto donde se engancha un control**: un PR con CI corriendo, un diff que alguien revisa, una aprobación. Hoy ese control no existe —no hay CI (Fase 1.1), ni e2e en PRs (1.2), ni branch protection (1.3)— así que la rama no ancla nada.

La pregunta correcta no es *"¿esta rama va a vivir lo suficiente?"* sino **"¿este cambio necesita pasar por un control antes de aterrizar?"**. Mientras la respuesta sea "no existe el control", la rama es ceremonia. Cuando exista, será "sí" para casi todo y la pregunta desaparece.

Lo que sí sigue justificando una rama hoy: trabajo que se extiende por varias sesiones, que acumula commits de naturaleza distinta, o que puede necesitar abandonarse a mitad de camino.

## Flujo de trabajo

**Todo cambio de comportamiento pasa por OpenSpec.** Antes de escribir código: `/opsx:propose` (o `/opsx:new` para ir paso a paso). El resultado son `proposal.md`, `design.md`, `specs/` y `tasks.md`, que quedan como registro de por qué se hizo lo que se hizo.

Excepciones razonables: correcciones triviales, documentación, y mantenimiento de configuración.

Al terminar: `/opsx:verify` y después `/opsx:archive`. Los changes archivados en `openspec/changes/archive/` son la memoria de diseño del proyecto — la razón por la que se puede reconstruir una decisión meses después.

## Dónde va cada documento

Hay dos carpetas de documentación y la diferencia no es obvia:

| Va en | Qué |
|---|---|
| `docs/` | Guías operativas: cómo levantar algo, cómo desplegar, cómo debuggear. Le hablan a una persona que quiere **hacer** algo. |
| `openspec/` | Especificación de comportamiento y registro de decisiones. Le hablan a alguien que quiere **entender** por qué el sistema es como es. |

### Problemas conocidos: un solo archivo

Todo problema conocido va a **[known-issues.md](known-issues.md)**, sin importar su naturaleza: infraestructura, tooling, tests inestables o bugs de producto detectados al verificar un change.

Hasta el 2026-08-10 había dos archivos con el mismo nombre —uno en `docs/` y otro en `openspec/`— con contenidos distintos y sin nada en el nombre que permitiera saber cuál era cuál. Se fusionaron en el de `docs/`.

El criterio de la separación era defendible en abstracto (tooling vs. producto), pero en la práctica obligaba a decidir la categoría antes de poder anotar el problema, y a buscar en dos lugares para encontrarlo. Un archivo con secciones cuesta menos que dos archivos con una regla.

## Código

- **Nx para todas las tareas**: `nx build`, `nx test`, `nx lint` — nunca la herramienta subyacente directamente. Ver [../CLAUDE.md](../CLAUDE.md).
- **Lógica compartida en `packages/`**: si algo lo necesitan web y mobile, va en `packages/room-client-runtime` o `packages/shared-contracts`, no duplicado en cada app. Cada app aporta solo su capa de UI y su persistencia de sesión.
- **Límites entre proyectos**: `@nx/enforce-module-boundaries` está activa y **se aplica de verdad**. Cada proyecto lleva dos tags: uno de `scope:*` (a qué parte del producto pertenece) y uno de `type:*` (qué clase de artefacto es).

  | Proyecto | Tags | Puede depender de |
  |---|---|---|
  | `shared-contracts` | `scope:shared`, `type:util` | nadie |
  | `room-client-runtime` | `scope:client`, `type:feature` | `shared` |
  | `web` | `scope:web`, `type:app` | `client`, `shared` |
  | `mobile` | `scope:mobile`, `type:app` | `client`, `shared` |
  | `realtime-api` | `scope:api`, `type:app` | `shared` |
  | `e2e` | `scope:e2e`, `type:e2e` | `shared` |

  Las reglas de fondo: **web y mobile no se ven entre sí ni ven la API** (comparten a través de `room-client-runtime`); **la API no ve código de cliente** (el WebSocket es un límite de red, no un import); y **nadie depende de una app**. Configurado en [../eslint.config.mjs](../eslint.config.mjs); el porqué de cada decisión está en el change `enable-module-boundaries`.

- **Proyectos nuevos: siempre con `--tags`**. Los generadores de Nx aceptan el flag pero **no infieren tags** — si se omite, el proyecto queda con `"tags": []` y no puede importar nada, porque la regla lo trata como fuera de toda constraint. Fue exactamente el origen del problema que resolvió la Fase 3.1.

  ```bash
  npx nx g @nx/js:library packages/lo-que-sea --tags=scope:shared,type:util
  ```
- **Tests**: el target es `test` en los 5 proyectos. Jest en `realtime-api`, `mobile` y `packages/*`; Vitest en `web`, vía el builder oficial `@angular/build:unit-test` (no Analog); Playwright para e2e. No mezclar runners dentro de un proyecto. En Windows, ver la nota de casing en [known-issues.md](known-issues.md) antes de pelear con un fallo de `TestBed`.

## Decisiones pendientes

Resumen de lo marcado arriba, más lo que sale del roadmap:

- [x] ~~Definir el esquema de tags y activar los boundaries~~ — hecho en la Fase 3.1 (change `enable-module-boundaries`)
- [x] ~~Resolver los 2 errores de accesibilidad de `reveal-panel`~~ — hecho en el change `fix-room-ui-accessibility`. `nx lint` pasa en los 6 proyectos, así que la Fase 1.1 ya no tiene prerrequisitos de lint.
- [ ] `CODEOWNERS` y plantilla de PR (Fase 7.2 del roadmap)
