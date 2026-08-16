## 1. Script del smoke test

- [x] 1.1 Crear `apps/realtime-api/scripts/smoke-test.mjs`: recibe `--ws-url` y `--table`, usa `RoomClient` de `room-client-runtime` con la fábrica de WebSocket por default (nativo de Node, sin `ws` — ver `design.md`, Decisión 2). **Hallazgo real durante la implementación**: el specifier bare `'room-client-runtime'` resuelve vía `tsconfig.base.json` paths al `.ts` fuente — eso solo funciona dentro del toolchain de Nx/TS, un script Node plano no lo ve. Import por path relativo al build (`../../../dist/packages/room-client-runtime/src/index.js`), verificado en vivo que la interop CJS→ESM funciona (`RoomClient` se importa como named export sin problema).
- [x] 1.2 Secuencia: conectar, `createRoom` (moderador), `joinRoom` (segundo participante), **`nextStory`**, `vote` de ambos, `reveal`. Cada paso con timeout (15s) y mensaje de error específico. **Segundo hallazgo real**: `vote`/`reveal` rechazan con "No story assigned yet" si no se llama `nextStory` antes — `createRoom` deja `currentStoryTitle: null` a propósito (`create-room.ts`). No estaba en el plan original, la secuencia sin ese paso nunca hubiera pasado del primer voto.
- [x] 1.3 Limpieza en `finally` (corre haya pasado o fallado la secuencia): `DeleteCommand` directo contra la tabla, para `roomKey(roomId)` y cada `participantKey(roomId, name)` creado — ver `design.md`, Decisión 3. No usa `closeRoom`. Usa `Promise.allSettled` y avisa (no crashea) si algún borrado falla, para no tapar el resultado real del smoke test con un error de limpieza.
- [x] 1.4 Exit code 0 si la secuencia completa entera; ≠ 0 si cualquier paso falla o hace timeout. **Verificado en vivo** (no solo revisado): `node smoke-test.mjs` sin args → exit 1 con mensaje de uso; `node smoke-test.mjs --ws-url=ws://127.0.0.1:1 --table=fake-table` (endpoint inalcanzable) → timeout real, exit 1, limpieza correctamente salteada (sin `roomId`, cero llamados a AWS). No pude probar la secuencia completa exitosa — sin Docker disponible en este entorno no hay forma de levantar el stack local; queda para la sección 6.

## 2. Target de Nx

- [x] 2.1 Agregar `smoke-test` a `apps/realtime-api/project.json`: executor `nx:run-commands`. **Corregido**: `"dependsOn": ["^build"]` no alcanza — `realtime-api` no tiene ningún edge de grafo hacia `room-client-runtime` (no lo importa en `src/`, el import vive solo en el script), así que `^build` nunca lo dispararía. Se declaró explícito: `"dependsOn": ["room-client-runtime:build"]`. Verificado en vivo que dispara las 2 tareas correctas (`shared-contracts:build` + `room-client-runtime:build`) antes de correr el script. También se verificó (corriendo `nx lint realtime-api`) que el import por path relativo al `dist` **no** dispara `enforce-module-boundaries` — la regla no lo reconoce como dependencia cross-proyecto al no ser el specifier del paquete.
- [x] 2.2 Confirmar que corre local: `nx run realtime-api:smoke-test -- --ws-url=... --table=...`. → Verificado en vivo: los args se pasan correctamente al script, la dependencia de build se dispara, y el comportamiento de fallo/exit-code es el mismo que corriendo el script directo. No se pudo probar contra un stack de `dev` real corriendo (sin Docker en este entorno) — la prueba fue contra un endpoint inalcanzable a propósito, que ejercita el mismo camino de wiring sin necesitar un servidor real.

## 3. Wiring en los dos deploys a prod

- [x] 3.1 En `ci.yml`, job `deploy-backend`: agregado el paso después de `sam deploy`, con `if: github.ref == 'refs/heads/master'` (Decisión 4) — lee `WebSocketUrl`/`TableName` de los outputs del stack vía `aws cloudformation describe-stacks`, corre `nx run realtime-api:smoke-test` (no el script directo, para que dispare la dependencia de build de `room-client-runtime`).
- [x] 3.2 En `deploy-backend.yml`: mismo paso, con `if: github.event.inputs.environment == 'prod'`.
- [x] 3.3 Confirmar que ninguno de los dos pasos corre cuando el deploy es a `qa`/`dev`. → Por inspección de los `if:` — ambos usan condiciones que solo son verdaderas para prod (`github.ref == 'refs/heads/master'` en el automático, `environment == 'prod'` en el manual); no hay forma de que evalúen `true` para qa/dev.
- [x] 3.4 (no estaba en el plan original) **Corregido durante la implementación**: los checkouts de `deploy-backend` (`ci.yml`) y de `deploy-backend.yml` eran shallow (`fetch-depth` default = 1) — el diagnóstico de rollback necesita `HEAD^` para calcular el tag anterior, y un checkout shallow no tiene commit padre para resolver. Se agregó `fetch-depth: 0` a los dos.

