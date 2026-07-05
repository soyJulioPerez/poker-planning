## Why

El equipo necesita una herramienta propia de Planning Poker para estimar historias de usuario en vivo, sin depender de herramientas de terceros ni requerir que los participantes creen cuentas. Se busca una experiencia de baja fricción (unirse con un link) pero con feedback en tiempo real (votos ocultos, revelado simultáneo) equivalente a las herramientas comerciales del mercado.

## What Changes

- Nueva app de Planning Poker: crear salas efímeras (sin login) y unirse vía link/código.
- Comunicación en tiempo real vía WebSockets (API Gateway WebSocket + Lambda) para lista de participantes, votación y revelado en vivo.
- Mazos de estimación predefinidos (Fibonacci y variantes) seleccionables por el moderador al crear la sala.
- Mecánica de ronda: votación oculta, revelado simultáneo, cálculo de promedio y moda, y resolución manual por el moderador (aceptar promedio/moda, sobreescribir valor, o reiniciar ronda).
- Rol de moderador único por sala (quien la crea): badge visual, control exclusivo de revelar/resolver/avanzar ronda, puede optar por votar o no — este ajuste solo se permite entre rondas, nunca a mitad de una votación activa.
- Contador de historias estimadas y puntuación acumulada visible durante toda la sesión.
- Reconexión automática de participantes (identificados por nombre + sala) tras pérdida de conexión, mostrando estado "desconectado" sin eliminarlos de la lista ni perder su voto.
- Resumen final al cerrar la sala: lista de historias estimadas con su puntuación definitiva y la suma total.
- Persistencia efímera en DynamoDB (TTL) — no hay historial entre sesiones ni cuentas de usuario en este alcance.

## Capabilities

### New Capabilities
- `room-management`: Creación de salas efímeras, unión vía link/código, rol de moderador único, lista de participantes en vivo, reconexión por nombre+sala con estado "desconectado".
- `estimation-session`: Selección de mazo, votación oculta, revelado simultáneo, cálculo de promedio/moda, resolución manual de la historia (aceptar/sobreescribir/reiniciar ronda), avance a la siguiente historia.
- `session-summary`: Contador de historias estimadas y puntuación acumulada en vivo, resumen final con lista de historias y puntuación total al cerrar la sala.

### Modified Capabilities
(ninguna — proyecto nuevo, sin specs previas)

## Impact

- **Nuevo monorepo Nx**: apps de frontend (Angular) y backend (Lambdas), con librerías compartidas de tipos/contratos WebSocket.
- **Infraestructura nueva**: API Gateway WebSocket API, funciones Lambda (connect/disconnect/message handlers), tabla DynamoDB single-table con TTL.
- **Sin sistemas existentes afectados** (proyecto greenfield).
- **Deuda técnica reconocida**: la identidad de reconexión se basa en nombre+sala (no en token persistente); esto puede causar colisiones si dos participantes eligen el mismo nombre. Se documenta como mejora futura, no se resuelve en este MVP.
