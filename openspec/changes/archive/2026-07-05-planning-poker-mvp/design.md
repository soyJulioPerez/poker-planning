## Context

Proyecto greenfield. Se definió en exploración previa (ver `docs/idea.md`) el stack deseado: Nx monorepo, Angular en frontend con diseño atómico (smart/dumb components), backend serverless (API Gateway + Lambdas), persistencia en DynamoDB. El producto es un Planning Poker en tiempo real: salas efímeras sin autenticación, un moderador único por sala, mazos predefinidos, y resolución manual de estimaciones con métricas de promedio/moda.

El desarrollo debe ser progresivo: 4 incrementos verticales, cada uno end-to-end y demostrable en el navegador antes de avanzar al siguiente.

## Goals / Non-Goals

**Goals:**
- Sala en tiempo real vía WebSocket, con baja latencia percibida en votación/revelado.
- Modelo de datos simple que soporte salas efímeras (TTL) sin necesidad de limpieza manual.
- Reconexión automática de participantes sin perder su voto ni su lugar en la sala.
- Estructura de frontend con atomic design que permita reusar componentes de cartas/badges/avatares.
- Entregar en 4 incrementos verticales, cada uno funcional de punta a punta.

**Non-Goals:**
- Autenticación de usuarios o cuentas persistentes.
- Historial de sesiones entre sprints o persistencia más allá del ciclo de vida de la sala.
- Identidad robusta de reconexión (token persistente) — queda como mejora futura.
- Co-moderación o transferencia de rol de moderador.
- Exportación del resumen final a formatos externos (CSV, PDF) — solo visualización en pantalla.

## Decisions

### 1. WebSocket API Gateway + Lambda (routing por acción)
Se usa una única WebSocket API con rutas `$connect`, `$disconnect`, `$default` (o rutas por acción: `join`, `vote`, `reveal`, `resolve`, `nextStory`). Cada mensaje entrante invoca una Lambda que lee/escribe el estado de la sala en DynamoDB y hace broadcast a las conexiones de la sala vía la API de Management de API Gateway.
- **Alternativa considerada**: Polling sobre REST API. Descartada por la exploración previa: se requería sensación de tiempo real (voto en vivo, revelado instantáneo).

### 2. DynamoDB single-table con TTL
Una sola tabla con los siguientes patrones de acceso:
- `PK=ROOM#<roomId>, SK=META` → estado de la sala (deck seleccionado, historia actual, fase de la ronda, moderador, historias estimadas, puntuación acumulada).
- `PK=ROOM#<roomId>, SK=PARTICIPANT#<name>` → participante (nombre, voto actual, conectado/desconectado, esVotante).
- `PK=CONN#<connectionId>, SK=META` → mapea connectionId → roomId + name, para poder resolver la sala en `$disconnect` y en broadcasts.
- Atributo `ttl` en el ítem de sala (y opcionalmente en participantes) para que DynamoDB expire salas abandonadas automáticamente.
- **Alternativa considerada**: Múltiples tablas relacionales. Descartada por sobre-ingeniería para un dominio efímero y de bajo volumen de relaciones.

### 3. Identidad de participante = nombre + roomId (MVP)
Al unirse, el cliente envía su nombre; el backend usa `roomId + name` como clave del ítem de participante. Si el WebSocket se desconecta y el cliente reconecta con el mismo nombre a la misma sala, se reutiliza el ítem existente (se actualiza `connectionId` y estado a "conectado").
- **Riesgo aceptado**: colisión de nombres duplicados en la misma sala. Ver sección de Riesgos.
- **Evolución futura**: reemplazar por un token de sesión persistido en `localStorage` del cliente, generado al unirse, para desambiguar identidad sin depender del nombre.

### 4. Rol de moderador fijo, sin transferencia
El moderador es quien crea la sala; su `connectionId`/`name` queda marcado en `ROOM#<roomId>#META`. Solo él puede: revelar votos, resolver la historia (aceptar promedio/moda/valor manual), iniciar nueva ronda, avanzar de historia. El toggle "el moderador vota o no" solo es editable cuando la ronda está en fase `idle` (sin votación activa) — se bloquea en la UI y se valida también en el backend durante fases `voting`/`revealed`.

### 5. Cálculo de promedio y moda en el backend
Al revelar, la Lambda calcula promedio (numérico, redondeado a 1 decimal) y moda (valor más frecuente; si hay empate, se listan todos) sobre los votos numéricos del mazo. Se envían ambos al cliente junto con la distribución completa de votos, para que el moderador decida. Valores no numéricos de mazos alternativos (p. ej. "?", "☕") se excluyen del cálculo pero se muestran en la distribución.

### 6. Estructura Nx: apps + libs compartidas
- `apps/web` (Angular): componentes atómicos (`atoms`, `molecules`, `organisms`) para cartas, badges de moderador, avatares de participantes, panel de resumen.
- `apps/realtime-api` (Lambdas): handlers `connect`, `disconnect`, `route-message` (o handlers separados por acción).
- `libs/shared/contracts`: tipos TypeScript compartidos de mensajes WebSocket (request/response) y modelos de dominio (Room, Participant, Story, Vote), consumidos por ambas apps para evitar drift de contrato.

## Risks / Trade-offs

- **[Riesgo] Colisión de nombres duplicados** en la misma sala rompe la identidad de reconexión → **Mitigación**: validar nombre único al unirse (rechazar si ya existe un participante conectado con ese nombre); documentado como deuda técnica a resolver con token persistente.
- **[Riesgo] Conexiones WebSocket huérfanas** (cliente cae sin disparar `$disconnect` limpiamente) → **Mitigación**: TTL en DynamoDB limpia el ítem de conexión/sala igualmente tras un tiempo; el estado "desconectado" se aplica de forma optimista ante fallo de broadcast.
- **[Riesgo] Cambio de rol de moderador a mitad de ronda** (intento accidental) → **Mitigación**: validación en frontend (deshabilitar control) y backend (rechazar mensaje si `roundPhase !== 'idle'`).
- **[Trade-off] Sin historial entre sesiones**: simplifica el modelo y evita gestión de cuentas, a costa de no poder comparar velocity entre sprints — aceptado explícitamente por alcance del MVP.

## Migration Plan

No aplica (proyecto greenfield, sin sistema previo que migrar). Despliegue directo por incremento:
1. Incremento 1 desplegable de forma independiente (sala + unión) sin depender de los siguientes.
2. Cada incremento posterior se agrega sobre la misma infraestructura base (misma tabla, misma WebSocket API), extendiendo rutas/acciones sin romper las anteriores.

## Open Questions

- ¿Qué mazos predefinidos exactos se ofrecen además de Fibonacci (p. ej. T-shirt sizes, powers of 2)? Definir catálogo antes del Incremento 2.
- ¿Cuánto tiempo de TTL es razonable para una sala abandonada (ej. 4h, 24h)?
- ¿Se necesita algún límite de participantes por sala por razones de costo/broadcast fan-out?
