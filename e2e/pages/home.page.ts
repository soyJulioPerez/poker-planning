import { Page, Locator } from '@playwright/test';

export class HomePage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  // El formulario de creación, identificado por su botón de submit.
  //
  // Acotar a este formulario NO es cosmético: la home arranca en modo "join" y **los dos
  // formularios tienen un campo "Tu nombre"**. Angular corre zoneless, así que el click en
  // el tab solo *agenda* la detección de cambios: durante un instante el DOM sigue
  // mostrando el formulario de join. Un `getByRole('textbox', { name: 'Tu nombre' })`
  // suelto encuentra ese, lo llena, y cuando la CD corre el `@if` destruye ese input y
  // crea el de creación vacío. El submit dispara `createRoom()`, que hace
  // `if (!this.moderatorName.trim()) return;` — y no pasa absolutamente nada: sin error,
  // sin WebSocket, sin navegación. El test muere después en `waitForRoomUrl`.
  //
  // Con el locator acotado, el auto-wait de Playwright espera a que exista el formulario
  // correcto en vez de escribir en el que está de paso. Diagnosticado en CI, donde el
  // runner es lo bastante lento como para perder la carrera casi siempre (change
  // `add-e2e-to-ci`).
  private createForm(): Locator {
    return this.page
      .locator('form')
      .filter({ has: this.page.getByRole('button', { name: 'Crear sala' }) });
  }

  async createRoom(name: string, options?: { deckLabel?: string }) {
    await this.page.getByRole('button', { name: 'Crear sala' }).click();
    const form = this.createForm();
    await form.getByRole('textbox', { name: 'Tu nombre' }).fill(name);
    if (options?.deckLabel) {
      await form
        .getByLabel('Mazo de estimación')
        .selectOption({ label: options.deckLabel });
    }
    await form.getByRole('button', { name: 'Crear sala' }).click();
  }

  async joinRoom(roomId: string, name: string) {
    await this.page.getByRole('textbox', { name: 'Código de sala' }).fill(roomId);
    await this.page.getByRole('textbox', { name: 'Tu nombre' }).fill(name);
    await this.page.getByRole('button', { name: 'Unirse', exact: true }).click();
  }

  nameTakenError(): Locator {
    return this.page.getByText('Ese nombre ya está en uso en esta sala.');
  }
}
