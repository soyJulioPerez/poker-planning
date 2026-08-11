import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// Tres modos, seleccionados con E2E_TARGET:
//
//   local (default)  no orquesta nada: asume DynamoDB Local + realtime-api + web ya
//                    levantados a mano (ver docs/local-dev-workflow.md). Es el modo de
//                    iteración rápida: cambiás un spec y lo corrés sin reconstruir nada.
//   ci               levanta `web` y `realtime-api` desde artefactos ya construidos.
//                    Es el que corre en el pipeline, y `npm run test:e2e:ci` lo reproduce
//                    igual en local. DynamoDB Local queda afuera a propósito: es un
//                    contenedor, no un proceso hijo, y su ciclo de vida no es el de la
//                    corrida de tests.
//   aws              levanta `web` con la configuración de AWS, contra el backend real.
//
// Por qué el modo `ci` NO usa `nx serve`: el plugin de Nx/Playwright infiere un
// `dependsOn` a partir de los comandos `nx` que encuentra en `webServer.command`, y con
// `nx serve` eso derivaba en "recursive task invocation detected". Las dos apps se pueden
// levantar sin `nx serve`:
//
//   web           `nx run web:serve-static` — buildea y sirve con fallback SPA. Es el
//                 comando que los generadores de @nx/playwright emiten por defecto, y
//                 `serve-static` está marcado `continuous: true`, que es el mecanismo
//                 de Nx para tareas de este tipo.
//   realtime-api  es un `ws` plano (apps/realtime-api/src/main.ts): `node` a secas sobre
//                 el bundle alcanza. Un comando que no empieza con `nx` es además opaco
//                 para la inferencia del plugin.
const rawTarget = process.env['E2E_TARGET'];
const target =
  rawTarget === 'aws' ? 'aws' : rawTarget === 'ci' ? 'ci' : 'local';

// Tiene que seguir siendo `localhost` y no `127.0.0.1`: el http-server que usa
// `serve-static` escucha solo en el loopback IPv6 (`[::1]:4200`), así que forzar IPv4
// no conecta. Es el reflejo del problema inverso que tiene DynamoDB Local, documentado
// en docs/known-issues.md.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

// El backend necesita esto para hablar con DynamoDB Local. `127.0.0.1` y no `localhost`
// —acá sí— porque en Windows `localhost` resuelve primero a IPv6 y el contenedor no
// responde por ese camino. Las credenciales son falsas a propósito: el SDK las exige
// aunque el endpoint sea local.
const localBackendEnv = {
  DYNAMODB_ENDPOINT: 'http://127.0.0.1:8000',
  AWS_REGION: 'us-east-2',
  TABLE_NAME: 'poker-planning-rooms',
  AWS_ACCESS_KEY_ID: 'dummy',
  AWS_SECRET_ACCESS_KEY: 'dummy',
};

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import 'dotenv/config';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Generated as a .mts file so Node forces ESM regardless of workspace
 * `type`. Playwright routes `.mts` through its ESM loader (dynamic import,
 * bypassing the pirates CJS-compile path), and Nx's native TS strip loads
 * `.mts` directly. Playwright's configLoader auto-discovers
 * `playwright.config.mts` via its extension list
 * (.ts/.js/.mts/.mjs/.cts/.cjs).
 *
 * El preset ya resuelve lo que hace falta en CI y no hay que repetirlo acá:
 * `retries: 2`, `workers: 1`, `forbidOnly` y el reporter `blob` se activan solos
 * cuando la variable CI está seteada.
 */
const preset = nxE2EPreset(import.meta.dirname, { testDir: './.' });

export default defineConfig({
  ...preset,
  // El reporter `html` que trae el preset **captura** el stdout de los tests en vez de
  // imprimirlo, así que los diagnósticos de fixtures.ts no llegaban al log del job. `list`
  // sí los echa por stdout, que es donde hacen falta para correlacionarlos con los logs
  // del backend.
  reporter: [...(preset.reporter as Array<[string, object?]>), ['list']],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    // `retain-on-failure` y no `on-first-retry`: este último graba **el reintento**, no el
    // intento que falló. Cuando el reintento pasa —que es el caso interesante— quedaba una
    // traza de una corrida exitosa y nada del fallo. Verificado en la primera corrida del
    // job de CI, donde 11 de 12 tests fallaron el primer intento y las 11 trazas subidas
    // eran de reintentos verdes.
    trace: 'retain-on-failure',
  },
  webServer:
    target === 'aws'
      ? [
          {
            command: 'npx nx serve web --configuration=aws',
            url: baseURL,
            reuseExistingServer: true,
            cwd: workspaceRoot,
            timeout: 60_000,
          },
        ]
      : target === 'ci'
        ? [
            {
              command: 'npx nx run web:serve-static',
              url: baseURL,
              reuseExistingServer: !process.env['CI'],
              cwd: workspaceRoot,
              // Incluye el build de `web`, que en una caché fría no es inmediato.
              timeout: 180_000,
              // Playwright ignora el stdout de los webServer por defecto (solo pipea
              // stderr). Sin esto, los console.log del backend no aparecen en el log del
              // job y un fallo en CI se diagnostica a ciegas.
              stdout: 'pipe',
            },
            {
              // Requiere `nx build realtime-api` previo — lo hace `npm run test:e2e:ci`.
              command: 'node dist/apps/realtime-api/main.js',
              // Se espera por puerto y no por URL: es un WebSocket, no un servidor HTTP,
              // así que no hay status que chequear.
              port: 3001,
              reuseExistingServer: !process.env['CI'],
              cwd: workspaceRoot,
              timeout: 30_000,
              env: localBackendEnv,
              stdout: 'pipe',
            },
          ]
        : undefined,
  // Solo chromium por ahora — decisión explícita del usuario para mantener la suite
  // simple y rápida en este primer corte. Firefox/webkit se pueden reactivar más
  // adelante si hace falta cobertura cross-browser.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
