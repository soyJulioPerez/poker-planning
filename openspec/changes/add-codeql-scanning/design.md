## Context

`.github/workflows/` hoy tiene cuatro workflows: `ci.yml` (portón de verificación + deploy encadenado), `build-mobile.yml`, `deploy-backend.yml` y `deploy-web.yml`. Ninguno hace análisis estático de seguridad. El repo tampoco tiene forma automática de detectar si algún día se commitea un secreto.

`infra/env.json` es la config local de SAM (`DYNAMODB_ENDPOINT`, `TABLE_NAME`, `AWS_REGION` por función) que cada quien genera copiando `infra/env.json.example`. La intención declarada por el propio ejemplo (`"Copiar a env.json (ignorado por git)..."`) es que el real nunca se trackee.

**Verificado antes de escribir este diseño:**

```
$ git ls-files -- infra/
infra/deploy-permissions-policy.json
infra/env.json.example
infra/samconfig.toml
infra/template.yaml

$ git log --all --full-history --oneline -- infra/env.json
(sin resultados)

$ git check-ignore -v infra/env.json
.gitignore:60:infra/env.json    infra/env.json
```

`infra/env.json` **no está trackeado, nunca lo estuvo** (ni en la rama actual ni en ninguna otra del repo — `--all` lo cubre), y la entrada de `.gitignore` existe y lo alcanza. La intención se cumple de hecho, no solo de nombre. No hay secretos que rotar ni historial que limpiar.

## Goals / Non-Goals

**Goals:**

- CodeQL corriendo en CI para JavaScript/TypeScript, cubriendo `apps/web` y `apps/realtime-api` sin necesitar un job por app (CodeQL analiza por lenguaje, no por proyecto de Nx).
- Dejar registrado, con evidencia, que `infra/env.json` no filtra secretos y que la plantilla (`env.json.example`) cumple su rol.
- Dejar **explícitamente pendiente y documentado** —no implementado, no intentado a ciegas— el toggle de secret scanning + push protection en Settings del repo.

**Non-Goals:**

- **Secret scanning + push protection**: es un ajuste de Settings del repositorio en GitHub, no un archivo versionable. En algunos planes de organización (GitHub Free para repos privados, por ejemplo) ni siquiera está disponible, y en los que sí, el endpoint de la API (`PATCH /repos/{owner}/{repo}` con `security_and_analysis`) requiere permisos de administración del repo que un workflow de CI no tiene por diseño. Se documenta como checkbox sin marcar en `tasks.md` y como paso manual en la descripción del PR.
- **Dependabot** (Fase 5.1) y **`npm audit` en CI** (Fase 5.2): en changes propios de agentes hermanos, en paralelo. Este change no toca `.github/dependabot.yml` ni agrega jobs de auditoría de dependencias.
- **Rotar credenciales**: no aplica — la revisión de `infra/env.json` no encontró secretos commiteados. Si lo hubiera encontrado, esa habría sido la primera Non-Goal a levantar como hallazgo separado, no algo para resolver en este mismo change.

## Decisions

### Decisión 1: un solo lenguaje (`javascript-typescript`), sin matrix

CodeQL identifica `javascript-typescript` como un único lenguaje de análisis desde que unificó los packs de consultas de JS y TS (el nombre viejo `javascript` sigue aceptado como alias). Como `apps/web` (Angular/TS) y `apps/realtime-api` (Node/TS) son ambos JS/TS, **un solo lenguaje cubre las dos apps** sin necesitar un job por proyecto.

**Elegido**: job único, `languages: [ 'javascript-typescript' ]`, sin `strategy.matrix`.

**Alternativa descartada — matrix con una entrada**: es el patrón que emite el generador por defecto de GitHub cuando hay más de un lenguaje (para paralelizar C++ y Python, por ejemplo). Con un solo lenguaje, el matrix no compra paralelismo — agrega una capa de indirección sin beneficio. El roadmap deja elegir ("con matrix o config simple"); acá la config simple es estrictamente más clara.

### Decisión 2: sin build previo — CodeQL para JS/TS no lo necesita

A diferencia de lenguajes compilados (Java, C++, Go), el extractor de CodeQL para JavaScript/TypeScript **parsea el código fuente directamente**, sin ejecutar `tsc` ni bundlear nada. No hace falta `npm ci`, no hace falta `nx build`, y el step `autobuild` (pensado para lenguajes compilados) no aporta nada acá.

**Elegido**: `actions/checkout` → `github/codeql-action/init` → `github/codeql-action/analyze`, sin pasos de instalación de dependencias.

**Por qué importa**: es consistente con la Fase 1 — nada del pipeline de CI debería depender de una instalación completa de `node_modules` si el análisis no lo necesita. Menos pasos, menos superficie de fallo, corridas más rápidas.

### Decisión 3: query suite por defecto, no `security-extended`

CodeQL permite ampliar la cobertura con `queries: security-extended` o `security-and-quality`, a costa de más hallazgos (y más falsos positivos).

**Elegido**: el set por defecto que trae el workflow provisto por GitHub (`codeql-action` sin `queries:` explícito), que es exactamente lo que pide el criterio de aceptación del roadmap ("workflow provisto por GitHub").

