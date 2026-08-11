import { expect, test } from './fixtures';
import { HomePage } from './pages/home.page';
import { RoomPage } from './pages/room.page';

// Contra AWS (WebSocket real en la nube, con posible cold start de Lambda en la
// primera conexión) las acciones tardan más que contra el backend local — se
// extiende el timeout general y el de las esperas de navegación puntuales para
// evitar falsos negativos por latencia de red.
const isAws = process.env['E2E_TARGET'] === 'aws';
test.setTimeout(isAws ? 90_000 : 30_000);
const navigationTimeout = isAws ? 30_000 : 10_000;

test('crear sala, votar, revelar y resolver una historia', async ({
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

  await moderatorRoom.setStory('Historia e2e');

  await moderatorRoom.vote('5');
  await participantRoom.vote('5');

  await expect(moderatorRoom.voteProgressText()).toHaveText('99 de 99 votaron') // ROTO A PROPOSITO — verificacion 6.3/6.5;

  await moderatorRoom.reveal();
  await expect(moderatorRoom.acceptAverageButton()).toHaveText('Aceptar promedio (5)');

  await moderatorRoom.acceptAverage();

  await expect(moderatorRoom.lastResolvedStoryText()).toHaveText(
    'Historia "Historia e2e" resuelta con 5 pts'
  );

  await participantContext.close();
});
