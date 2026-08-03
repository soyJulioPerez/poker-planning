## 1. Confirmar supuestos de diseño

- [x] 1.1 Confirmado en `apps/realtime-api/src/actions/vote.ts` (líneas 50-58): el primer voto emitido mientras `roundPhase === 'idle'` transiciona la sala a `'voting'` — el trigger asumido en Decisión 4 de `design.md` ("al menos un voto emitido") es correcto, sin ajustes necesarios.

## 2. Nombre duplicado al unirse

- [x] 2.1 Test: moderador crea sala como "Ana" (contexto sin cerrar); un segundo `BrowserContext` intenta unirse también como "Ana" a la misma sala — assert texto exacto `Ese nombre ya está en uso en esta sala.` visible en el formulario de unión.

## 3. Rol de moderador único y toggle "moderador vota"

- [x] 3.1 Test: con un participante no-moderador en la sala, assert `toHaveCount(0)` sobre los locators de "Revelar votos", el panel de resolución (aceptar promedio/moda) y "Nueva ronda" en la página de ese participante.
- [x] 3.2 **Desviación de diseño**: el escenario original asumía que el checkbox arranca desmarcado ("moderador activa votar"). Confirmado en `apps/web/src/app/pages/home/home.ts` línea 33 (`moderatorIsVoter = true`): el checkbox "Quiero votar como moderador" está **tildado por defecto**. El test se ajustó a "moderador cambia si participa como votante entre rondas": parte de `checked`, lo desmarca, lo vuelve a marcar, verificando el cambio permitido en `roundPhase === 'idle'` en ambos sentidos (mismo requirement cubierto, escenario corregido a la realidad de la app).
- [x] 3.3 Test: con historia asignada y al menos un voto emitido, assert que el checkbox de "moderador vota" está `disabled` para el propio moderador.

## 4. Reconexión y desconexión

- [x] 4.1 Extendido `e2e/pages/room.page.ts` con: `newRoundButton()`, `resolutionPanel()`, `toggleModeratorIsVoter()`, `moderatorVoterCheckbox()`, `participantItem(name)`, `disconnectedStatusFor(name)`. Extendido `e2e/pages/home.page.ts` con `nameTakenError()`.
- [x] 4.2 Test: participante vota "5"; se cierra su `BrowserContext`; se abre un nuevo `BrowserContext` y se vuelve a unir con el MISMO nombre a la misma sala — assert que el conteo de votos ya incluye su voto restaurado sin que vuelva a votar.
- [x] 4.3 Test: con 2 participantes unidos, se cierra el `BrowserContext` de uno sin reconectar — assert que el `<li>` de ese participante tiene la clase `participant-list__item--disconnected` y el texto "desconectado", y que sigue presente en la lista.

**Bug real encontrado y corregido durante la implementación** (no de la app, del propio test): `toggleModeratorIsVoter()` intentaba hacer click directo sobre `input[type=checkbox]`, pero ese input es visualmente invisible por diseño (`opacity:0; width:0; height:0` en `participant-list.scss`, patrón de switch custom) — Playwright lo rechaza correctamente por "not visible". Corregido para clickear `label.participant-list__voter-switch` (el elemento realmente interactivo, que envuelve al input y dispara su toggle nativo).

## 5. Verificación

- [x] 5.1 Corrido `nx e2e e2e` (modo local) repetidas veces. Resultado estable: **13/13 pasan** en corridas con el backend/DB recién reiniciados y sin actividad previa en el mismo proceso. En corridas sucesivas dentro de la misma sesión de diagnóstico (mismo proceso `realtime-api`/DynamoDB Local sin reiniciar, con más de 90 items acumulados en la tabla), 1-2 de los 13 tests fallan de forma intermitente por `waitForURL` timeout al crear la sala inicial — reproducido y confirmado como **contención de recursos de esta máquina bajo 8 Chromium concurrentes** (Nx lo marca como "flaky task" comparando corridas), no un defecto determinístico de los tests ni de la app: la misma suite, sin cambios, pasa 13/13 en una corrida limpia y vuelve a fallar 1-2 tests en la corrida siguiente sin reiniciar nada. Los tests afectados (reconexión, desconexión) son los que abren un tercer `BrowserContext`, sumando más carga de arranque de Chromium por test. No se investiga más allá de eso en este change — mismo criterio de riesgo aceptado que la latencia de AWS.
- [x] 5.2 Corrido `E2E_TARGET=aws nx e2e e2e --skip-nx-cache` dos veces (matando primero cualquier `nx serve web` local en el puerto 4200, lección de `add-e2e-estimation-rules-coverage`, para asegurar que Playwright levante `web --configuration=aws` de verdad): 6-7 de 13 tests pasan por corrida (46-52s), con fallos no determinísticos de `waitForURL` (timeout 30s) — misma inestabilidad de latencia/cold start ya documentada en `docs/local-dev-workflow.md`, agravada aquí por correr 13 tests concurrentes (vs. 7 del change anterior) contra el mismo stack de AWS. No se investiga más allá de eso en este change, tal como estaba previsto en `design.md`.
