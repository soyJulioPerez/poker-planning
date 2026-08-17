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
});
