import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Participant, RevealResult, Room } from 'shared-contracts';
import { appRoutes } from '../../app.routes';
import { RoomSocketService } from '../../core/room-socket.service';
import { FakeRoomSocketService } from '../../testing/fake-room-socket-service';
import { RoomPage } from './room';

async function setup(roomId: string | null) {
  const fakeSocketService = new FakeRoomSocketService();

  await TestBed.configureTestingModule({
    imports: [RoomPage],
    providers: [
      provideRouter(appRoutes),
      { provide: RoomSocketService, useValue: fakeSocketService },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap(roomId ? { roomId } : {}) } },
      },
    ],
  }).compileComponents();

  return { fakeSocketService, navigateSpy: vi.spyOn(TestBed.inject(Router), 'navigate') };
}

describe('RoomPage', () => {
  it('sin sesión guardada para esa sala, redirige a home con el código como query param', async () => {
    // Este es el flujo que resuelve "Link directo a una sala en pestaña nueva nunca conecta".
    const { fakeSocketService, navigateSpy } = await setup('ABC123');
    fakeSocketService.hasSessionForResult = false;

    TestBed.createComponent(RoomPage);

    expect(navigateSpy).toHaveBeenCalledWith(['/'], { queryParams: { room: 'ABC123' } });
    expect(fakeSocketService.rejoinIfNeededCalls).toEqual([]);
  });

  it('con sesión guardada para esa sala, reingresa en vez de redirigir', async () => {
    const { fakeSocketService, navigateSpy } = await setup('ABC123');
    fakeSocketService.hasSessionForResult = true;

    TestBed.createComponent(RoomPage);

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(fakeSocketService.rejoinIfNeededCalls).toEqual(['ABC123']);
  });

  it('si el reingreso automático es rechazado, redirige a home con el código como query param', async () => {
    const { fakeSocketService, navigateSpy } = await setup('ABC123');
    fakeSocketService.hasSessionForResult = true;

    const fixture = TestBed.createComponent(RoomPage);
    fixture.detectChanges();
    navigateSpy.mockClear();

    fakeSocketService.joinRejectedReason.set('name-taken');
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(['/'], { queryParams: { room: 'ABC123' } });
  });

  it('mientras reconecta a mitad de sesión, no reemplaza la sala cargada por el estado de carga', async () => {
    const { fakeSocketService } = await setup('ABC123');
    fakeSocketService.hasSessionForResult = true;

    const fixture = TestBed.createComponent(RoomPage);
    fakeSocketService.room.set({
      roomId: 'ABC123',
      deckId: 'fibonacci',
      iconGroupId: null,
      moderatorName: 'ana',
      roundPhase: 'idle',
      currentStoryTitle: null,
      participants: [],
      storiesEstimatedCount: 0,
      accumulatedScore: 0,
      revealResult: null,
      lastResolvedStory: null,
    });
    fakeSocketService.connected.set(false);
    fixture.detectChanges();

    expect(fixture.componentInstance.reconnecting()).toBe(true);
    expect(fixture.componentInstance.room()).not.toBeNull();
  });
});

function participante(name: string, overrides: Partial<Participant> = {}): Participant {
  return {
    name,
    isModerator: false,
    isVoter: true,
    connected: true,
    disconnectedAt: null,
    vote: null,
    icon: null,
    ...overrides,
  };
}

function salaModeradaPor(moderatorName: string, participants: Participant[]): Room {
  return {
    roomId: 'ABC123',
    deckId: 'fibonacci',
    iconGroupId: null,
    moderatorName,
    roundPhase: 'voting',
    currentStoryTitle: 'Login con Google',
    participants: participants.map((p) => ({ ...p, isModerator: p.name === moderatorName })),
    storiesEstimatedCount: 0,
    accumulatedScore: 0,
    revealResult: null,
    lastResolvedStory: null,
  };
}

/** Sala cargada desde el punto de vista de Beto. */
async function enLaSalaComoBeto(room: Room) {
  const { fakeSocketService } = await setup('ABC123');
  fakeSocketService.hasSessionForResult = true;
  fakeSocketService.connected.set(true);
  fakeSocketService.myName.set('beto');
  fakeSocketService.room.set(room);

  const fixture = TestBed.createComponent(RoomPage);
  fixture.detectChanges();
  return { fixture, fakeSocketService, page: fixture.componentInstance };
}

