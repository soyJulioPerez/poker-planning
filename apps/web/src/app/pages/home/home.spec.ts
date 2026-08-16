import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { appRoutes } from '../../app.routes';
import { RoomSocketService } from '../../core/room-socket.service';
import { FakeRoomSocketService } from '../../testing/fake-room-socket-service';
import { Home } from './home';

async function setup(queryParams: Record<string, string>) {
  const fakeSocketService = new FakeRoomSocketService();

  await TestBed.configureTestingModule({
    imports: [Home],
    providers: [
      provideRouter(appRoutes),
      { provide: RoomSocketService, useValue: fakeSocketService },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
    ],
  }).compileComponents();

  return { fakeSocketService };
}

describe('Home', () => {
  it('con ?room=<código> en la query, precarga el formulario de unirse con el código en mayúsculas', async () => {
    // La otra mitad del flujo que resuelve "Link directo a una sala en pestaña nueva nunca conecta".
    await setup({ room: 'abc123' });

    const fixture = TestBed.createComponent(Home);

    expect(fixture.componentInstance.mode()).toBe('join');
    expect(fixture.componentInstance.joinRoomId).toBe('ABC123');
  });

  it('sin ?room= en la query, el formulario de unirse queda vacío', async () => {
    await setup({});

    const fixture = TestBed.createComponent(Home);

    expect(fixture.componentInstance.joinRoomId).toBe('');
  });
});
