import { StyleSheet, Switch, Text, View } from 'react-native';
import { Participant } from 'shared-contracts';

interface ParticipantListProps {
  participants: Participant[];
  isModerator: boolean;
  canChangeVoterStatus: boolean;
  onModeratorIsVoterChange: (isVoter: boolean) => void;
}

export function ParticipantList({
  participants,
  isModerator,
  canChangeVoterStatus,
  onModeratorIsVoterChange,
}: ParticipantListProps) {
  return (
    <View>
      {participants.map((participant) => (
        <View
          key={participant.name}
          style={[styles.item, !participant.connected && styles.itemDisconnected]}
        >
          {participant.isModerator ? (
            // eslint-disable-next-line jsx-a11y/accessible-emoji -- regla pensada para <span> web; RN usa accessibilityLabel/Role
            <Text style={styles.badge} accessibilityLabel="Moderador" accessibilityRole="image">
              🧙
            </Text>
          ) : null}
          {participant.icon ? <Text style={styles.icon}>{participant.icon}</Text> : null}
          <Text style={styles.name}>{participant.name}</Text>
          {participant.isModerator ? (
            <View style={styles.voterSwitch}>
              <Text style={styles.voterSwitchLabel}>{participant.isVoter ? 'Vota' : 'No vota'}</Text>
              <Switch
                value={participant.isVoter}
                disabled={!isModerator || !canChangeVoterStatus}
                onValueChange={onModeratorIsVoterChange}
              />
            </View>
          ) : null}
          {!participant.connected ? (
            <Text style={styles.status}>desconectado</Text>
          ) : participant.isVoter ? (
            <Text style={[styles.status, participant.vote !== null && styles.statusVoted]}>
              {participant.vote !== null ? '✓ votó' : '⏳ esperando voto'}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  itemDisconnected: {
    opacity: 0.5,
  },
  badge: {
    fontSize: 16,
  },
  icon: {
    fontSize: 16,
  },
  name: {
    flex: 1,
    fontSize: 15,
  },
  voterSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voterSwitchLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  status: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusVoted: {
    color: '#0f7a3d',
  },
});
