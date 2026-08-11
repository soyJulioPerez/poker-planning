import { Page, Locator } from '@playwright/test';

export class RoomPage {
  constructor(readonly page: Page) {}

  async waitForRoomUrl(timeout: number) {
    await this.page.waitForURL(/\/room\//, { timeout });
    return this.page.url().split('/room/')[1];
  }

  async setStory(title: string) {
    await this.page
      .getByRole('textbox', { name: 'Título de la próxima historia' })
      .fill(title);
    await this.page.getByRole('button', { name: 'Definir historia' }).click();
  }

  async vote(value: string) {
    await this.page.getByRole('button', { name: value, exact: true }).click();
  }

  async reveal() {
    await this.page.getByRole('button', { name: 'Revelar votos' }).click();
  }

  async newRound() {
    await this.page.getByRole('button', { name: 'Nueva ronda' }).click();
  }

  async acceptAverage() {
    await this.page
      .getByRole('button', { name: /^Aceptar promedio/ })
      .click();
  }

  async acceptMode() {
    await this.page.getByRole('button', { name: /^Aceptar moda/ }).click();
  }

  async resolveWithParticipantVote(name: string) {
    await this.page
      .getByRole('button', { name: `Usar el voto de ${name}` })
      .click();
  }

  revealButton(): Locator {
    return this.page.getByRole('button', { name: 'Revelar votos' });
  }

  voteCard(value: string): Locator {
    return this.page.getByRole('button', { name: value, exact: true });
  }

  acceptAverageButton(): Locator {
    return this.page.getByRole('button', { name: /^Aceptar promedio/ });
  }

  acceptModeButton(): Locator {
    return this.page.getByRole('button', { name: /^Aceptar moda/ });
  }

  voteProgressText(): Locator {
    return this.page.locator('.room__vote-progress');
  }

  lastResolvedStoryText(): Locator {
    return this.page.locator('.room__last-resolved');
  }

  votingBoard(): Locator {
    return this.page.locator('.voting-board');
  }

  newRoundButton(): Locator {
    return this.page.getByRole('button', { name: 'Nueva ronda' });
  }

  resolutionPanel(): Locator {
    return this.page.locator('.room__resolution');
  }

  async toggleModeratorIsVoter() {
    // El input real es visualmente invisible (opacity:0, patrón de switch custom);
    // el <label> completo es el elemento clickeable que dispara el toggle nativo.
    await this.page.locator('label.participant-list__voter-switch').click();
  }

  moderatorVoterCheckbox(): Locator {
    return this.page.locator('.participant-list__voter-switch input[type=checkbox]');
  }

  participantItem(name: string): Locator {
    return this.page.locator('li.participant-list__item', { hasText: name });
  }

  disconnectedStatusFor(name: string): Locator {
    return this.participantItem(name).locator('.participant-list__status');
  }
}
