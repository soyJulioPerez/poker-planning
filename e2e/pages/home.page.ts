import { Page, Locator } from '@playwright/test';

export class HomePage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  async createRoom(name: string, options?: { deckLabel?: string }) {
    await this.page.getByRole('button', { name: 'Crear sala' }).click();
    await this.page.getByRole('textbox', { name: 'Tu nombre' }).fill(name);
    if (options?.deckLabel) {
      await this.page
        .getByLabel('Mazo de estimación')
        .selectOption({ label: options.deckLabel });
    }
    await this.page
      .locator('form')
      .getByRole('button', { name: 'Crear sala' })
      .click();
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