## 4. Diagnóstico y rollback en caso de falla

- [x] 4.1 Paso que corre solo si el smoke test falló (`if: always() && steps.smoke-test.outcome == 'failure'`, más preciso que `if: failure()` a secas — así no se dispara si lo que falló fue otro paso anterior, como el propio `sam deploy`): calcula el tag anterior con `git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo ""`, con manejo explícito del caso "no hay tag anterior".
- [x] 4.2 Consulta `aws logs filter-log-events` sobre `/aws/lambda/poker-planning-prod-default`, filtro `{ $.level = "ERROR" }`, ventana de los últimos 5 minutos (`$(date +%s) - 300`, en milisegundos). Con `|| echo "No se pudo leer el log..."` acotado a ese comando puntual — no tapa el resto del paso si falla.
- [ ] 4.3 Verificar en la práctica si el rol `AWS_DEPLOY_ROLE_ARN` tiene permiso de `logs:FilterLogEvents`. **No verificable desde acá** — requiere forzar un fallo real contra `prod` (o al menos correr el workflow con credenciales reales), que está fuera de lo que puedo hacer en este entorno sin acceso a AWS. Queda como verificación pendiente del primer uso real.
- [x] 4.4 Imprime la instrucción de rollback con el tag calculado en 4.1, al `$GITHUB_STEP_SUMMARY` (no solo al log del step, para que sea visible sin expandir nada).
- [x] 4.5 El job termina en rojo por el exit code del paso `smoke-test` en sí — los pasos de diagnóstico no tienen `continue-on-error` a nivel de step (no hace falta: ya corren con `if: always()` después del fallo, y el propio `run:` interno absorbe sus propios sub-fallos con `|| echo ...` puntual).

## 5. Documentación

- [x] 5.1 `docs/hardening-roadmap.md`: cerrar la subsección 6.1, marcar sus checkboxes, agregar el bloque `> **Hecha** el <fecha>, change \`add-backend-smoke-test\`. ...` con lo que quedó distinto (mismo estilo que las fases ya cerradas).
- [x] 5.2 `docs/hardening-roadmap.md`: actualizar la fila de la Fase 6 en la tabla "Estado" — hoy "⬜ Pendiente"; pasa a reflejar 6.1 hecha, 6.2 pendiente.

## 6. Verificación

- [ ] 6.1 Correr el script a mano contra el stack de `dev` (no `prod`) para confirmar la secuencia completa antes de dejarlo gatear ningún deploy real. **No verificable en este entorno**: sin Docker no hay forma de levantar `dev:db:up`/`dev:api` local, y no hay acceso a AWS real desde acá. Queda como primer paso obligatorio antes de confiar en este change contra un deploy real — no asumir que la secuencia completa funciona solo porque el código compila y el path de fallo se probó.
- [x] 6.2 (parcial) Forzar un fallo a propósito. **Lo verificado en vivo**: el script (`node smoke-test.mjs --ws-url=ws://127.0.0.1:1 ...`) falla con timeout, exit 1, y limpieza correctamente salteada — igual corriendo por el target de Nx. **Lo NO verificado**: los pasos nuevos de `ci.yml`/`deploy-backend.yml` (instrucción de rollback con tag real, consulta a CloudWatch Logs) — viven en YAML de GitHub Actions, no se pueden ejecutar localmente; solo se validó su sintaxis (`js-yaml`). Se confirman en la primera corrida real que falle.
- [x] 6.3 `npx nx affected -t lint test build --base=develop` en verde. → Corrió los 6 proyectos (esperable: `ci.yml` es sharedGlobal, cualquier cambio ahí marca todo como afectado) — verde.
- [x] 6.4 `openspec validate --specs --strict` en verde tras el sync. → 18/18 specs principales en verde (estado actual del repo; el sync real de esta delta ocurre al archivar).

## 7. Pull request

- [x] 7.1 `git fetch origin && git rebase origin/develop` antes de abrir el PR.
- [ ] 7.2 Abrir PR contra `develop` con `gh pr create`, título en Conventional Commits — `ci:` o `feat:` según corresponda (no es una feature de la app, ver la corrección del PR #27).
