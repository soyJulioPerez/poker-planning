# Tareas — Los e2e entran al portón de CI

> **El grupo 2 va antes que el 4 a propósito.** El modo `ci` del config es el supuesto
> sobre el que se apoya todo el diseño (Decisión 2), y se verifica en local. Escribir el
> YAML primero significaría descubrir el problema a razón de un push por intento.

## 1. El grafo aprende que los e2e dependen de la app

- [x] 1.1 Confirmar el punto de partida: `npx nx show projects --affected --base=HEAD~1` sobre un commit que toque `apps/web` **no** debe listar `e2e`.
- [x] 1.2 Agregar `"implicitDependencies": ["web", "realtime-api"]` a `e2e/project.json`.
- [x] 1.3 Confirmar que ahora sí lo lista, en los tres casos: cambio en `apps/web`, en `apps/realtime-api` y en `packages/shared-contracts`.
- [x] 1.4 Confirmar el negativo, que es el que importa: un cambio solo en `docs/` o en `apps/mobile` **no** marca `e2e` como afectado.
- [x] 1.5 Confirmar que `npx nx graph` muestra las dos aristas nuevas.

## 2. Modo `ci` en el config de Playwright

- [x] 2.1 **Verificar primero la incógnita del diseño**: correr `npx nx run web:serve-static` a mano y confirmar que sirve `http://localhost:4200` con fallback SPA (probar una URL profunda tipo `/room/ABC123`).
- [x] 2.2 Agregar el modo `ci` a `e2e/playwright.config.mts`, con `webServer` de dos entradas: `nx run web:serve-static` esperando por `url`, y `node dist/apps/realtime-api/main.js` esperando por **`port: 3001`** (es un WebSocket, no un servidor HTTP).
- [x] 2.3 Pasarle al proceso del backend el entorno que necesita: `DYNAMODB_ENDPOINT=http://127.0.0.1:8000`, `AWS_REGION=us-east-2`, `TABLE_NAME=poker-planning-rooms` y credenciales dummy de AWS.
- [x] 2.4 **Confirmar que no aparece "recursive task invocation detected"** al correr `E2E_TARGET=ci nx e2e e2e`. Si aparece, aplicar la salida documentada en la Decisión 2: buildear `web` aparte y servir `dist/apps/web/browser` con un comando opaco a la inferencia del plugin.
- [x] 2.5 Confirmar que el modo `local` (default) sigue sin orquestar nada, y que el modo `aws` sigue igual. Los tres modos tienen que convivir.

## 3. Higiene del entorno local

- [x] 3.1 Reemplazar `localhost` por `127.0.0.1` en los scripts de `package.json` que apuntan a DynamoDB Local (`dev:db:create-table`, `dev:api`, y el `e2e:db:up` que llama al primero). Ver la entrada de resolución IPv6 en `known-issues.md`.
- [x] 3.2 Agregar las credenciales dummy de AWS a `dev:db:create-table`: el CLI las exige aunque el endpoint sea local.
- [x] 3.3 Hacer que `e2e:db:up` **espere activamente** a que el contenedor acepte conexiones antes de crear la tabla. Hoy puede correr `create-table` contra un DynamoDB que todavía está arrancando.
- [x] 3.4 Agregar un script `test:e2e:ci` que sea el comando único de reproducción: levantar la base, buildear `realtime-api`, y correr la suite en modo `ci`.
- [x] 3.5 Corregir las **dos** referencias a `docs/e2e-tests.md` en `e2e/playwright.config.mts`. Ese archivo no existe; el que hay es `docs/e2e-lessons-learned.md`.
- [x] 3.6 Correr `npm run test:e2e:ci` en limpio —sin nada levantado a mano— y confirmar que la suite arranca sola.

## 4. El job de e2e en `ci.yml`

