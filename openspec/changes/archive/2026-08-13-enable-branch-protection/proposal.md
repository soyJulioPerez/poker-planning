# El portón deja de ser una convención

## Why

[git-branching-strategy.md](../../../docs/git-branching-strategy.md) lo dice en su primera línea: *"Esto es una **convención de trabajo**, no algo forzado por herramientas (no hay branch protection rules configuradas todavía) — depende de seguir estos pasos, no de que Git lo impida."*

Las Fases 1.1 y 1.2 construyeron el portón: `verify` y `e2e` corren en cada pull request y en cada push a las ramas largas, y los deploys dependen de ambos. **Pero nada obliga a pasar por ahí.** Hoy cualquiera con acceso de escritura puede pushear directo a `master` y saltearse la verificación entera — el portón está en la puerta, pero la puerta está abierta.

**Por qué ahora**: el check existe, es verde y es rápido. Exigirlo no bloquea a nadie ni obliga a arreglar nada antes.

## What Changes

**Las dos ramas largas quedan protegidas**
- `develop` y `master` SHALL rechazar pushes directos. Todo entra por pull request.
- `verify` y `e2e` pasan a ser checks obligatorios. Un PR con cualquiera de los dos en rojo no se puede mergear.
- La rama debe estar al día con su base antes de mergear.
- Las reglas aplican también a quien administra el repositorio.

**La promoción a `master` deja de ser un push**
- **BREAKING (para el flujo, no para el producto)**: hoy la promoción es `git merge --ff-only` + `git push origin master --tags`. Un push directo deja de ser posible, así que pasa a ser un **pull request de `release/*` a `master`**, con merge commit — que además marca el release en la historia.
- El `--ff-only` desaparece como mecanismo. Su garantía —fallar si `master` divergió— la cubre *"Require branches to be up to date before merging"*.

**Documentación que vence con esta fase**
- La frase de `git-branching-strategy.md` sobre que no hay protección configurada.
- La excepción *"commit directo a `develop`"* de [conventions.md](../../../docs/conventions.md), escrita explícitamente con vencimiento acá.

## Capabilities

### Modified Capabilities

- `continuous-integration`: la verificación existe y corre, pero nada la hace obligatoria. Se agregan los requisitos de que las ramas largas solo avancen por pull request y de que un pull request no se pueda mergear sin la verificación en verde.

## Impact

**Configuración de GitHub** — no hay archivos versionados: la protección vive en la configuración del repositorio. Se aplica con `gh api` y se documenta en `docs/` qué reglas quedaron, para que sean auditables sin entrar a Settings.

**Documentación**
- `docs/git-branching-strategy.md` — la frase inicial, y el paso 4 del flujo de release (pasa de push a PR).
- `docs/conventions.md` — se elimina la excepción de commit directo.
- `docs/hardening-roadmap.md` — cierre de la Fase 1.3.

**Sin cambios de código.** Nada de `src/`, nada de workflows.

**Fuera de alcance**
- **Aprobaciones requeridas**: quedan en 0. Con un solo mantenedor, exigir 1 traba el repositorio, porque GitHub no permite aprobar el propio pull request. Se sube cuando entre la segunda persona.
- **`CODEOWNERS`**: es la Fase 7.2.
- **Proteger `release/*`**: son efímeras y ahí caen los fixes de estabilización, donde la ceremonia de un PR cuesta más de lo que aporta.
- **Rulesets**: se usa protección clásica (ver `design.md`, Decisión 1).
