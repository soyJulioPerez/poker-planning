import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// E2E_TARGET=local (default): asume que DynamoDB Local + realtime-api + web YA están
// levantados (ver docs/e2e-tests.md) — no orquesta nada, solo corre los tests.
// E2E_TARGET=aws: levanta automáticamente `web` con la configuración de AWS.
//
// El modo local no orquesta el backend porque `nx serve realtime-api`/`nx serve web`
// dentro de webServer.command entra en conflicto con el `dependsOn` que el propio plugin
// de Nx/Playwright infiere de esos mismos comandos ("recursive task invocation detected").
const target = process.env['E2E_TARGET'] === 'aws' ? 'aws' : 'local';
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

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
 */
export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './.' }),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /* E2E_TARGET=aws: Playwright levanta `web` con la configuración de AWS automáticamente.
     E2E_TARGET=local (default): sin webServer — asume que el entorno local ya está arriba
     (ver "Correr los tests contra el backend local" en docs/e2e-tests.md). */
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
