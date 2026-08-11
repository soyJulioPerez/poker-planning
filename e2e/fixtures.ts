import { test as base } from '@playwright/test';
import { HomePage } from './pages/home.page';
import { RoomPage } from './pages/room.page';

// Vuelca a stdout lo que el navegador reporta: errores de consola, excepciones sin
// capturar y pedidos fallidos.
//
// Sin esto, un fallo en CI solo dejaba "waitForURL: Timeout 10000ms exceeded" y la
// investigación arrancaba sin saber siquiera si el WebSocket había intentado conectar.
// Los `[browser]` quedan intercalados con los `[WebServer]` del backend en el log del
// job, que es justo la correlación que hace falta.
function attachBrowserDiagnostics(page: import('@playwright/test').Page): void {
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      console.log(`[browser:${message.type()}] ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    console.log(`[browser:pageerror] ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    console.log(
      `[browser:requestfailed] ${request.url()} — ${request.failure()?.errorText ?? 'sin detalle'}`
    );
  });
}

export const test = base.extend<{ homePage: HomePage; roomPage: RoomPage }>({
  page: async ({ page }, use) => {
    attachBrowserDiagnostics(page);
    await use(page);
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  roomPage: async ({ page }, use) => {
    await use(new RoomPage(page));
  },
});

export { expect } from '@playwright/test';
