import { Participant, Room } from 'shared-contracts';
import { maskRoomForViewer } from './room-repository';

function participante(overrides: Partial<Participant> = {}): Participant {
  return {
    name: 'ana',
    isModerator: false,
    isVoter: true,
    connected: true,
    vote: null,
    icon: null,
    ...overrides,
  };
}

function sala(overrides: Partial<Room> = {}): Room {
  return {
    roomId: 'ABC123',
    deckId: 'fibonacci',
    iconGroupId: null,
    moderatorName: 'ana',
    roundPhase: 'voting',
    currentStoryTitle: 'Historia',
    participants: [],
    storiesEstimatedCount: 0,
    accumulatedScore: 0,
    revealResult: null,
    lastResolvedStory: null,
    ...overrides,
  };
}

// Esta es la regla que hace que el planning poker funcione como juego: mientras la
// ronda no esté revelada, nadie ve el voto de nadie. Si se rompe, la sesión se
// convierte en una votación a mano alzada y el sesgo de anclaje arruina la estimación.
describe('maskRoomForViewer', () => {
  describe('mientras la ronda no está revelada', () => {
    it('oculta el voto de los demás', () => {
      const room = sala({
        participants: [participante({ name: 'ana', vote: '5' }), participante({ name: 'beto', vote: '8' })],
      });

      const visto = maskRoomForViewer(room, 'ana');

      expect(visto.participants.find((p) => p.name === 'beto')?.vote).toBe('hidden');
    });

    it('conserva el voto propio de quien mira', () => {
      const room = sala({
        participants: [participante({ name: 'ana', vote: '5' }), participante({ name: 'beto', vote: '8' })],
      });

      const visto = maskRoomForViewer(room, 'ana');

      expect(visto.participants.find((p) => p.name === 'ana')?.vote).toBe('5');
    });

    // La diferencia importa y no es cosmética: la interfaz distingue "todavía no votó"
    // de "ya votó, en secreto", y de eso depende el contador de "N de M votaron".
    it('deja en null a quien todavía no votó, sin marcarlo como oculto', () => {
      const room = sala({
        participants: [participante({ name: 'ana', vote: '5' }), participante({ name: 'beto', vote: null })],
      });

      const visto = maskRoomForViewer(room, 'ana');

      expect(visto.participants.find((p) => p.name === 'beto')?.vote).toBeNull();
    });

    it('no altera el resto de los datos del participante', () => {
      const room = sala({
        participants: [
          participante({ name: 'beto', vote: '8', isModerator: true, connected: false, icon: '🦊' }),
        ],
      });

      const beto = maskRoomForViewer(room, 'ana').participants[0];

      expect(beto).toMatchObject({
        name: 'beto',
        isModerator: true,
        connected: false,
        icon: '🦊',
      });
    });

    it('no modifica la sala original', () => {
      const room = sala({ participants: [participante({ name: 'beto', vote: '8' })] });

      maskRoomForViewer(room, 'ana');

      expect(room.participants[0].vote).toBe('8');
    });
  });

  describe('una vez revelada la ronda', () => {
    it('muestra todos los votos', () => {
      const room = sala({
        roundPhase: 'revealed',
        participants: [participante({ name: 'ana', vote: '5' }), participante({ name: 'beto', vote: '8' })],
      });

      const visto = maskRoomForViewer(room, 'ana');

      expect(visto.participants.map((p) => p.vote)).toEqual(['5', '8']);
    });
  });
});