- [x] 4.1 Agregar el job `e2e` a `.github/workflows/ci.yml`, **sin `if:` a nivel de job**: tiene que correr siempre para no quedar `skipped` (Decisión 3).
- [x] 4.2 Primer paso del job: calcular su propio alcance con `npx nx show projects --affected --with-target e2e --json` y exponerlo como output de step. Los pasos siguientes se guardan con ese output.
- [x] 4.3 Checkout con `fetch-depth: 0` y `filter: tree:0`, `setup-node` con `node-version: 24` y `cache: npm`, y `nrwl/nx-set-shas@v5` con `main-branch-name: develop` — igual que `verify`, porque el cálculo de afectados necesita lo mismo.
- [x] 4.4 Agregar `npx playwright install --with-deps chromium`. `npm ci` instala la librería, no los navegadores; sin este paso el fallo es `Executable doesn't exist`, que no dice nada sobre la causa.
- [x] 4.5 Levantar DynamoDB Local en el runner y crear la tabla, reutilizando el script de `package.json` y no una copia del comando en el YAML.
- [x] 4.6 Correr `npx nx e2e e2e --outputStyle=static` con `E2E_TARGET=ci`. El target no atomizado, no `e2e-ci` (Decisión 4).
- [x] 4.7 Agregar `actions/upload-artifact` con `if: failure()` (o `always()`, decidir al escribirlo) apuntando a `dist/.playwright/e2e/`, que es donde el preset deja reportes, trazas y blobs.
- [x] 4.8 **No** configurar `retries`, `workers`, `forbidOnly` ni el reporter `blob`: el preset de Nx ya los pone cuando detecta `CI`. Confirmarlo leyendo el log de la primera corrida en vez de asumirlo.

## 5. Encadenar los deploys

- [x] 5.1 Cambiar `needs: verify` por `needs: [verify, e2e]` en `deploy-backend` y en `deploy-web`.
- [x] 5.2 Confirmar que **no** hizo falta agregar `always()`, `!cancelled()` ni leer `needs.e2e.result`. Si hizo falta, el job `e2e` está quedando `skipped` y hay que corregir eso, no el `if:` del deploy.
- [x] 5.3 Revisar que el `concurrency` a nivel de workflow sigue sin cancelar corridas de deploy (`cancel-in-progress` solo en pull requests). El job nuevo no debería cambiarlo, pero conviene mirarlo.

## 6. Verificación en PRs reales

> Los tres primeros son el criterio de aceptación del roadmap. El cuarto es el que prueba
> que la Decisión 3 funciona, y es el único que no se puede deducir leyendo el YAML.

- [x] 6.1 PR que toca solo `docs/`: el job `e2e` corre, no encuentra nada que hacer y **termina en verde, no en gris**. Verificar el estado exacto en la UI de Actions.
- [x] 6.2 PR que toca `apps/web`: los 3 specs corren y pasan.
- [x] 6.3 PR con un e2e roto a propósito: el check queda en rojo. Revertirlo después.
- [x] 6.4 Push a una rama `release/**` que afecte al backend: confirmar que `deploy-backend` **espera a los dos jobs** y corre. Este es el que valida que `needs: [verify, e2e]` no rompió el encadenamiento.
- [x] 6.5 Con la corrida de 6.3 todavía roja, confirmar que ningún job de deploy se ejecutó.
- [x] 6.6 Descargar el artifact de la corrida de 6.3 y confirmar que la traza de Playwright se puede abrir.
- [x] 6.7 Anotar cuánto tardó la suite con `workers: 1`. Es el número que falta para decidir, más adelante, si hace falta atomizar.

## 7. El test inestable

- [x] 7.1 Correr el job **tres veces** sobre el mismo commit (re-run) y anotar el resultado de `room-moderation.spec.ts:158` en cada una.
- [x] 7.2 Según el resultado, una de dos:
  - **Pasa las tres** → queda activo. Actualizar la entrada de `known-issues.md` con el dato nuevo: en Linux limpio no se reproduce, con las corridas enlazadas.
  - **Falla alguna** → `test.fixme`, igual que su gemelo de `:119`, con la corrida enlazada como evidencia. Anotarlo en `known-issues.md`.
- [x] 7.3 En cualquiera de los dos casos, **no** usar `continue-on-error` ni degradar el job a informativo. Un check que no puede poner el PR en rojo no es un check.

## 8. Documentación

- [x] 8.1 `docs/hardening-roadmap.md`: marcar la 1.2 como hecha, con la nota de qué quedó distinto de lo anticipado (la recomendación se invirtió a la opción 2, y por qué).
- [x] 8.2 `docs/hardening-roadmap.md`: sacar de "Deuda menor detectada de paso" el ítem de `docs/e2e-tests.md`, ya resuelto en 3.5.
- [x] 8.3 `docs/known-issues.md`: cerrar la entrada de Playwright sin binarios (queda resuelta en CI; sigue aplicando en local, aclararlo) y la de `localhost`/IPv6, resuelta en 3.1.
- [x] 8.4 `docs/local-dev-workflow.md`: documentar `npm run test:e2e:ci` como la forma de correr la suite sin levantar tres terminales a mano.
- [x] 8.5 `docs/e2e-lessons-learned.md`: registrar que `nx serve` no es la única forma de levantar las apps para Playwright, y que los artefactos construidos esquivan la inferencia del plugin. Es el hallazgo que desbloqueó este change.
