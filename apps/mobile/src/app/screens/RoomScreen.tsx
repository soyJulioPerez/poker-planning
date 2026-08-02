import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AVAILABLE_DECKS } from 'shared-contracts';
import { ParticipantList } from '../ui/ParticipantList';
import { RevealPanel } from '../ui/RevealPanel';
import { VotingBoard } from '../ui/VotingBoard';
import { useMyName, useRoom, useRoomClient, useRoomSummary } from '../core/use-room-client';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Room'>;

function valueLabel(value: number, numericValues: Record<string, number> | null): string {
  if (!numericValues) return `${value}`;
  const entry = Object.entries(numericValues).find(([, num]) => num === value);
  return entry ? entry[0] : `${value}`;
}

function modeAsNumber(mode: string[], numericValues: Record<string, number> | null): number | null {
  if (mode.length !== 1) return null;
  const value = numericValues?.[mode[0]] ?? Number(mode[0]);
  return Number.isFinite(value) ? value : null;
}

export function RoomScreen({ navigation, route }: Props) {
  const { roomId } = route.params;
  const client = useRoomClient();
  const room = useRoom();
  const [myName] = useMyName();
  const roomSummary = useRoomSummary();
  const [nextStoryTitle, setNextStoryTitle] = useState('');

  useEffect(() => {
    if (client.hasSessionFor(roomId)) {
      client.rejoinIfNeeded(roomId);
    } else {
      navigation.replace('Home', { roomId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (roomSummary) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.h1}>Resumen de la sesión</Text>
        {roomSummary.stories.map((story) => (
          <View key={story.title} style={styles.summaryRow}>
            <Text>{story.title}</Text>
            <Text>{story.finalScore !== null ? valueLabel(story.finalScore, null) : '—'} pts</Text>
          </View>
        ))}
        <Text style={styles.summaryTotal}>Total: {roomSummary.totalScore} pts</Text>
      </ScrollView>
    );
  }

  if (!room) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Conectando a la sala...</Text>
      </View>
    );
  }

  const isModerator = room.moderatorName === myName;
  const myParticipant = room.participants.find((p) => p.name === myName) ?? null;
  const deck = AVAILABLE_DECKS.find((d) => d.id === room.deckId) ?? null;
  const deckValues = deck?.values ?? [];
  const deckDisplayValues = deck?.displayValues ?? null;
  const deckNumericValues = deck?.numericValues ?? null;
  const voters = room.participants.filter((p) => p.isVoter && p.connected);
  const voted = voters.filter((p) => p.vote !== null).length;

  function send(request: Parameters<typeof client.send>[0]) {
    client.send(request);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.h1}>Sala {room.roomId}</Text>
        <Text style={styles.stat}>Historias estimadas: {room.storiesEstimatedCount}</Text>
        <Text style={styles.stat}>Total: {room.accumulatedScore} pts</Text>
        {isModerator ? (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => send({ action: 'closeRoom', roomId: room.roomId })}
          >
            <Text style={styles.closeButtonText}>Cerrar sala</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {room.currentStoryTitle ? (
        <Text style={styles.currentStory}>
          Historia actual: <Text style={styles.bold}>{room.currentStoryTitle}</Text>
        </Text>
      ) : room.lastResolvedStory ? (
        <Text style={styles.lastResolved}>
          Historia "{room.lastResolvedStory.title}" resuelta con{' '}
          {room.lastResolvedStory.finalScore !== null
            ? valueLabel(room.lastResolvedStory.finalScore, deckNumericValues)
            : '—'}{' '}
          pts
        </Text>
      ) : null}

      {isModerator && room.roundPhase !== 'revealed' ? (
        <View style={styles.nextStoryRow}>
          <TextInput
            style={styles.nextStoryInput}
            placeholder="Título de la próxima historia"
            value={nextStoryTitle}
            onChangeText={setNextStoryTitle}
          />
          <TouchableOpacity
            style={styles.nextStoryButton}
            onPress={() => {
              if (!nextStoryTitle.trim()) return;
              send({ action: 'nextStory', roomId: room.roomId, storyTitle: nextStoryTitle.trim() });
              setNextStoryTitle('');
            }}
          >
            <Text style={styles.nextStoryButtonText}>
              {room.currentStoryTitle ? 'Cambiar historia' : 'Definir historia'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.section}>
        {room.roundPhase === 'revealed' && room.revealResult ? (
          (() => {
            const revealResult = room.revealResult;
            if (!revealResult) return null;
            return (
              <>
                <RevealPanel
                  result={revealResult}
                  isModerator={isModerator}
                  numericValues={deckNumericValues}
                  onResolveVote={(score) => send({ action: 'resolveStory', roomId: room.roomId, finalScore: score })}
                  onNewRound={() => send({ action: 'newRound', roomId: room.roomId })}
                />
                {isModerator ? (
                  <View style={styles.resolutionRow}>
                    {revealResult.average !== null ? (
                      <TouchableOpacity
                        style={styles.resolutionButton}
                        onPress={() =>
                          send({ action: 'resolveStory', roomId: room.roomId, finalScore: revealResult.average as number })
                        }
                      >
                        <Text style={styles.resolutionButtonText}>
                          Aceptar promedio ({valueLabel(revealResult.average, deckNumericValues)})
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    {(() => {
                      const numericMode = modeAsNumber(revealResult.mode, deckNumericValues);
                      if (numericMode === null) return null;
                      return (
                        <TouchableOpacity
                          style={styles.resolutionButton}
                          onPress={() =>
                            send({ action: 'resolveStory', roomId: room.roomId, finalScore: numericMode })
                          }
                        >
                          <Text style={styles.resolutionButtonText}>Aceptar moda ({revealResult.mode[0]})</Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                ) : null}
              </>
            );
          })()
        ) : room.currentStoryTitle ? (
          <>
            <Text style={styles.h2}>Votá tu estimación</Text>
            <VotingBoard
              deckValues={deckValues}
              displayValues={deckDisplayValues}
              myVote={myParticipant?.vote ?? null}
              disabled={myParticipant ? !myParticipant.isVoter : true}
              onVote={(value) => send({ action: 'vote', roomId: room.roomId, value })}
            />
          </>
        ) : (
          <Text style={styles.noStory}>Esperando a que el moderador defina la historia a estimar.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.h2}>Participantes</Text>
        <ParticipantList
          participants={room.participants}
          isModerator={isModerator}
          canChangeVoterStatus={room.roundPhase === 'idle'}
          onModeratorIsVoterChange={(isVoter) =>
            send({ action: 'setModeratorIsVoter', roomId: room.roomId, isVoter })
          }
        />

        {isModerator && room.roundPhase !== 'revealed' && room.currentStoryTitle ? (
          <View style={styles.revealRow}>
            <Text style={styles.voteProgress}>
              {voted} de {voters.length} votaron
            </Text>
            <TouchableOpacity
              style={styles.revealButton}
              onPress={() => send({ action: 'reveal', roomId: room.roomId })}
            >
              <Text style={styles.revealButtonText}>Revelar votos</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, gap: 16 },
  loading: { textAlign: 'center', marginTop: 40, color: '#6b7280' },
  header: { gap: 4 },
  h1: { fontSize: 22, fontWeight: '700' },
  h2: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  stat: { fontSize: 13, color: '#374151' },
  closeButton: { alignSelf: 'flex-start', marginTop: 8 },
  closeButtonText: { color: '#b91c1c', fontWeight: '600' },
  currentStory: { fontSize: 14 },
  bold: { fontWeight: '700' },
  lastResolved: { fontSize: 14, color: '#374151' },
  nextStoryRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  nextStoryInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nextStoryButton: { backgroundColor: '#143055', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  nextStoryButtonText: { color: '#ffffff', fontSize: 13 },
  section: { gap: 8 },
  resolutionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  resolutionButton: {
    backgroundColor: '#143055',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resolutionButtonText: { color: '#ffffff', fontSize: 13 },
  noStory: { color: '#6b7280' },
  revealRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  voteProgress: { fontSize: 13, color: '#374151' },
  revealButton: { backgroundColor: '#143055', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  revealButtonText: { color: '#ffffff', fontSize: 13 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryTotal: { fontWeight: '700', marginTop: 12 },
});
