## 1. Revisión de `infra/env.json`

- [x] 1.1 Confirmar que `infra/env.json` no está trackeado: `git ls-files -- infra/`. → No aparece en el listado.
- [x] 1.2 Confirmar que nunca estuvo trackeado en ninguna rama: `git log --all --full-history --oneline -- infra/env.json`. → Sin resultados.
- [x] 1.3 Confirmar que `.gitignore` lo cubre: `git check-ignore -v infra/env.json`. → `.gitignore:60:infra/env.json infra/env.json`.
- [x] 1.4 Revisar el contenido de `infra/env.json.example` y confirmar que no tiene valores de un ambiente real (endpoints, credenciales), solo placeholders locales. → Solo `TABLE_NAME`/`AWS_REGION`/`DYNAMODB_ENDPOINT` de ejemplo (`172.17.0.2:8000`, la IP típica del contenedor de DynamoDB Local) y un `_comment` explicando el copiado. Sin credenciales.
- [x] 1.5 Dejar el hallazgo documentado en el reporte de cierre de este change. → Limpio: la intención (ejemplo trackeado, real ignorado) se cumple de hecho. No se tocó ningún archivo de esta sección.

## 2. Workflow de CodeQL

- [x] 2.1 Crear `.github/workflows/codeql.yml` con `github/codeql-action`, lenguaje `javascript-typescript`, sin matrix (ver `design.md`, Decisión 1).
- [x] 2.2 Sin paso de build/instalación de dependencias — el extractor de JS/TS no lo necesita (ver Decisión 2).
- [x] 2.3 Triggers: `pull_request` contra `develop`/`master`, `push` a `develop`/`master`, `schedule` semanal (ver Decisión 5).
- [x] 2.4 Permisos mínimos: `actions: read`, `contents: read`, `security-events: write` (ver Decisión 6).
- [x] 2.5 Sin `queries: security-extended` — se deja el set por defecto (ver Decisión 3).

## 3. Verificación

- [x] 3.1 `nx affected -t lint test build` en verde — este change no toca código de aplicación, así que no debería afectar ningún proyecto.
- [x] 3.2 Confirmar que el YAML es válido (parseado con `js-yaml` en local; sin errores de sintaxis).
- [ ] 3.3 Verificar en la pestaña Actions del PR que el job de CodeQL corre y termina sin error. **Pendiente de la corrida real** — se confirma una vez abierto el PR, no se puede verificar antes de que exista el evento `pull_request`.
- [ ] 3.4 Verificar en Security → Code scanning alerts que el análisis subió resultados (aunque sean cero hallazgos). **Pendiente de la corrida real**, mismo motivo que 3.3.

## 4. Documentación

- [x] 4.1 Actualizar `docs/hardening-roadmap.md`, subsección 5.3: marcar CodeQL y la revisión de `infra/env.json` como hechos, dejar el punto de secret scanning como pendiente con nota de acción manual.
- [x] 4.2 **No tocar la tabla "Estado" al principio del roadmap** — ese ítem queda fuera de este change.

## 5. Pendiente fuera de alcance — acción manual del dueño del repo

> Esto NO se implementa en este change. Ver `proposal.md` (Non-Goals) y `design.md` (Non-Goals) para el porqué: es un toggle de Settings de GitHub, no un archivo versionable, y en algunos planes de organización ni siquiera está expuesto vía API.

- [ ] 5.1 Activar **Secret scanning** en Settings → Code security del repositorio (requiere permisos de administración, fuera del alcance de un PR/CI).
- [ ] 5.2 Activar **Push protection** en la misma sección, una vez que secret scanning esté activo.

## 6. Cierre

- [ ] 6.1 `git fetch origin && git rebase origin/develop` antes de abrir el PR.
- [ ] 6.2 Abrir el PR contra `develop`, con el checklist de la sección 5 visible en la descripción para quien lo revise.
- [ ] 6.3 `/opsx:verify` y después `/opsx:archive` (la tarea 5 queda sin marcar en el archivo — es correcto, no un olvido).
