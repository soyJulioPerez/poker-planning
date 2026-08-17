## Context

`infra/template.yaml` ya expone `WebSocketUrl` y `TableName` como outputs de CloudFormation (líneas 441-445) — no hace falta hardcodear ni deducir ninguno de los dos.

`RoomClient` (`packages/room-client-runtime/src/lib/room-client.ts`) recibe el WebSocket como una fábrica inyectable (`WebSocketFactory`), no acoplada al `WebSocket` del navegador — construida así a propósito para compartirse con clientes no-Angular. Verificado: Node 22 (local) y Node 24 (CI) ya traen `WebSocket` como global nativo (`typeof WebSocket === 'function'`), así que `RoomClient` puede usarse en Node tal cual, sin agregar el paquete `ws` como dependencia nueva.

`handleCloseRoom` (`apps/realtime-api/src/actions/close-room.ts`) solo hace `broadcastToRoom(..., { type: 'roomClosed', summary })` — **no borra ningún item de DynamoDB**. El TTL de una sala es `ROOM_TTL_SECONDS = 4 * 60 * 60` (`apps/realtime-api/src/lib/dynamo-client.ts`). Sin limpieza explícita, cada corrida del smoke test dejaría una sala real dando vueltas en la tabla de `prod` hasta 4 horas.

El log group del handler que concentra casi toda la lógica de sala (`createRoom`, `joinRoom`, `vote`, `reveal`, `closeRoom` — todos pasan por `default`, ver `apps/realtime-api/src/main.ts`) tiene nombre fijo y predecible: `/aws/lambda/poker-planning-${Environment}-default` (`infra/template.yaml`, línea 178-180).

## Goals / Non-Goals

**Goals:**
- Detectar, con una prueba funcional real, que la API desplegada a `prod` efectivamente crea/une/vota/revela.
- No dejar datos de prueba huérfanos en la tabla real.
- Si falla, dar una instrucción de rollback concreta (con el tag real, no un placeholder) y una pista de dónde está el error, sin salir de la corrida de CI.

**Non-Goals:**
- No verificar `qa` — decisión explícita, solo `prod`. `qa` ya se ejercita indirectamente por los e2e de CI contra el stack de desarrollo/CI, y el criterio de aceptación de la Fase 6.1 solo pide prod.
- No hacer rollback automático — el smoke test detecta y diagnostica, no revierte. Revertir automáticamente un stack de CloudFormation sin supervisión es un cambio de alcance mucho mayor, fuera de lo que pide el roadmap.
- No migrar `closeRoom` para que borre datos — cambiar ese comportamiento afecta a usuarios reales (podría interesar que el resumen quede visible un rato), es una decisión de producto aparte, no algo a decidir de paso acá.

## Decisions

### Decisión 1: target de Nx (`realtime-api:smoke-test`), no un script suelto

Mismo patrón que `test-integration` (Fase 2.2): un target explícito en `project.json` con executor `nx:run-commands`, no un script en `tools/scripts/` (reservado hoy para chequeos de workspace como `check-workspace-root.mjs`, no para comportamiento de la aplicación). Corrible local con `nx run realtime-api:smoke-test -- --ws-url=<url> --table=<tabla>`, igual que ya se puede correr `test-integration` a mano.

**Dependencia real**: `room-client-runtime` publica su `package.json` con `"main": "./src/index.js"` — apunta al build, no al `.ts` fuente. El target SHALL declarar `"dependsOn": ["room-client-runtime:build"]` explícito, **no** `"dependsOn": ["^build"]`. Corregido durante la implementación: `^build` depende del grafo de proyectos de Nx (construido a partir de imports reales en `src/`), y `realtime-api` no importa `room-client-runtime` en su código — el único lugar que lo hace es el script del smoke test, que Nx no analiza para inferir el grafo. Con `^build`, la dependencia de build nunca se hubiera disparado.

**Resolución del import en el script**: el specifier bare `'room-client-runtime'` resuelve vía `tsconfig.base.json` paths al `.ts` fuente (`./packages/room-client-runtime/src/index.ts`) — eso solo funciona dentro del toolchain de Nx/TS (webpack/esbuild/ts-node resolviendo `paths`), no en un script Node plano ejecutado directo. El script importa por path relativo al build ya generado (`../../../dist/packages/room-client-runtime/src/index.js`). Verificado en vivo que la interop CJS→ESM funciona sin configuración adicional (`RoomClient` se importa como named export), y que ese import por path relativo **no** dispara `@nx/enforce-module-boundaries` (la regla reconoce dependencias cross-proyecto por el specifier del paquete, no por paths relativos hacia `dist/`) — importante porque `realtime-api` es `scope:api` y `room-client-runtime` es `scope:client`, una combinación que la regla prohibiría si el import se resolviera como dependencia real de proyecto.

