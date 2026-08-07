## MODIFIED Requirements

### Requirement: El build se conecta al backend del ambiente seleccionado
El build generado por este workflow SHALL conectarse al backend de `apps/realtime-api` correspondiente al ambiente (`dev`, `qa` o `prod`) elegido como input del workflow, independientemente del perfil EAS (`development`/`preview`/`production`) usado para el empaquetado. La configuración de esta URL SHALL vivir en archivos versionados del repo (`apps/mobile/.env.<ambiente>`), no en un secreto ni en configuración externa al código.

#### Scenario: App instalada desde un build apuntando a QA
- **WHEN** el workflow se dispara con `environment: qa` y perfil `preview`, y una persona instala el `.apk` generado en un dispositivo con conexión a internet
- **THEN** la app se conecta exitosamente al stack `qa`, aislada de los datos de producción

#### Scenario: App instalada desde un build apuntando a producción
- **WHEN** el workflow se dispara con `environment: prod` (comportamiento equivalente al que existía antes de este change) y una persona instala el `.apk` generado
- **THEN** la app se conecta exitosamente al backend de producción, igual que hoy

#### Scenario: Cualquier perfil EAS puede combinarse con cualquier ambiente
- **WHEN** el workflow se dispara con perfil `preview` y `environment: dev`, para debug puntual
- **THEN** se genera un apk instalable que se conecta al stack `dev`, sin requerir un perfil EAS nuevo para esa combinación
