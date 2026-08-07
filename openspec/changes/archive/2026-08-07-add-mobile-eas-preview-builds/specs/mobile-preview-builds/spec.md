## ADDED Requirements

### Requirement: Generación de build Android instalable bajo demanda
El sistema SHALL permitir disparar manualmente, desde GitHub Actions, la generación de un build Android de `apps/mobile` instalable directamente (`.apk`, distribución interna vía EAS), sin requerir Expo Go ni un entorno de desarrollo local. El trigger SHALL ser manual (`workflow_dispatch`); NO SHALL dispararse automáticamente en cada push.

#### Scenario: Disparar un build manualmente
- **WHEN** alguien con acceso al repo ejecuta el workflow de build de mobile desde la pestaña Actions de GitHub
- **THEN** se genera un build Android usando el perfil `preview` de `apps/mobile/eas.json`, sin necesitar que ninguna laptop de desarrollo esté encendida ni conectada

#### Scenario: Push a la rama no dispara un build
- **WHEN** se hace push de un commit a cualquier rama, incluida `master`
- **THEN** el workflow de build de mobile NO se ejecuta automáticamente

### Requirement: El build se conecta al backend ya desplegado en AWS
El build generado por este workflow SHALL conectarse al backend de `apps/realtime-api` ya desplegado en AWS (el mismo que usa `apps/web` en producción), no a un backend local. La configuración de esta URL SHALL vivir en un archivo versionado del repo, no en un secreto ni en configuración externa al código.

#### Scenario: App instalada desde un build de preview
- **WHEN** una persona instala el `.apk` generado por este workflow y abre la app en un dispositivo con conexión a internet (sin estar en la misma red que ningún desarrollador)
- **THEN** la app se conecta exitosamente al backend de AWS y permite crear/unirse a salas, igual que la web en producción

### Requirement: Resultado del build accesible sin herramientas adicionales
El link de instalación del build generado SHALL quedar disponible en el log de la corrida del workflow en GitHub Actions, sin requerir acceso directo al dashboard de EAS ni herramientas adicionales para obtenerlo.

#### Scenario: Obtener el link de instalación
- **WHEN** el workflow de build de mobile termina exitosamente
- **THEN** el log de esa corrida contiene el link de instalación del build generado, listo para compartir
