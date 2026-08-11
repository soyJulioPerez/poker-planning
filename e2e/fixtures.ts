import { test as base, type Page } from '@playwright/test';
import { HomePage } from './pages/home.page';
import { RoomPage } from './pages/room.page';

// Vuelca a stdout lo que el navegador reporta. Sin esto, un fallo en CI solo dejaba
// "waitForURL: Timeout 10000ms exceeded" y la investigación arrancaba sin saber siquiera
// si el WebSocket había intentado conectar.
//
// El evento `websocket` es el que importa acá: toda la app depende de una única conexión
// a `ws://localhost:3001`, y un socket que queda en CONNECTING no produce ningún error de
// consola hasta que vence el timeout del navegador — mucho después de que el test ya
// falló. Escuchar el evento distingue "nunca se creó" de "se creó y no abrió".
//
// Los `[browser]` quedan intercalados con los `[WebServer]` del backend en el log del job,
// que es justo la correlación que hace falta.
function attachBrowserDiagnostics(page: Page, label: string): void {
  page.on('websocket', (ws) => {
    console.log(`[browser:ws:open-attempt] ${label} ${ws.url()}`);
    ws.on('socketerror', (error) => console.log(`[browser:ws:error] ${label} ${error}`));
    ws.on('close', () => console.log(`[browser:ws:close] ${label} ${ws.url()}`));
  });
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      console.log(`[browser:${message.type()}] ${label} ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    console.log(`[browser:pageerror] ${label} ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    console.log(
      `[browser:requestfailed] ${label} ${request.url()} — ${
        request.failure()?.errorText ?? 'sin detalle'
      }`
    );
  });
}

export const test = base.extend<{ homePage: HomePage; roomPage: RoomPage }>({
  page: async ({ page }, use) => {
    attachBrowserDiagnostics(page, 'page');
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
