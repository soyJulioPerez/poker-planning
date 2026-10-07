import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Participant, Room } from 'shared-contracts';
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
