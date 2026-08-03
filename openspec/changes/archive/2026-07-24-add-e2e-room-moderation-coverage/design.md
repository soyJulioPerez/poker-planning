## Context

`e2e/room.page.ts`/`home.page.ts`/`fixtures.ts` (de `add-e2e-estimation-rules-coverage`) ya encapsulan las interacciones base (crear sala, unirse, definir historia, votar, revelar). Este change los reutiliza para cubrir reglas de `room-management` no verificadas hoy por ningún test.

Fuentes de verdad confirmadas leyendo código en la sesión de exploración previa (no supuestas):
- `openspec/specs/room-management/spec.md` — requirements a cubrir.
- `apps/web/src/app/pages/home/home.html` — error de nombre duplicado: `<p class="home__error">Ese nombre ya está en uso en esta sala.</p>`, disparado cuando `joinRejectedReason() === 'name-taken'`.
- `apps/realtime-api/.../join-room.ts` — el servidor rechaza con `{type:'joinRejected', reason:'name-taken'}` solo si el participante existente con ese nombre sigue `connected:true`; si está desconectado, permite reconectar reusando `isModerator`, `isVoter`, `vote`, `icon` previos.
- `apps/web/src/app/ui/participant-list/participant-list.html` — toggle "moderador vota": `input[type=checkbox]` dentro de `label.participant-list__voter-switch`, texto visible "Vota"/"No vota"; `disabled` si `!isModerator() || !canChangeVoterStatus()`, donde `canChangeVoterStatus` = `roundPhase === 'idle'` (pasado desde `room.html`). Participante desconectado: `<li class="participant-list__item participant-list__item--disconnected">` + `<span class="participant-list__status">desconectado</span>`.
- `apps/realtime-api/.../handlers/disconnect.ts` — al cerrarse el WebSocket, el servidor marca `connected:false` en el participante (no lo borra) y difunde `roomState` actualizado; no hay evento dedicado de "desconexión", el cliente se entera vía el `roomState` con ese participante en `connected:false`.
- `room.html` — controles de moderación (botón "Revelar votos", panel de resolución, "Nueva ronda") están todos condicionados a `isModerator()`; para un no-moderador, esos elementos no se renderizan en absoluto (no es que estén deshabilitados — están ausentes del DOM), mismo patrón ya confirmado para "Revelar votos" sin historia en el change anterior.

## Goals / Non-Goals

**Goals:**
- Agregar `e2e/room-moderation.spec.ts` cubriendo los 6 casos de `room-management` listados en el proposal.
- Reutilizar `HomePage`/`RoomPage`/fixtures sin duplicar lógica de setup; extender `RoomPage` solo donde falten getters/acciones específicos de estos casos (toggle de moderador, estado desconectado).
- Selectores robustos y consistentes con el estilo ya establecido en `estimation-rules.spec.ts` (roles ARIA cuando existen; clases estables cuando la implementación no expone rol/texto único, documentando la razón).

**Non-Goals:**
- No se cubre `participant-identity`, `session-summary` ni `estimation-help-guide` — quedan fuera de este segundo corte de priorización por riesgo (mismo criterio que el change anterior).
- No se automatiza correr e2e en CI — no-goal heredado de `add-e2e-playwright-tests`.
- No se modifica `apps/web`/`apps/realtime-api`. Si algún caso revela una discrepancia real con el spec, se documenta como hallazgo (ej. en `docs/known-issues.md`, como ya se hizo con el botón "Nueva ronda") y se resuelve aparte.

## Decisions

### Decisión 1: Un solo archivo `room-moderation.spec.ts`
Mismo criterio que `estimation-rules.spec.ts`: los 6 casos son variaciones del mismo flujo base (sala → participantes → estado), viven en un único spec con múltiples `test(...)`.

