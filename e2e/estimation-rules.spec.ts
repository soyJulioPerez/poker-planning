import { expect, test } from './fixtures';
import { HomePage } from './pages/home.page';
import { RoomPage } from './pages/room.page';

// Ver estimation-flow.spec.ts: mismo ajuste de timeouts para correr contra AWS.
const isAws = process.env['E2E_TARGET'] === 'aws';
test.setTimeout(isAws ? 90_000 : 30_000);
const navigationTimeout = isAws ? 30_000 : 10_000;

test.describe('precondiciones de historia', () => {
  test('revelar y votar están indisponibles sin historia asignada', async ({
    homePage,
    roomPage,
  }) => {
    await homePage.goto();
    await homePage.createRoom('Moderador E2E');
    await roomPage.waitForRoomUrl(navigationTimeout);

    await expect(roomPage.revealButton()).toHaveCount(0);
    await expect(roomPage.votingBoard()).toHaveCount(0);
  });
});

test('moda empatada no ofrece botón de aceptar, y el promedio sigue disponible', async ({
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

  await moderatorRoom.setStory('Historia con empate');
  await moderatorRoom.vote('3');
  await participantRoom.vote('5');

  await expect(moderatorRoom.voteProgressText()).toHaveText('2 de 2 votaron');
  await moderatorRoom.reveal();

  await expect(moderatorRoom.acceptModeButton()).toHaveCount(0);
  // (3 + 5) / 2 = 4 crudo, pero 4 no es una carta Fibonacci — empata a distancia 1 de
  // 3 y de 5, y el desempate existente favorece el valor menor.
  await expect(moderatorRoom.acceptAverageButton()).toHaveText('Aceptar promedio (3)');

  await participantContext.close();
});

test('moda no numérica sin escala interna no se puede aceptar; nueva ronda descarta los votos', async ({
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

  await moderatorRoom.setStory('Historia sin consenso');
  await moderatorRoom.vote('☕');
  await participantRoom.vote('☕');

  await expect(moderatorRoom.voteProgressText()).toHaveText('2 de 2 votaron');
  await moderatorRoom.reveal();

  await expect(moderatorRoom.acceptModeButton()).toHaveCount(0);
  await expect(moderatorRoom.acceptAverageButton()).toHaveCount(0);

  await moderatorRoom.newRound();

  await expect(moderatorRoom.voteProgressText()).toHaveText('0 de 2 votaron');
  await expect(moderatorRoom.voteCard('5')).toBeEnabled();
  await expect(participantRoom.voteCard('5')).toBeEnabled();

  await participantContext.close();
});

test('moderador resuelve con el voto numérico de un participante puntual', async ({
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

  await moderatorRoom.setStory('Historia con voto puntual');
  await moderatorRoom.vote('3');
  await participantRoom.vote('8');

  await expect(moderatorRoom.voteProgressText()).toHaveText('2 de 2 votaron');
  await moderatorRoom.reveal();

  await moderatorRoom.resolveWithParticipantVote('Participante E2E');

  await expect(moderatorRoom.lastResolvedStoryText()).toHaveText(
    'Historia "Historia con voto puntual" resuelta con 8 pts'
  );

  await participantContext.close();
});

test.describe('mazo T-Shirt Sizes', () => {
  test('aceptar la moda asigna el número interno de la talla, no la talla como texto', async ({
    browser,
    homePage: moderatorHome,
    roomPage: moderatorRoom,
  }) => {
    const participantContext = await browser.newContext();
    const participantPage = await participantContext.newPage();
    const participantHome = new HomePage(participantPage);
    const participantRoom = new RoomPage(participantPage);

    await moderatorHome.goto();
    await moderatorHome.createRoom('Moderador E2E', { deckLabel: 'T-Shirt Sizes' });
    const roomId = await moderatorRoom.waitForRoomUrl(navigationTimeout);

    await participantHome.goto();
    await participantHome.joinRoom(roomId, 'Participante E2E');
    await participantPage.waitForURL(/\/room\//, { timeout: navigationTimeout });

    await moderatorRoom.setStory('Historia T-Shirt moda');
    await moderatorRoom.vote('M');
    await participantRoom.vote('M');

    await expect(moderatorRoom.voteProgressText()).toHaveText('2 de 2 votaron');
    await moderatorRoom.reveal();

    await expect(moderatorRoom.acceptModeButton()).toHaveText('Aceptar moda (M)');
    await moderatorRoom.acceptMode();

    // El servidor registra el número interno (4), pero la UI lo muestra como
    // la etiqueta de talla correspondiente (valueLabel), no como número crudo.
    await expect(moderatorRoom.lastResolvedStoryText()).toHaveText(
      'Historia "Historia T-Shirt moda" resuelta con M pts'
    );

    await participantContext.close();
  });

  test('el promedio se redondea a la talla más cercana por distancia lineal', async ({
    browser,
    homePage: moderatorHome,
    roomPage: moderatorRoom,
  }) => {
    const participantContext = await browser.newContext();
    const participantPage = await participantContext.newPage();
    const participantHome = new HomePage(participantPage);
    const participantRoom = new RoomPage(participantPage);

    await moderatorHome.goto();
    await moderatorHome.createRoom('Moderador E2E', { deckLabel: 'T-Shirt Sizes' });
    const roomId = await moderatorRoom.waitForRoomUrl(navigationTimeout);

    await participantHome.goto();
    await participantHome.joinRoom(roomId, 'Participante E2E');
    await participantPage.waitForURL(/\/room\//, { timeout: navigationTimeout });

    await moderatorRoom.setStory('Historia T-Shirt promedio');
    // S=2, L=8 → promedio interno 5 → distancia a M(4)=1, a L(8)=3 → talla más cercana: M
    await moderatorRoom.vote('S');
    await participantRoom.vote('L');

    await expect(moderatorRoom.voteProgressText()).toHaveText('2 de 2 votaron');
    await moderatorRoom.reveal();

    await expect(moderatorRoom.acceptAverageButton()).toHaveText('Aceptar promedio (M)');
    await moderatorRoom.acceptAverage();

    // Mismo criterio que en el caso de moda: se muestra la etiqueta de talla, no el número interno.
    await expect(moderatorRoom.lastResolvedStoryText()).toHaveText(
      'Historia "Historia T-Shirt promedio" resuelta con M pts'
    );

    await participantContext.close();
  });
});
