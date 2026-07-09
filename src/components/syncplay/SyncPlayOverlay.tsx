/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/components/syncplay/SyncPlayOverlay.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSyncplayStore } from '../../store/syncplayStore';

interface SyncPlayOverlayProps {
  onPress: () => void;
}

/**
 * SyncPlayOverlay - Shows when user is in a SyncPlay room
 * Displays room name, member count, and sync status indicator
 */
const SyncPlayOverlay: React.FC<SyncPlayOverlayProps> = ({ onPress }) => {
  const currentGroup = useSyncplayStore((state) => state.currentGroup);
  const timeSyncStable = useSyncplayStore((state) => state.timeSyncStable);

  if (!currentGroup) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      accessibilityLabel="Open SyncPlay"
      accessibilityRole="button"
    >
      <View style={styles.content}>
        <Text style={styles.icon}>👥</Text>
        <View style={styles.info}>
          <Text style={styles.roomName} numberOfLines={1}>
            {currentGroup.name}
          </Text>
          <Text style={styles.memberCount}>
            {currentGroup.members.length} member{currentGroup.members.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View
          style={[
            styles.syncDot,
            timeSyncStable ? styles.syncStable : styles.syncUnstable,
          ]}
          accessibilityLabel={timeSyncStable ? 'Sync stable' : 'Sync unstable'}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,102,204,0.8)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 80,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  info: {
    flexDirection: 'column',
  },
  roomName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 100,
  },
  memberCount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 4,
  },
  syncStable: {
    backgroundColor: '#00cc66',
  },
  syncUnstable: {
    backgroundColor: '#ff9500',
  },
});

export default SyncPlayOverlay;