### Decisión 2: Nombre duplicado — el participante original debe seguir conectado
El servidor solo rechaza por `name-taken` si el participante existente sigue `connected:true` (confirmado en `join-room.ts`). El test crea la sala como "Ana" (moderador) y, sin cerrar ese contexto, intenta unir un segundo `BrowserContext` también como "Ana" — así el primero sigue conectado y el rechazo es determinístico. Se verifica el texto exacto `Ese nombre ya está en uso en esta sala.`.

### Decisión 3: No-moderador — verificar ausencia, no `disabled`
Igual que con "Revelar votos sin historia" en el change anterior, los controles de moderación no están deshabilitados para un no-moderador: directamente no se renderizan (`@if (isModerator())` en `room.html`). El test asigna al participante no-moderador y usa `toHaveCount(0)` sobre los locators de "Revelar votos", el panel de resolución y "Nueva ronda", en vez de `toBeDisabled()`.

### Decisión 4: Toggle "moderador vota" — trigger de `canChangeVoterStatus` asumido como "voto emitido"
Se asume (sin confirmar en código antes del proposal, a validar durante la implementación) que basta con que exista al menos un voto emitido en la ronda actual para que `roundPhase` dejе de ser `'idle'` y el checkbox quede `disabled`. Si la implementación revela un trigger distinto (ej. que ya alcanza con tener una historia asignada, sin necesidad de un voto), se ajusta el test en el momento sin volver a este documento.

### Decisión 5: Reconexión y desconexión — esperar el `roomState` actualizado, no asumir instantaneidad
Cerrar un `BrowserContext` dispara el cierre del WebSocket del lado del navegador, pero `disconnect.ts` actualiza `connected:false` de forma asíncrona (best-effort, en un `try/catch` que hace `broadcastToRoom`). Los asserts sobre "desconectado" y sobre la restauración de voto tras reconectar usan `expect(...).toBeVisible()`/`toHaveText()` con el timeout default de Playwright (que ya hace polling), sin `waitForTimeout` fijo.

### Decisión 6: Reconexión se verifica por conteo de votos, no reenviando el voto
Para el caso de reconexión, el test verifica que el voto se restauró comprobando que el conteo de "N de M votaron" ya incluye al participante reconectado sin que este vuelva a votar — si el test votara de nuevo tras reconectar, no distinguiría "restauró el voto anterior" de "aceptó un voto nuevo silenciosamente".

## Risks / Trade-offs

- [Riesgo] La Decisión 4 (trigger de `canChangeVoterStatus`) es una hipótesis no verificada en código al momento de escribir este design — puede requerir un ajuste menor de escenario durante la implementación. Aceptado explícitamente por el usuario al aprobar el alcance.
- [Riesgo] Timing de reconexión/desconexión (Decisión 5) depende de la propagación asíncrona del `roomState` — si resulta flaky en corridas reales, se ajustan timeouts locales del test (no globales), mismo criterio que la latencia de AWS ya documentada.
- [Trade-off] No se cubre el caso de reconexión con un mazo distinto a Fibonacci ni con historia ya resuelta — se prioriza el caso base (reconexión durante una ronda de votación activa), consistente con "un caso representativo por regla" ya aplicado en el change anterior.

## Migration Plan

Sin datos de producción afectados; cambio aditivo. Pasos:
1. Escribir `e2e/room-moderation.spec.ts`, extendiendo `RoomPage` donde falten getters/acciones.
2. Correr `nx e2e e2e` en modo local y confirmar los 6 casos.
3. Confirmar en código el trigger real de `canChangeVoterStatus` (Decisión 4) y ajustar el escenario si difiere de lo asumido.
4. Opcionalmente correr `test:e2e:aws` para confirmar estabilidad (mismo trade-off de latencia ya documentado en `docs/local-dev-workflow.md`).

Sin plan de rollback especial — revertir el commit restaura el estado anterior sin efectos secundarios.

## Open Questions

- Trigger exacto de `canChangeVoterStatus` — a confirmar en `room.ts`/`room.html` durante la implementación (ver Decisión 4).
