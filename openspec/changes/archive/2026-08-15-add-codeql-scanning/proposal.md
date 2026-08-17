## Why

El repo no tiene análisis estático de seguridad ni verificación de que la configuración local de infra no filtre secretos. La Fase 5.3 del [roadmap de hardening](../../../docs/hardening-roadmap.md) cubre las dos piezas que sí son código versionable — CodeQL y la revisión de `infra/env.json` — y deja documentado como pendiente lo que no lo es: activar secret scanning + push protection es un toggle en Settings del repositorio en GitHub, no un archivo, y en algunos planes de organización ni siquiera está expuesto vía API.

Corre en paralelo con la Fase 5.1 (Dependabot) y 5.2 (`npm audit` en CI), cada una en su propio change — no se pisan: 5.1 y 5.2 miran dependencias de terceros, esta mira el código propio y la configuración local.

## What Changes

- Se agrega `.github/workflows/codeql.yml` con `github/codeql-action`, analizando JavaScript/TypeScript. Cubre `apps/web` (Angular) y `apps/realtime-api` (Node) porque ambos son JS/TS y CodeQL analiza el lenguaje, no el proyecto de Nx — no hace falta un job por app. Corre en `pull_request`, en push a `develop`/`master`, y en cron semanal (para encontrar advisories nuevos sobre código que no cambió).
- Se revisa `infra/env.json`: confirmar que no está trackeado, que no existen secretos en el historial de git, y que `.gitignore` lo cubre. `infra/env.json.example` queda como la plantilla trackeada.
- **Fuera de alcance, documentado como pendiente**: activar "secret scanning" y "push protection" en Settings del repositorio en GitHub. No es un archivo versionable — es un cambio de configuración del repo que solo puede hacer quien lo administra, y algunos planes de GitHub ni exponen el toggle vía API. Queda como checkbox sin marcar en `tasks.md`, con la nota explícita de que requiere acción manual del dueño del repo.

## Capabilities

### New Capabilities
- `static-analysis-scanning`: análisis estático de código (CodeQL) corriendo en CI para JavaScript/TypeScript, y la garantía de que la configuración local de infra (`infra/env.json`) no filtra secretos.

### Modified Capabilities

(ninguna — no hay capability existente de seguridad/CI a la que este change le cambie requirements)

## Impact

**Workflows**
- `.github/workflows/codeql.yml` — nuevo.

**Configuración / revisión**
- `infra/env.json` — revisión de contenido e historial (no se espera cambio de archivo, ver `design.md`).
- `.gitignore` — confirmar la entrada existente, no se espera modificarla.

**Documentación**
- `docs/hardening-roadmap.md` — subsección 5.3, marcada como hecha con el punto de secret scanning pendiente.

**Sin cambios de código de aplicación.** Nada de `src/`.

**Fuera de alcance**: secret scanning + push protection en Settings de GitHub (paso manual, ver arriba). Dependabot es la Fase 5.1, `npm audit` en CI es la Fase 5.2 — ambas en changes propios de agentes hermanos.
