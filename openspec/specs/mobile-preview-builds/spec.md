# Mobile Preview Builds

## Purpose

Cubre el workflow manual de GitHub Actions que genera un build Android instalable de la app móvil vía EAS, sin depender de una laptop de desarrollo encendida, y que permite elegir a qué ambiente de backend (`dev`, `qa` o `prod`) se conecta el build independientemente del perfil EAS usado para empaquetarlo. Es una capability distinta de `mobile-app`: esta cubre cómo se distribuye un build de prueba, no el comportamiento de la app.

## Requirements

### Requirement: Generación de build Android instalable bajo demanda
El sistema SHALL permitir disparar manualmente, desde GitHub Actions, la generación de un build Android de `apps/mobile` instalable directamente (`.apk`, distribución interna vía EAS), sin requerir Expo Go ni un entorno de desarrollo local. El trigger SHALL ser manual (`workflow_dispatch`); NO SHALL dispararse automáticamente en cada push.

#### Scenario: Disparar un build manualmente
- **WHEN** alguien con acceso al repo ejecuta el workflow de build de mobile desde la pestaña Actions de GitHub
- **THEN** se genera un build Android usando el perfil `preview` de `apps/mobile/eas.json`, sin necesitar que ninguna laptop de desarrollo esté encendida ni conectada

#### Scenario: Push a la rama no dispara un build
- **WHEN** se hace push de un commit a cualquier rama, incluida `master`
- **THEN** el workflow de build de mobile NO se ejecuta automáticamente

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

### Requirement: Resultado del build accesible sin herramientas adicionales
El link de instalación del build generado SHALL quedar disponible en el log de la corrida del workflow en GitHub Actions, sin requerir acceso directo al dashboard de EAS ni herramientas adicionales para obtenerlo.

#### Scenario: Obtener el link de instalación
- **WHEN** el workflow de build de mobile termina exitosamente
- **THEN** el log de esa corrida contiene el link de instalación del build generado, listo para compartir