describe('RoomPage — cambio de moderador', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('avisa a quien recibe la moderación cedida', async () => {
    const { fixture, fakeSocketService, page } = await enLaSalaComoBeto(
      salaModeradaPor('ana', [participante('ana'), participante('beto')])
    );

    fakeSocketService.room.set(salaModeradaPor('beto', [participante('ana'), participante('beto')]));
    fixture.detectChanges();

    expect(page.notice()).toBe('Ahora sos el moderador');
  });

  it('no avisa a quien tomó la moderación por su cuenta', async () => {
    const caida = participante('ana', { connected: false, disconnectedAt: 1 });
    const { fixture, fakeSocketService, page } = await enLaSalaComoBeto(
      salaModeradaPor('ana', [caida, participante('beto')])
    );

    page.claimModeration();
    fakeSocketService.room.set(salaModeradaPor('beto', [caida, participante('beto')]));
    fixture.detectChanges();

    expect(fakeSocketService.sendCalls).toContainEqual({ action: 'claimModeration', roomId: 'ABC123' });
    expect(page.notice()).toBeNull();
  });

  it('no avisa al moderador que simplemente carga (o recarga) la sala', async () => {
    const { page } = await enLaSalaComoBeto(
      salaModeradaPor('beto', [participante('ana'), participante('beto')])
    );

    expect(page.notice()).toBeNull();
  });

  it('envía la cesión con el nombre elegido', async () => {
    const { page, fakeSocketService } = await enLaSalaComoBeto(
      salaModeradaPor('beto', [participante('ana'), participante('beto')])
    );

    page.transferModeration('ana');

    expect(fakeSocketService.sendCalls).toContainEqual({
      action: 'transferModeration',
      roomId: 'ABC123',
      targetName: 'ana',
    });
  });

  it('habilita "Tomar moderación" recién cuando el moderador lleva un minuto caído', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    const { fixture, page } = await enLaSalaComoBeto(
      salaModeradaPor('ana', [
        participante('ana', { connected: false, disconnectedAt: 1_700_000_000_000 - 30_000 }),
        participante('beto'),
      ])
    );

    expect(page.moderatorDisconnected()).toBe(true);
    expect(page.canClaimModeration()).toBe(false);

    vi.advanceTimersByTime(30_000);
    fixture.detectChanges();

    expect(page.canClaimModeration()).toBe(true);
  });

  it('no ofrece tomar la moderación si el moderador está conectado', async () => {
    const { page } = await enLaSalaComoBeto(
      salaModeradaPor('ana', [participante('ana'), participante('beto')])
    );

    expect(page.canClaimModeration()).toBe(false);
  });

  it('muestra el rechazo si no pudo tomar la moderación', async () => {
    const caida = participante('ana', { connected: false, disconnectedAt: 1 });
    const { fixture, fakeSocketService, page } = await enLaSalaComoBeto(
      salaModeradaPor('ana', [caida, participante('beto')])
    );

    page.claimModeration();
    fakeSocketService.errorMessage.set('Moderation could not be claimed');
    fixture.detectChanges();

    expect(page.notice()).toBe('No se pudo tomar la moderación.');
  });

  it('no atribuye a la moderación un error que llegó sin haberla pedido', async () => {
    const { fixture, fakeSocketService, page } = await enLaSalaComoBeto(
      salaModeradaPor('ana', [participante('ana'), participante('beto')])
    );

    fakeSocketService.errorMessage.set('Only the moderator can reveal votes');
    fixture.detectChanges();

    expect(page.notice()).toBeNull();
  });
});

/** Sala revelada vista por `quien` (Ana modera), con el mazo y el resultado indicados. */
async function salaRevelada(deckId: string, revealResult: RevealResult, quien = 'ana') {
  const { fakeSocketService } = await setup('ABC123');
  fakeSocketService.hasSessionForResult = true;
  fakeSocketService.connected.set(true);
  fakeSocketService.myName.set(quien);
  fakeSocketService.room.set({
    ...salaModeradaPor('ana', [participante('ana'), participante('beto')]),
    deckId,
    roundPhase: 'revealed',
    revealResult,
  });

  const fixture = TestBed.createComponent(RoomPage);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  return {
    fakeSocketService,
    host,
    promedio: () => host.querySelector('.reveal-panel__average')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    botones: () =>
      Array.from(host.querySelectorAll<HTMLButtonElement>('.room__resolution button')).map((b) =>
        b.textContent?.trim()
      ),
  };
}

