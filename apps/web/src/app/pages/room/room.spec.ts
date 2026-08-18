import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
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
