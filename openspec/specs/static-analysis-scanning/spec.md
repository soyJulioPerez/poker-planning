# static-analysis-scanning Specification

## Purpose

El repositorio no tenía análisis estático de seguridad sobre su propio código, ni una verificación de que la configuración local de infra no filtrara secretos. Esta capability cubre las dos piezas versionables de la Fase 5.3 del [roadmap de hardening](../../../docs/hardening-roadmap.md):

- CodeQL corriendo en CI para JavaScript/TypeScript, con un único análisis de `javascript-typescript` que cubre tanto `apps/web` (Angular) como `apps/realtime-api` (Node) — CodeQL analiza por lenguaje, no por proyecto de Nx, así que no hace falta un job por app.
- La garantía, con evidencia, de que `infra/env.json` (la config local de SAM) nunca llega al repositorio, con `infra/env.json.example` como la plantilla trackeada sin valores reales.

Corre en paralelo con `dependency-updates` (Dependabot) y con la auditoría de dependencias en `continuous-integration` (`npm audit`): esas dos miran dependencias de terceros, esta capability mira el código propio y la configuración local.

Queda explícitamente fuera de esta capability activar secret scanning + push protection en Settings del repositorio en GitHub: no es un archivo versionable, es un cambio de configuración que solo puede hacer quien administra el repositorio, y algunos planes de GitHub ni siquiera exponen el toggle vía API.

## Requirements

### Requirement: Análisis estático de CodeQL activo para JavaScript/TypeScript

El sistema SHALL ejecutar análisis de CodeQL para JavaScript/TypeScript sobre el código del repositorio, cubriendo tanto `apps/web` como `apps/realtime-api`, sin requerir un job separado por proyecto.

CodeQL analiza por lenguaje, no por proyecto de Nx: como ambas apps son JS/TS, un único análisis de `javascript-typescript` cubre las dos.

#### Scenario: Un pull request dispara el análisis

- **WHEN** se abre o actualiza un pull request contra `develop` o `master`
- **THEN** el workflow de CodeQL corre sobre el código del pull request

#### Scenario: Un push a una rama de integración dispara el análisis

- **WHEN** se pushea un commit a `develop` o a `master`
- **THEN** el workflow de CodeQL corre sobre ese commit

#### Scenario: El análisis corre semanalmente aunque no haya cambios

- **WHEN** pasa una semana sin un nuevo push ni pull request que dispare el análisis
- **THEN** el cron semanal ejecuta CodeQL igual, para detectar hallazgos nuevos originados en reglas de CodeQL actualizadas, no en código nuevo

#### Scenario: Los resultados quedan visibles en el repositorio

- **WHEN** el análisis de CodeQL termina, con o sin hallazgos
- **THEN** los resultados quedan disponibles en la pestaña Security → Code scanning alerts del repositorio

### Requirement: La configuración local de infra no filtra secretos

El sistema SHALL mantener `infra/env.json` fuera del control de versiones, con `infra/env.json.example` como plantilla trackeada sin valores reales.

#### Scenario: `infra/env.json` no está trackeado

- **WHEN** se audita el árbol de archivos versionados del repositorio (`git ls-files`)
- **THEN** `infra/env.json` no aparece en el listado

#### Scenario: `infra/env.json` está cubierto por `.gitignore`

- **WHEN** se verifica si `infra/env.json` sería ignorado por git (`git check-ignore`)
- **THEN** la entrada `infra/env.json` de `.gitignore` lo cubre explícitamente

#### Scenario: La plantilla no contiene valores reales

- **WHEN** se inspecciona el contenido de `infra/env.json.example`
- **THEN** los valores son de ejemplo (endpoints locales, nombres de tabla genéricos), no credenciales ni endpoints de un ambiente real
