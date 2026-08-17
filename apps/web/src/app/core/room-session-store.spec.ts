import { BrowserSessionStore } from './room-session-store';

describe('BrowserSessionStore', () => {
  const store = new BrowserSessionStore();

  afterEach(() => {
    sessionStorage.clear();
  });

  it('devuelve la sesión guardada para el mismo roomId', () => {
    store.save('ABC123', 'ana', 'participant-1');

    expect(store.get('ABC123')).toEqual({ roomId: 'ABC123', name: 'ana', participantId: 'participant-1' });
  });

  it('devuelve null si la sesión guardada es de otra sala', () => {
    store.save('ABC123', 'ana', 'participant-1');

    expect(store.get('OTRA456')).toBeNull();
  });

  it('devuelve null si no hay nada guardado', () => {
    expect(store.get('ABC123')).toBeNull();
  });

  it('clear() deja de devolver la sesión guardada', () => {
    store.save('ABC123', 'ana', 'participant-1');

    store.clear();

    expect(store.get('ABC123')).toBeNull();
  });
});
