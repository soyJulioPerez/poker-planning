## MODIFIED Requirements

### Requirement: Rol de moderador único
El sistema SHALL asignar inicialmente el rol de moderador a quien creó la sala, y SHALL garantizar que en todo momento haya un único moderador, sin co-moderación. El rol SHALL poder cambiar de titular únicamente mediante cesión del moderador actual o mediante la toma por parte de un participante cuando el moderador lleva un tiempo prolongado desconectado. El sistema SHALL mostrar una indicación visual (ícono) del rol a todos los participantes, junto al nombre de quien lo tenga en ese momento.

#### Scenario: Ícono de moderador visible
- **WHEN** un participante visualiza la lista de personas en la sala
- **THEN** el sistema muestra un ícono distintivo junto al nombre del moderador

#### Scenario: Un participante no moderador intenta ejecutar una acción de moderación
- **WHEN** un participante que no es el moderador intenta revelar votos, resolver la historia o iniciar una nueva ronda
- **THEN** el sistema rechaza la acción

#### Scenario: El ícono sigue al nuevo moderador tras un cambio de titular
- **WHEN** la moderación pasa de un participante a otro, por cesión o por toma
- **THEN** todos los participantes ven el ícono de moderador junto al nombre del nuevo moderador y ya no junto al del anterior

#### Scenario: El moderador encabeza la lista de participantes
- **WHEN** un participante visualiza la lista de personas en la sala, incluso después de un cambio de titular
- **THEN** el moderador vigente aparece en la primera fila, y el resto de los participantes conserva su orden

#### Scenario: El moderador anterior pierde las acciones de moderación
- **WHEN** quien era moderador intenta revelar votos, resolver la historia o iniciar una nueva ronda después de que la moderación pasó a otro participante
- **THEN** el sistema rechaza la acción

## ADDED Requirements

### Requirement: Ceder la moderación
El sistema SHALL permitir que el moderador ceda la moderación a cualquier otro participante conectado de la sala, en cualquier fase de la ronda, sin requerir aceptación del receptor. La cesión SHALL dejar intactos la fase de la ronda, la historia actual y los votos emitidos. Tras la cesión, el moderador anterior SHALL quedar como participante común y habilitado como votante, y el nuevo moderador SHALL quedar habilitado como votante, pudiendo luego cambiar esa condición con el control "el moderador vota" según sus reglas vigentes.

#### Scenario: Moderador cede la moderación a un participante conectado
- **WHEN** el moderador abre el menú de acciones de un participante conectado y elige "Hacer moderador"
- **THEN** el sistema convierte a ese participante en moderador y al moderador anterior en participante común, y todos los participantes ven el cambio sin recargar la página

#### Scenario: Cesión durante una votación en curso
- **WHEN** el moderador cede la moderación mientras hay una votación en curso
- **THEN** la ronda continúa en la misma fase, con la misma historia y los mismos votos emitidos, y el nuevo moderador puede revelar los votos

#### Scenario: Ambos quedan habilitados como votantes
- **WHEN** el moderador, que tenía desactivada su condición de votante, cede la moderación
- **THEN** el moderador anterior queda habilitado como votante, y el nuevo moderador también queda habilitado como votante

#### Scenario: La opción de ceder solo está disponible para el moderador
- **WHEN** un participante que no es el moderador visualiza la lista de participantes
- **THEN** el sistema no le muestra la opción "Hacer moderador"

#### Scenario: No se puede ceder a un participante desconectado
- **WHEN** el moderador intenta ceder la moderación a un participante que figura desconectado
- **THEN** el sistema rechaza la cesión y el moderador sigue siendo el mismo

#### Scenario: Un participante no moderador intenta ceder la moderación
- **WHEN** un participante que no es el moderador envía una solicitud de cesión
- **THEN** el sistema rechaza la solicitud

#### Scenario: El moderador anterior reingresa como participante común
- **WHEN** quien cedió la moderación (o la perdió por toma) se desconecta y vuelve a ingresar a la sala
- **THEN** el sistema lo reincorpora como participante común, sin devolverle el rol de moderador

### Requirement: Tomar la moderación ante desconexión prolongada del moderador
El sistema SHALL permitir que cualquier participante conectado tome la moderación cuando el moderador lleva al menos 60 segundos desconectado. El servidor SHALL validar esa condición en el momento de la solicitud. Si varios participantes intentan tomarla a la vez, el sistema SHALL otorgarla solo al primero y rechazar el resto. La toma SHALL dejar intactos la fase de la ronda, la historia actual y los votos emitidos, y SHALL aplicar las mismas reglas de condición de votante que la cesión.

#### Scenario: Opción visible tras 60 segundos de desconexión
- **WHEN** el moderador lleva al menos 60 segundos desconectado
- **THEN** el sistema muestra a todos los participantes conectados la opción "Tomar moderación"

#### Scenario: Opción no disponible antes de los 60 segundos
- **WHEN** el moderador lleva menos de 60 segundos desconectado, o está conectado
- **THEN** el sistema no muestra la opción "Tomar moderación", y si recibe una solicitud de toma la rechaza

#### Scenario: Participante toma la moderación
- **WHEN** un participante conectado elige "Tomar moderación" y el moderador lleva al menos 60 segundos desconectado
- **THEN** el sistema lo convierte en moderador y al moderador anterior en participante común, y todos los participantes ven el cambio sin recargar la página

#### Scenario: Dos participantes intentan tomar la moderación a la vez
- **WHEN** dos participantes envían "Tomar moderación" casi en simultáneo
- **THEN** el sistema otorga la moderación solo a uno de ellos y rechaza la solicitud del otro

#### Scenario: El moderador vuelve antes de que alguien tome la moderación
- **WHEN** el moderador desconectado reingresa a la sala antes de que alguien tome la moderación
- **THEN** conserva el rol de moderador y la opción "Tomar moderación" deja de mostrarse

### Requirement: Aviso a quien recibe la moderación cedida
El sistema SHALL mostrar un aviso temporal, anunciado a tecnologías de asistencia, al participante que recibe la moderación por cesión, indicándole que ahora es el moderador. El sistema SHALL NOT mostrar ese aviso a quien toma la moderación por su propia acción.

#### Scenario: Receptor de una cesión ve el aviso
- **WHEN** el moderador cede la moderación a un participante
- **THEN** ese participante ve un aviso temporal "Ahora sos el moderador", que también es anunciado por lectores de pantalla

#### Scenario: Quien toma la moderación no ve el aviso
- **WHEN** un participante toma la moderación mediante "Tomar moderación"
- **THEN** el sistema le otorga el rol sin mostrarle el aviso "Ahora sos el moderador"

#### Scenario: El resto de los participantes no ve el aviso
- **WHEN** la moderación cambia de titular
- **THEN** los participantes que no son el nuevo moderador no ven el aviso, solo el cambio de ícono en la lista
