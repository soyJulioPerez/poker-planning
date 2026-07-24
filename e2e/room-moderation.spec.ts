import { expect, test } from './fixtures';
import { HomePage } from './pages/home.page';
import { RoomPage } from './pages/room.page';

// Ver estimation-flow.spec.ts: mismo ajuste de timeouts para correr contra AWS.
const isAws = process.env['E2E_TARGET'] === 'aws';
test.setTimeout(isAws ? 90_000 : 30_000);
const navigationTimeout = isAws ? 30_000 : 10_000;

test('nombre duplicado es rechazado mientras el participante original sigue conectado', async ({
  browser,
  homePage: moderatorHome,
  roomPage: moderatorRoom,
}) => {
  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  const secondHome = new HomePage(secondPage);

  await moderatorHome.goto();
  await moderatorHome.createRoom('Ana');
  const roomId = await moderatorRoom.waitForRoomUrl(navigationTimeout);

  await secondHome.goto();
  await secondHome.joinRoom(roomId, 'Ana');

  await expect(secondHome.nameTakenError()).toBeVisible();

  await secondContext.close();
});

test('un participante no-moderador no ve controles de moderación', async ({
  browser,
  homePage: moderatorHome,
  roomPage: moderatorRoom,
}) => {
  const participantContext = await browser.newContext();
  const participantPage = await participantContext.newPage();
  const participantHome = new HomePage(participantPage);
  const participantRoom = new RoomPage(participantPage);

  await moderatorHome.goto();
  await moderatorHome.createRoom('Moderador E2E');
  const roomId = await moderatorRoom.waitForRoomUrl(navigationTimeout);

  await participantHome.goto();
  await participantHome.joinRoom(roomId, 'Participante E2E');
  await participantPage.waitForURL(/\/room\//, { timeout: navigationTimeout });

  await moderatorRoom.setStory('Historia sin permisos de moderación');

  await expect(participantRoom.revealButton()).toHaveCount(0);

  await moderatorRoom.vote('5');
  await participantRoom.vote('5');
  await moderatorRoom.reveal();

  await expect(participantRoom.resolutionPanel()).toHaveCount(0);
  await expect(participantRoom.newRoundButton()).toHaveCount(0);

  await participantContext.close();
});

test('moderador cambia si participa como votante entre rondas', async ({
  homePage,
  roomPage,
}) => {
  await homePage.goto();
  await homePage.createRoom('Moderador E2E');
  await roomPage.waitForRoomUrl(navigationTimeout);

  // "Quiero votar como moderador" está tildado por defecto al crear la sala (home.ts).
  await expect(roomPage.moderatorVoterCheckbox()).toBeEnabled();
  await expect(roomPage.moderatorVoterCheckbox()).toBeChecked();

  await roomPage.toggleModeratorIsVoter();

  await expect(roomPage.moderatorVoterCheckbox()).not.toBeChecked();

  await roomPage.toggleModeratorIsVoter();

  await expect(roomPage.moderatorVoterCheckbox()).toBeChecked();

  await roomPage.setStory('Historia con moderador votante');
  await expect(roomPage.voteCard('5')).toBeEnabled();
});

test('el control de "moderador vota" se bloquea durante una ronda activa', async ({
  browser,
  homePage: moderatorHome,
  roomPage: moderatorRoom,
}) => {
  const participantContext = await browser.newContext();
  const participantPage = await participantContext.newPage();
  const participantHome = new HomePage(participantPage);
  const participantRoom = new RoomPage(participantPage);

  await moderatorHome.goto();
  await moderatorHome.createRoom('Moderador E2E');
  const roomId = await moderatorRoom.waitForRoomUrl(navigationTimeout);

  await participantHome.goto();
  await participantHome.joinRoom(roomId, 'Participante E2E');
  await participantPage.waitForURL(/\/room\//, { timeout: navigationTimeout });

  await moderatorRoom.setStory('Historia con ronda activa');
  await expect(moderatorRoom.moderatorVoterCheckbox()).toBeEnabled();

  await participantRoom.vote('5');

  await expect(moderatorRoom.moderatorVoterCheckbox()).toBeDisabled();

  await participantContext.close();
});

// Ver docs/known-issues.md ("Test e2e inestable: reconexión automática") — falla
// de forma intermitente incluso con --workers=1 (sin contención de otros tests).
// Pendiente de reproducir manualmente para determinar si es un problema real
// del flujo de reconexión o solo del entorno/test.
test.fixme('reconexión automática restaura el voto sin necesidad de re-votar', async ({
  browser,
  homePage: moderatorHome,
  roomPage: moderatorRoom,
}) => {
  const participantContext = await browser.newContext();
  const participantPage = await participantContext.newPage();
  const participantHome = new HomePage(participantPage);
  const participantRoom = new RoomPage(participantPage);

  await moderatorHome.goto();
  await moderatorHome.createRoom('Moderador E2E');
  const roomId = await moderatorRoom.waitForRoomUrl(navigationTimeout);

  await participantHome.goto();
  await participantHome.joinRoom(roomId, 'Participante E2E');
  await participantPage.waitForURL(/\/room\//, { timeout: navigationTimeout });

  await moderatorRoom.setStory('Historia con reconexión');
  await participantRoom.vote('5');
  await moderatorRoom.vote('5');

  await expect(moderatorRoom.voteProgressText()).toHaveText('2 de 2 votaron');

  await participantContext.close();

  const reconnectedContext = await browser.newContext();
  const reconnectedPage = await reconnectedContext.newPage();
  const reconnectedHome = new HomePage(reconnectedPage);

  await reconnectedHome.goto();
  await reconnectedHome.joinRoom(roomId, 'Participante E2E');
  await reconnectedPage.waitForURL(/\/room\//, { timeout: navigationTimeout });

  await expect(moderatorRoom.voteProgressText()).toHaveText('2 de 2 votaron');

  await reconnectedContext.close();
});

test('participante desconectado se marca como "desconectado" sin salir de la lista', async ({
  browser,
  homePage: moderatorHome,
  roomPage: moderatorRoom,
}) => {
  const participantContext = await browser.newContext();
  const participantPage = await participantContext.newPage();
  const participantHome = new HomePage(participantPage);

  await moderatorHome.goto();
  await moderatorHome.createRoom('Moderador E2E');
  const roomId = await moderatorRoom.waitForRoomUrl(navigationTimeout);

  await participantHome.goto();
  await participantHome.joinRoom(roomId, 'Participante E2E');
  await participantPage.waitForURL(/\/room\//, { timeout: navigationTimeout });

  await expect(moderatorRoom.participantItem('Participante E2E')).toBeVisible();

  await participantContext.close();

  await expect(moderatorRoom.disconnectedStatusFor('Participante E2E')).toHaveText(
    'desconectado'
  );
  await expect(moderatorRoom.participantItem('Participante E2E')).toBeVisible();
});