### Decisión 2: `WebSocket` nativo de Node, sin agregar `ws`

Verificado en vivo, no supuesto: `node -e "console.log(typeof WebSocket)"` da `function` tanto en Node 22 local como en Node 24 (la versión que usa `ci.yml`). `RoomClient` ya acepta una fábrica de WebSocket custom — el `defaultWebSocketFactory` (`new WebSocket(url)`) sirve tal cual, sin parámetros adicionales.

### Decisión 3: limpieza vía `DeleteCommand` directo, no vía `closeRoom` ni el TTL

El script SHALL borrar explícitamente, al final de la corrida (éxito o fallo, con `try`/`finally`), los items que creó: `roomKey(roomId)` y `participantKey(roomId, name)` para cada participante — mismo patrón que ya usa `room-repository.integration.spec.ts` contra DynamoDB Local, acá apuntado a la tabla real de `prod` (nombre leído del output `TableName`, credenciales las mismas que ya usa el job para `sam deploy`).

`closeRoom` no alcanza (Non-Goal: no se modifica para que borre) y el TTL de 4 horas es demasiado para una sala de prueba que se genera en cada deploy a `prod`.

### Decisión 4: solo `prod`, en los dos lugares donde el deploy real ocurre

- `ci.yml`, job `deploy-backend`: el paso del smoke test SHALL llevar `if: github.ref == 'refs/heads/master'` (mismo job hoy despliega a `qa` en `release/**` y a `prod` en `master` — el smoke test solo corre en la segunda rama del `if`).
- `deploy-backend.yml` (manual): el paso SHALL llevar `if: github.event.inputs.environment == 'prod'`.

Ninguno de los dos toca el `if:` a nivel de job (mismo criterio ya establecido para `e2e`/`test-integration`: un job salteado arrastra a sus dependientes al mismo estado) — el smoke test es un paso condicional dentro del job existente, no un job nuevo.

### Decisión 5: sin rollback automático, con instrucción concreta y pista de log

Si el smoke test falla, el paso SHALL:

1. Calcular el tag anterior al que se acaba de desplegar: `git describe --tags --abbrev=0 HEAD^` (funciona incluso si el tag de *esta* versión todavía no existe — la Fase 7.1 crea el tag como paso manual separado, después de que el deploy automático ya corrió).
2. Consultar `aws logs filter-log-events` sobre `/aws/lambda/poker-planning-prod-default` con `--filter-pattern '{ $.level = "ERROR" }'` y una ventana de los últimos ~5 minutos, e imprimir las líneas encontradas.
3. Imprimir la instrucción de rollback ya documentada en `docs/git-branching-strategy.md` (sección "Rollback"), con el tag real interpolado: `gh workflow run deploy-backend.yml -f environment=prod -f ref=<tag-anterior>`.
4. Terminar el step con exit code ≠ 0, para que el job (y por lo tanto el deploy) quede en rojo.

**Riesgo no verificable desde el repo**: el rol `AWS_DEPLOY_ROLE_ARN` se provisiona fuera de este código (no hay ningún `AWS::IAM::Role` en `infra/template.yaml` para el rol de deploy en sí). No se puede confirmar desde acá si ya tiene `logs:FilterLogEvents`/`logs:GetLogEvents`. Se verifica en la implementación real (tarea dedicada en `tasks.md`); si falta, hay que agregarlo a mano en el proveedor de identidad (fuera de este repo) o documentar el permiso que falta.

## Risks / Trade-offs

- **[Riesgo]** El smoke test agrega ~10-20 segundos al deploy de prod (conexión WS + secuencia completa + limpieza). **Mitigación**: aceptable — el roadmap pide justamente este chequeo, y es el único lugar donde se verifica de verdad que la API responde.
- **[Riesgo]** Si el rol de deploy no tiene permiso de leer logs, el paso de diagnóstico (punto 2 de la Decisión 5) fallaría silenciosamente o rompería el step entero. **Mitigación**: la consulta de logs SHALL estar en su propio paso, con manejo de error que no bloquee la instrucción de rollback (punto 3) si el de logs falla — la instrucción de rollback es la parte crítica, el log es una ayuda opcional.
- **[Riesgo]** Un smoke test que falla por una causa transitoria (latencia de red, cold start) generaría una alarma de rollback sin que el deploy esté realmente roto. **Mitigación**: fuera de alcance de este change — si aparece en la práctica, se ajusta con reintentos; no se diseña para eso de antemano sin evidencia de que pasa.

## Migration Plan

No aplica — es tooling de verificación nuevo, sin cambios de comportamiento de producción ni pasos de despliegue de datos. Se prueba primero con `--dry-run`-equivalente (correr el script a mano contra `prod` una vez, fuera del pipeline) antes de dejarlo gatear deploys reales.
