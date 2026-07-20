import { test, expect } from '@playwright/test';

// Contra AWS (WebSocket real en la nube, con posible cold start de Lambda en la
// primera conexión) las acciones tardan más que contra el backend local — se
// extiende el timeout general y el de las esperas de navegación puntuales para
// evitar falsos negativos por latencia de red.
const isAws = process.env['E2E_TARGET'] === 'aws';
test.setTimeout(isAws ? 90_000 : 30_000);
const navigationTimeout = isAws ? 30_000 : 10_000;

test('crear sala, votar, revelar y resolver una historia', async ({ browser }) => {
  const moderatorContext = await browser.newContext();
  const participantContext = await browser.newContext();
  const moderatorPage = await moderatorContext.newPage();
  const participantPage = await participantContext.newPage();

  await moderatorPage.goto('/');
  await moderatorPage.getByRole('button', { name: 'Crear sala' }).click();
  await moderatorPage.getByRole('textbox', { name: 'Tu nombre' }).fill('Moderador E2E');
  await moderatorPage
    .locator('form')
    .getByRole('button', { name: 'Crear sala' })
    .click();

  await moderatorPage.waitForURL(/\/room\//, { timeout: navigationTimeout });
  const roomId = moderatorPage.url().split('/room/')[1];

  await participantPage.goto('/');
  await participantPage.getByRole('textbox', { name: 'Código de sala' }).fill(roomId);
  await participantPage.getByRole('textbox', { name: 'Tu nombre' }).fill('Participante E2E');
  await participantPage.getByRole('button', { name: 'Unirse', exact: true }).click();
  await participantPage.waitForURL(/\/room\//, { timeout: navigationTimeout });

  await moderatorPage
    .getByRole('textbox', { name: 'Título de la próxima historia' })
    .fill('Historia e2e');
  await moderatorPage.getByRole('button', { name: 'Definir historia' }).click();

  await moderatorPage.getByRole('button', { name: '5' }).click();
  await participantPage.getByRole('button', { name: '5' }).click();

  await expect(moderatorPage.getByText('2 de 2 votaron')).toBeVisible();

  await moderatorPage.getByRole('button', { name: 'Revelar votos' }).click();
  await expect(moderatorPage.getByRole('button', { name: 'Aceptar promedio (5)' })).toBeVisible();

  await moderatorPage.getByRole('button', { name: 'Aceptar promedio (5)' }).click();

  await expect(
    moderatorPage.getByText('Historia "Historia e2e" resuelta con 5 pts')
  ).toBeVisible();

  await moderatorContext.close();
  await participantContext.close();
});
