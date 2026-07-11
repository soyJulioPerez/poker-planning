# Participant Identity

## Purpose

TBD

## Requirements

### Requirement: Catálogo de grupos de íconos
El sistema SHALL definir un catálogo estático de grupos de íconos temáticos, cada uno identificado por un `id` único y compuesto por una lista de emojis Unicode. El catálogo inicial SHALL incluir los grupos "Hobbies", "Emociones" y "Animales".

#### Scenario: Catálogo disponible para selección
- **WHEN** el moderador abre el formulario de "Crear sala"
- **THEN** el sistema ofrece "Ninguno" y los grupos "Hobbies", "Emociones" y "Animales" como opciones de grupo de íconos

### Requirement: Selección de grupo de íconos al crear sala
El sistema SHALL permitir que el moderador, al crear una sala, elija un grupo de íconos del catálogo o "Ninguno" (comportamiento sin avatares, por defecto). Si elige un grupo, el moderador SHALL también elegir su propio ícono de ese grupo antes de crear la sala.

#### Scenario: Sala creada sin grupo de íconos
- **WHEN** el moderador crea una sala dejando el grupo de íconos en "Ninguno"
- **THEN** la sala se crea sin `iconGroupId`, y ningún participante ve un selector de ícono al unirse

#### Scenario: Sala creada con grupo de íconos
- **WHEN** el moderador elige un grupo de íconos y selecciona su propio ícono antes de crear la sala
- **THEN** la sala se crea con ese `iconGroupId`, y el moderador queda registrado con el ícono elegido

### Requirement: Selección de ícono al unirse a una sala con grupo activo
El sistema SHALL mostrar un selector de ícono (grilla con los emojis del grupo) en el formulario de "Unirse a sala" únicamente cuando la sala destino tiene un grupo de íconos asignado, y SHALL exigir que el participante elija uno de esos íconos antes de unirse.

#### Scenario: Selector visible para sala con grupo activo
- **WHEN** un usuario ingresa el código de una sala que tiene un grupo de íconos asignado
- **THEN** el formulario de "Unirse a sala" muestra la grilla de íconos de ese grupo y exige una selección para continuar

#### Scenario: Selector ausente para sala sin grupo
- **WHEN** un usuario ingresa el código de una sala sin grupo de íconos asignado
- **THEN** el formulario de "Unirse a sala" no muestra ningún selector de ícono

#### Scenario: Ícono enviado no pertenece al grupo de la sala
- **WHEN** el servidor recibe una solicitud de unión con un ícono que no pertenece al `iconGroupId` configurado en la sala
- **THEN** el sistema ignora el ícono recibido y registra al participante sin ícono

### Requirement: Íconos duplicados permitidos
El sistema SHALL permitir que dos o más participantes de la misma sala elijan el mismo ícono. El nombre del participante SHALL seguir siendo el identificador único usado para unicidad y reconexión, sin cambios en esa lógica.

#### Scenario: Dos participantes eligen el mismo ícono
- **WHEN** dos participantes distintos, identificados por nombres diferentes, eligen el mismo ícono del grupo activo
- **THEN** el sistema permite a ambos unirse normalmente, cada uno con su propio nombre como identificador único

### Requirement: Visualización del ícono junto al nombre
El sistema SHALL mostrar el ícono elegido por un participante a la izquierda de su nombre en la lista de participantes, cuando dicho ícono exista. Para el moderador, el sistema SHALL mostrar el ícono de moderador seguido del ícono de avatar elegido, ambos antes del nombre.

#### Scenario: Participante con ícono elegido
- **WHEN** un participante no moderador con un ícono asignado aparece en la lista de participantes
- **THEN** el sistema muestra su ícono elegido a la izquierda de su nombre

#### Scenario: Moderador con ícono elegido
- **WHEN** el moderador tiene un ícono de avatar asignado y aparece en la lista de participantes
- **THEN** el sistema muestra el ícono de moderador seguido del ícono de avatar elegido, ambos antes de su nombre

#### Scenario: Participante sin ícono (sala sin grupo asignado)
- **WHEN** un participante de una sala sin grupo de íconos asignado aparece en la lista de participantes
- **THEN** el sistema no muestra ningún ícono de avatar junto a su nombre, igual que el comportamiento previo a este cambio