function resultado(overrides: Partial<RevealResult>): RevealResult {
  return { votes: {}, distribution: [], average: null, rawAverage: null, averageBounds: [], mode: [], ...overrides };
}

describe('RoomPage — promedio real', () => {
  it('muestra el promedio real y ofrece las dos cartas entre las que cae', async () => {
    const { promedio, botones } = await salaRevelada(
      'fibonacci',
      resultado({ average: 8, rawAverage: 9.67, averageBounds: [8, 13], mode: ['8', '13'] })
    );

    expect(promedio()).toBe('Promedio: 9,67');
    expect(botones()).toEqual(['Aceptar 8', 'Aceptar 13']);
  });

  it('si el promedio coincide con una carta, sin decimales y con un solo botón', async () => {
    const { promedio, botones } = await salaRevelada(
      'fibonacci',
      resultado({ average: 8, rawAverage: 8, averageBounds: [8], mode: ['8', '5'] })
    );

    expect(promedio()).toBe('Promedio: 8');
    expect(botones()).toEqual(['Aceptar 8']);
  });

  it('no repite la moda si ya está entre las cartas vecinas del promedio', async () => {
    const { botones } = await salaRevelada(
      'fibonacci',
      resultado({ average: 8, rawAverage: 9.67, averageBounds: [8, 13], mode: ['8'] })
    );

    expect(botones()).toEqual(['Aceptar 8', 'Aceptar 13']);
  });

  it('ofrece la moda si no es una de las cartas vecinas del promedio', async () => {
    // 3, 3, 3, 21 → promedio 7,5 entre 5 y 8; la moda (3) no está entre ellas.
    const { botones } = await salaRevelada(
      'fibonacci',
      resultado({ average: 8, rawAverage: 7.5, averageBounds: [5, 8], mode: ['3'] })
    );

    expect(botones()).toEqual(['Aceptar 5', 'Aceptar 8', 'Aceptar moda (3)']);
  });

  it('en T-Shirt muestra las tallas entre las que cae el promedio', async () => {
    const { promedio, botones } = await salaRevelada(
      'tshirt',
      resultado({ average: 8, rawAverage: 6.67, averageBounds: [4, 8], mode: ['M', 'L'] })
    );

    expect(promedio()).toBe('Promedio: entre M y L');
    expect(botones()).toEqual(['Aceptar M', 'Aceptar L']);
  });

  it('en T-Shirt, si coincide con una talla, muestra solo esa', async () => {
    const { promedio } = await salaRevelada(
      'tshirt',
      resultado({ average: 4, rawAverage: 4, averageBounds: [4], mode: ['M', 'S'] })
    );

    expect(promedio()).toBe('Promedio: M');
  });

  it('quien no modera ve el promedio pero no los botones', async () => {
    const { promedio, botones } = await salaRevelada(
      'fibonacci',
      resultado({ average: 8, rawAverage: 9.67, averageBounds: [8, 13] }),
      'beto'
    );

    expect(promedio()).toBe('Promedio: 9,67');
    expect(botones()).toEqual([]);
  });

  it('elegir una carta vecina resuelve la historia con ese valor', async () => {
    const { host, fakeSocketService } = await salaRevelada(
      'fibonacci',
      resultado({ average: 8, rawAverage: 9.67, averageBounds: [8, 13] })
    );

    const aceptar13 = Array.from(host.querySelectorAll<HTMLButtonElement>('.room__resolution button')).find(
      (b) => b.textContent?.trim() === 'Aceptar 13'
    );
    aceptar13?.click();

    expect(fakeSocketService.sendCalls).toContainEqual({ action: 'resolveStory', roomId: 'ABC123', finalScore: 13 });
  });

  // Ronda revelada durante el deploy: el resultado guardado no trae los campos nuevos.
  it('con un resultado anterior a los campos nuevos, ofrece la carta más cercana y no muestra el promedio', async () => {
    const legacy = { votes: {}, distribution: [], average: 8, mode: [] } as unknown as RevealResult;
    const { promedio, botones } = await salaRevelada('fibonacci', legacy);

    expect(promedio()).toBeNull();
    expect(botones()).toEqual(['Aceptar 8']);
  });
});
