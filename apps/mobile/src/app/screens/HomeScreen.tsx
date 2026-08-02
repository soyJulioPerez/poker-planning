import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AVAILABLE_DECKS, AVAILABLE_ICON_GROUPS } from 'shared-contracts';
import { IconPicker } from '../ui/IconPicker';
import { useJoinRejectedReason, useMyName, useRoom, useRoomClient, useRoomInfo } from '../core/use-room-client';
import { RootStackParamList } from '../navigation/types';

type Mode = 'create' | 'join';

const SUBMIT_TIMEOUT_MS = 10000;
const NONE_ICON_GROUP_ID = 'none';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation, route }: Props) {
  const client = useRoomClient();
  const room = useRoom();
  const [myName, setMyName] = useMyName();
  const joinRejectedReason = useJoinRejectedReason();
  const joinRoomInfo = useRoomInfo();

  const [mode, setMode] = useState<Mode>('join');
  const [moderatorName, setModeratorName] = useState('');
  const [deckId, setDeckId] = useState(AVAILABLE_DECKS[0].id);
  const [moderatorIsVoter, setModeratorIsVoter] = useState(true);
  const [moderatorIconGroupId, setModeratorIconGroupId] = useState(NONE_ICON_GROUP_ID);
  const [moderatorIcon, setModeratorIcon] = useState<string | null>(null);
  const [moderatorIconMissing, setModeratorIconMissing] = useState(false);

  const [joinRoomId, setJoinRoomId] = useState(route.params?.roomId ?? '');
  const [joinName, setJoinName] = useState('');
  const [joinIcon, setJoinIcon] = useState<string | null>(null);
  const [joinIconMissing, setJoinIconMissing] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitTimedOut, setSubmitTimedOut] = useState(false);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedModeratorIconGroup =
    AVAILABLE_ICON_GROUPS.find((group) => group.id === moderatorIconGroupId) ?? null;
  const joinIconGroup = joinRoomInfo?.iconGroupId
    ? AVAILABLE_ICON_GROUPS.find((group) => group.id === joinRoomInfo.iconGroupId) ?? null
    : null;

  useEffect(() => {
    if (room && myName) {
      client.saveSession(room.roomId, myName);
      navigation.replace('Room', { roomId: room.roomId });
    }
  }, [room, myName, client, navigation]);

  useEffect(() => {
    if (joinRejectedReason !== null) stopSubmitting();
  }, [joinRejectedReason]);

  useEffect(() => {
    const roomId = route.params?.roomId;
    if (roomId) {
      setMode('join');
      setJoinRoomId(roomId);
      fetchRoomInfoForJoin(roomId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startSubmitting(): void {
    setSubmitTimedOut(false);
    setIsSubmitting(true);
    submitTimeoutRef.current = setTimeout(() => {
      setIsSubmitting(false);
      setSubmitTimedOut(true);
    }, SUBMIT_TIMEOUT_MS);
  }

  function stopSubmitting(): void {
    if (submitTimeoutRef.current !== null) {
      clearTimeout(submitTimeoutRef.current);
      submitTimeoutRef.current = null;
    }
    setIsSubmitting(false);
  }

  function fetchRoomInfoForJoin(roomId: string): void {
    const trimmed = roomId.trim().toUpperCase();
    if (!trimmed) return;
    setJoinIcon(null);
    client.connect();
    client.send({ action: 'getRoomInfo', roomId: trimmed });
  }

  function createRoom(): void {
    if (!moderatorName.trim()) return;
    if (selectedModeratorIconGroup && !moderatorIcon) {
      setModeratorIconMissing(true);
      return;
    }
    setModeratorIconMissing(false);
    startSubmitting();
    setMyName(moderatorName.trim());
    client.connect();
    client.send({
      action: 'createRoom',
      moderatorName: moderatorName.trim(),
      deckId,
      moderatorIsVoter,
      ...(selectedModeratorIconGroup
        ? { iconGroupId: selectedModeratorIconGroup.id, icon: moderatorIcon ?? undefined }
        : {}),
    });
  }

  function joinRoom(): void {
    if (!joinRoomId.trim() || !joinName.trim()) return;
    if (joinIconGroup && !joinIcon) {
      setJoinIconMissing(true);
      return;
    }
    setJoinIconMissing(false);
    startSubmitting();
    setMyName(joinName.trim());
    client.connect();
    client.send({
      action: 'joinRoom',
      roomId: joinRoomId.trim().toUpperCase(),
      name: joinName.trim(),
      ...(joinIcon ? { icon: joinIcon } : {}),
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Planning Poker</Text>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, mode === 'join' && styles.tabActive]}
          onPress={() => setMode('join')}
        >
          <Text style={[styles.tabText, mode === 'join' && styles.tabTextActive]}>Unirse a sala</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'create' && styles.tabActive]}
          onPress={() => setMode('create')}
        >
          <Text style={[styles.tabText, mode === 'create' && styles.tabTextActive]}>Crear sala</Text>
        </TouchableOpacity>
      </View>

      {mode === 'join' ? (
        <View style={styles.form}>
          <Text style={styles.label}>Código de sala</Text>
          <TextInput
            style={styles.input}
            value={joinRoomId}
            autoCapitalize="characters"
            onChangeText={setJoinRoomId}
            onBlur={() => fetchRoomInfoForJoin(joinRoomId)}
          />

          <Text style={styles.label}>Tu nombre</Text>
          <TextInput style={styles.input} value={joinName} onChangeText={setJoinName} />

          {joinIconGroup ? (
            <View style={styles.iconPickerBlock}>
              <Text style={styles.label}>Elegí tu ícono</Text>
              <IconPicker iconGroup={joinIconGroup} selectedIcon={joinIcon} onSelect={setJoinIcon} />
              {joinIconMissing ? <Text style={styles.error}>Elegí un ícono para unirte a la sala.</Text> : null}
            </View>
          ) : null}

          {joinRejectedReason === 'name-taken' ? (
            <Text style={styles.error}>Ese nombre ya está en uso en esta sala.</Text>
          ) : null}
          {joinRejectedReason === 'room-not-found' ? (
            <Text style={styles.error}>No se encontró una sala con ese código.</Text>
          ) : null}
          {submitTimedOut ? <Text style={styles.error}>No se pudo conectar. Intentá de nuevo.</Text> : null}

          <TouchableOpacity style={styles.submitButton} disabled={isSubmitting} onPress={joinRoom}>
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Unirse</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>Tu nombre</Text>
          <TextInput style={styles.input} value={moderatorName} onChangeText={setModeratorName} />

          <Text style={styles.label}>Mazo de estimación</Text>
          <View style={styles.deckRow}>
            {AVAILABLE_DECKS.map((deck) => (
              <TouchableOpacity
                key={deck.id}
                style={[styles.deckOption, deckId === deck.id && styles.deckOptionSelected]}
                onPress={() => setDeckId(deck.id)}
              >
                <Text style={[styles.deckOptionText, deckId === deck.id && styles.deckOptionTextSelected]}>
                  {deck.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Quiero votar como moderador</Text>
            <Switch value={moderatorIsVoter} onValueChange={setModeratorIsVoter} />
          </View>

          <Text style={styles.label}>Grupo de íconos</Text>
          <View style={styles.deckRow}>
            <TouchableOpacity
              style={[styles.deckOption, moderatorIconGroupId === NONE_ICON_GROUP_ID && styles.deckOptionSelected]}
              onPress={() => {
                setModeratorIconGroupId(NONE_ICON_GROUP_ID);
                setModeratorIcon(null);
              }}
            >
              <Text
                style={[
                  styles.deckOptionText,
                  moderatorIconGroupId === NONE_ICON_GROUP_ID && styles.deckOptionTextSelected,
                ]}
              >
                Ninguno
              </Text>
            </TouchableOpacity>
            {AVAILABLE_ICON_GROUPS.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={[styles.deckOption, moderatorIconGroupId === group.id && styles.deckOptionSelected]}
                onPress={() => {
                  setModeratorIconGroupId(group.id);
                  setModeratorIcon(null);
                }}
              >
                <Text
                  style={[styles.deckOptionText, moderatorIconGroupId === group.id && styles.deckOptionTextSelected]}
                >
                  {group.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedModeratorIconGroup ? (
            <View style={styles.iconPickerBlock}>
              <Text style={styles.label}>Elegí tu ícono</Text>
              <IconPicker
                iconGroup={selectedModeratorIconGroup}
                selectedIcon={moderatorIcon}
                onSelect={(icon) => {
                  setModeratorIcon(icon);
                  setModeratorIconMissing(false);
                }}
              />
              {moderatorIconMissing ? (
                <Text style={styles.error}>Elegí un ícono para crear la sala.</Text>
              ) : null}
            </View>
          ) : null}

          {submitTimedOut ? <Text style={styles.error}>No se pudo conectar. Intentá de nuevo.</Text> : null}

          <TouchableOpacity style={styles.submitButton} disabled={isSubmitting} onPress={createRoom}>
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Crear sala</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  tabs: { flexDirection: 'row', marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#143055' },
  tabText: { textAlign: 'center', color: '#6b7280' },
  tabTextActive: { color: '#143055', fontWeight: '600' },
  form: { gap: 8 },
  label: { fontSize: 13, color: '#374151', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  deckRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deckOption: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deckOptionSelected: { backgroundColor: '#143055', borderColor: '#143055' },
  deckOptionText: { fontSize: 13, color: '#374151' },
  deckOptionTextSelected: { color: '#ffffff' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconPickerBlock: { marginTop: 8 },
  error: { color: '#b91c1c', fontSize: 13 },
  submitButton: {
    backgroundColor: '#143055',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: { color: '#ffffff', fontWeight: '600' },
});
