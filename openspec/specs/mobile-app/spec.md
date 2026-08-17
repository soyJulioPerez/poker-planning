# Mobile App

## Purpose

Define la paridad funcional que la app móvil (Expo/React Native) SHALL mantener con la web sobre el mismo backend: creación y unión a sala, votación y revelado, controles de moderador y resumen de sesión. Existe como capability separada porque la persistencia de sesión en mobile es deliberadamente más acotada que en la web — dura solo mientras la app permanece abierta, sin sobrevivir a un cierre.

## Requirements

### Requirement: Creación de sala desde la app móvil
La app móvil SHALL permitir crear una sala nueva sin autenticarse, con la misma funcionalidad que ofrece `room-management` para la web (nombre del moderador, selección de mazo, grupo de íconos opcional, indicador de carga mientras se espera al servidor).

#### Scenario: Moderador crea una sala desde el celular
- **WHEN** un usuario abre la app móvil, completa el formulario de "Crear sala" (nombre, mazo) y lo envía
- **THEN** la app se conecta al mismo backend (`apps/realtime-api`) que la web, crea la sala, y navega a la pantalla de sala mostrando el código/ID para compartir

### Requirement: Unión a sala por código desde la app móvil
La app móvil SHALL permitir unirse a una sala existente ingresando manualmente su código/ID, sin autenticación. **No** SHALL soportar unirse mediante un deep link/Universal Link tocado fuera de la app (fuera de alcance, ver `design.md`).

#### Scenario: Participante se une ingresando el código de sala
- **WHEN** un usuario abre la app móvil, va a "Unirse a sala", ingresa un código de sala válido y un nombre no usado por otro participante conectado
- **THEN** la app se une a la sala y muestra en vivo la lista de participantes, igual que en la web

#### Scenario: Nombre ya en uso
- **WHEN** un usuario intenta unirse con un nombre que ya pertenece a otro participante conectado en esa sala
- **THEN** la app rechaza la unión e indica que el nombre ya está en uso

### Requirement: Votación y revelado desde la app móvil
La app móvil SHALL ofrecer el mismo mazo de estimación y mecánica de votación oculta / revelado simultáneo que `estimation-session` en la web.

#### Scenario: Participante vota y el moderador revela
- **WHEN** los participantes votan valores del mazo seleccionado y el moderador revela la ronda
- **THEN** todos los participantes conectados desde mobile ven los votos revelados simultáneamente, junto con promedio y moda calculados igual que en la web

### Requirement: Resolución de historia y controles de moderador desde la app móvil
La app móvil SHALL permitir al moderador aceptar el promedio/moda, sobreescribir el valor final, o reiniciar la ronda, y SHALL exponer los mismos controles de moderación (revelar, resolver, nueva ronda, activar/desactivar "moderador vota" entre rondas) que la web.

#### Scenario: Moderador resuelve una historia desde el celular
- **WHEN** el moderador, tras revelar una ronda, acepta el promedio/moda o ingresa un valor final manual
- **THEN** la historia queda resuelta con ese puntaje para todos los participantes, y la app avanza al estado de espera de la siguiente historia

#### Scenario: Participante no-moderador no ve controles de moderación
- **WHEN** un participante que no es el moderador de la sala abre la pantalla de sala desde mobile
- **THEN** no ve disponibles los controles de revelar, resolver, nueva ronda, ni el toggle de "moderador vota"

### Requirement: Resumen de sesión desde la app móvil
La app móvil SHALL mostrar el contador de historias estimadas y la puntuación acumulada durante la sesión, y el resumen final al cerrar la sala, igual que `session-summary` en la web.

#### Scenario: Resumen visible al cerrar la sala
- **WHEN** el moderador cierra la sala desde la app móvil
- **THEN** se muestra la lista de historias estimadas con su puntaje final y la suma total, igual que en la web

### Requirement: Persistencia de sesión acotada a la apertura actual de la app
La app móvil SHALL mantener la sesión del participante (nombre, sala) mientras la app permanece abierta, permitiendo reconexión automática ante una pérdida de conexión de red durante esa misma apertura. La sesión NO SHALL persistir entre cierres y reaperturas de la app en esta versión (ver decisión de `SessionStore` en memoria, `design.md`).

#### Scenario: Reconexión tras pérdida de red dentro de la misma apertura de la app
- **WHEN** un participante con sesión activa pierde y recupera la conexión de red sin cerrar la app
- **THEN** la app reingresa automáticamente a la sala con el mismo nombre, recuperando su voto y posición, igual que el comportamiento de reconexión de la web

#### Scenario: La sesión no sobrevive a cerrar la app
- **WHEN** un participante cierra completamente la app móvil y vuelve a abrirla
- **THEN** no hay sesión previa disponible y debe unirse nuevamente ingresando el código de sala y su nombre