**Por qué**: la Fase 5.2 (`npm audit` en CI, change hermano) ya dejó anotada la trampa de la señal ruidosa: *"si rompe el build por todo, en dos semanas alguien le pone `|| true` y ahí se pierde la señal para siempre"*. Empezar con el set por defecto y ampliar después si hace falta es más barato que empezar ruidoso y tener que podar. CodeQL además no rompe el build (ver Decisión 4): los resultados van a la pestaña Security, no al check de CI, así que el costo de "ampliar de más" es menor que en `npm audit` — pero el criterio de "no ensuciar la señal antes de tener una razón" aplica igual.

### Decisión 4: los hallazgos no rompen el check de CI

`codeql-action/analyze` sube resultados a la pestaña **Security → Code scanning alerts** del repo. No hace fallar el job por default salvo que se pida explícitamente (`fail-on: error/warning` no está seteado acá).

**Elegido**: dejarlo así — CodeQL informa, no bloquea. El criterio de aceptación del roadmap pide que esté "activo", no que sea un gate.

**Riesgo aceptado y anotado**: un repo que nunca mira la pestaña Security tiene el mismo problema que una alarma que nunca se prueba (ver Fase 4.2 del roadmap: "una alarma que nunca se vio disparar no existe"). Mitigación mínima: dejarlo anotado en `docs/hardening-roadmap.md` como algo a revisar tras la primera corrida real (ver Migration Plan). Convertirlo en gate obligatorio, si hiciera falta, queda fuera de este change — es una decisión de política, no de implementación.

### Decisión 5: triggers — PR, push a `develop`/`master`, y cron semanal

```yaml
on:
  push:
    branches: [develop, master]
  pull_request:
    branches: [develop, master]
  schedule:
    - cron: '0 4 * * 1'   # lunes 04:00 UTC
```

**Por qué no `release/**` como `ci.yml`**: el roadmap pide explícitamente "push a develop/master". Los pushes a `release/**` ya generaron un PR contra `develop` que corrió el análisis; agregar `release/**` duplicaría la corrida sin cubrir código distinto (mismo contenido, otra rama). Se puede sumar después si aparece una razón concreta.

**Por qué cron semanal**: CodeQL actualiza sus packs de consultas con el tiempo — código que no cambió puede pasar a tener un hallazgo nuevo si aparece una regla nueva. Un cron semanal lo detecta sin esperar al próximo PR. La corrida de `schedule` toma el workflow **del branch por defecto del repo**, no de la rama donde se escribió — así que el cron empieza a correr recién cuando este change llegue a esa rama (ver Risks).

### Decisión 6: permisos mínimos

```yaml
permissions:
  actions: read
  contents: read
  security-events: write
```

`security-events: write` es el único permiso no estándar, y es el mínimo que pide `codeql-action/analyze` para poder subir resultados a la pestaña Security. Mismo patrón de permisos acotados que ya usa `ci.yml`.

## Risks / Trade-offs

**[Nadie mira la pestaña Security y los hallazgos se acumulan sin acción]** → Mitigación parcial: se anota en el roadmap como punto a revisar después de la primera corrida real (no hay forma de forzar esto desde el workflow mismo). Si en unas semanas no se está usando, la palanca es correcta: activar `security-extended` no ayuda a un problema de proceso, no de cobertura.

**[El cron semanal no corre hasta que el workflow exista en la rama por defecto del repo]** → No es un riesgo del diseño, es cómo funciona `schedule` en GitHub Actions. Una vez mergeado a `develop` (o a la rama que GitHub tenga configurada como default), empieza a correr en el próximo ciclo. No requiere acción adicional.

**[Falsos positivos generan la misma fatiga de alertas que `npm audit` sin acotar]** → Mitigación: Decisión 3 (set por defecto, no `security-extended`). Si en la práctica el volumen es bajo, se puede ampliar; si es alto, ya se empezó desde el piso más conservador.

**[La revisión de `infra/env.json` es un snapshot, no una garantía permanente]** → El check de `.gitignore` sigue vigente, pero nada impide que alguien fuerce el commit con `git add -f` en el futuro. Fuera de alcance de este change (sería un pre-commit hook o una regla de CI que grepee por el nombre del archivo en el diff) — se anota como posible mejora futura, no como parte de esta fase.

## Migration Plan

1. Agregar `.github/workflows/codeql.yml`.
2. Verificar en Actions que el workflow corre sobre un PR de prueba (este mismo) y termina sin error.
3. Confirmar en Security → Code scanning alerts que el análisis subió resultados (aunque sean cero hallazgos — confirma que el pipeline llegó hasta el final, no solo que no crasheó).
4. Documentar en `docs/hardening-roadmap.md` (subsección 5.3) qué quedó hecho y qué sigue pendiente (secret scanning manual).

**Rollback**: eliminar `.github/workflows/codeql.yml`. No hay estado persistente fuera de los resultados ya subidos a la pestaña Security, que GitHub conserva independientemente del workflow que los generó.

## Open Questions

Ninguna de alcance para lo que sí es código. La única pregunta abierta es la que este change deja **fuera** a propósito: cuándo y quién activa secret scanning + push protection en Settings — eso lo decide el dueño del repo, no este change.
