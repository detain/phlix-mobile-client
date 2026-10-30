/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/syncplay/SyncPlayOverlay.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSyncplayStore } from '../../store/syncplayStore';
import { TEXT_MAX_FONT_SIZE_MULTIPLIER } from '../../utils/textScalePolicy';

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
        {/* M-MOBILE-45 (review mobile__gameux m11): the pill rides a fixed
            row in the player chrome — bounded growth, never squashed-out. */}
        <Text style={styles.icon} maxFontSizeMultiplier={TEXT_MAX_FONT_SIZE_MULTIPLIER}>👥</Text>
        <View style={styles.info}>
          {/* M-MOBILE-14: the room name is the bar's ONLY unbounded string
              (server-authored). It already truncates (numberOfLines 1 under a
              maxWidth cap), so the full title never reaches the layout —
              announce it to screen readers instead, the accessible-name
              pattern for a truncated label. */}
          <Text
            style={styles.roomName}
            numberOfLines={1}
            accessibilityLabel={currentGroup.name}
            maxFontSizeMultiplier={TEXT_MAX_FONT_SIZE_MULTIPLIER}
          >
            {currentGroup.name}
          </Text>
          <Text style={styles.memberCount} maxFontSizeMultiplier={TEXT_MAX_FONT_SIZE_MULTIPLIER}>
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
    // M-MOBILE-14: lives in the player top bar cluster — never squish below
    // its content (the room name truncates under its own maxWidth instead).
    flexShrink: 0,
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
    fontSize: 12,
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