## MODIFIED Requirements

### Requirement: Creación de sala
El sistema SHALL permitir a cualquier usuario crear una sala de Planning Poker sin necesidad de autenticarse, generando un identificador de sala único y un link/código para compartir. El link compartible SHALL ser una URL completa y funcional, respetando la ruta base real de despliegue de la aplicación, de modo que abrirlo directamente (sin haber pasado antes por la pantalla de inicio) navegue correctamente a la sala. El link compartible SHALL mostrarse en su propia fila de ancho completo dentro de la pantalla de sala, sin compartir fila con las estadísticas de la sala. Al crear la sala, el moderador SHALL poder elegir opcionalmente un grupo de íconos (ver capability `participant-identity`); si elige uno, SHALL también elegir su propio ícono de ese grupo antes de enviar el formulario. Mientras se espera la respuesta del servidor tras iniciar la creación, el sistema SHALL mostrar un indicador visual de carga y deshabilitar el botón de acción. Si no se recibe respuesta dentro de un tiempo razonable, el sistema SHALL mostrar un mensaje de error y permitir reintentar.

#### Scenario: Usuario crea una sala nueva
- **WHEN** un usuario abre la aplicación y elige "Crear sala"
- **THEN** el sistema genera un `roomId` único, asigna a ese usuario como moderador, y muestra un link/código compartible

#### Scenario: Link compartible es una URL completa y funcional
- **WHEN** el moderador visualiza o copia el link compartible mostrado tras crear la sala
- **THEN** dicho link, al abrirse directamente en un navegador sin sesión previa, resuelve a la ruta de la sala correspondiente

#### Scenario: El link compartible no comparte fila con las estadísticas de la sala
- **WHEN** un participante visualiza el encabezado de una sala activa
- **THEN** el link compartible aparece en su propia fila de ancho completo, separado de las estadísticas de la sala (historias estimadas, puntaje acumulado)

#### Scenario: Indicador de carga mientras se crea la sala
- **WHEN** un usuario envía el formulario de "Crear sala"
- **THEN** el sistema muestra un indicador visual de carga y deshabilita el botón de acción hasta recibir una respuesta

#### Scenario: Sin respuesta del servidor al crear sala
- **WHEN** un usuario envía el formulario de "Crear sala" y no se recibe respuesta dentro del tiempo de espera configurado
- **THEN** el sistema oculta el indicador de carga, muestra un mensaje de error, y permite reintentar el envío
