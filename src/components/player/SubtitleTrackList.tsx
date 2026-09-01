/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/player/SubtitleTrackList.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type { SubtitleTrack } from '../../types/playback';

interface SubtitleTrackListProps {
  visible: boolean;
  /**
   * Selectable subtitle tracks — the playback-info WIRE shape (contracts
   * playback.ts `SubtitleTrack`, S404 ruling). S407: this picker previously
   * typed the `Stream*` DB mirror and read `title`/`isForced`/`isDefault` —
   * keys the subtitle wire NEVER emits (no forced/default concept; the
   * display string is `label`, the only flag is `hearing_impaired`).
   */
  tracks: SubtitleTrack[];
  /** The currently active track id (null = subtitles off). */
  selected: string | null;
  /** Called with the chosen track id; the caller persists + swaps the stream. */
  onSelect: (trackId: string | null) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet subtitle track picker for the native player. Displays wire
 * `SubtitleTrack[]` rows by their server-derived `label`, with codec and a
 * hearing-impaired badge — the honest subset of what the playback-info wire
 * actually emits (S404 ruling: there is no forced/default concept on subtitle
 * rows; the old FORCED/DEFAULT badges read DB-mirror fiction keys).
 * Includes an "Off" option at the top to disable subtitles.
 */
export const SubtitleTrackList: React.FC<SubtitleTrackListProps> = ({
  visible,
  tracks,
  selected,
  onSelect,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Subtitles</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close subtitles menu">
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list}>
            {/* Off option — null means subtitles disabled */}
            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                onSelect(null);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === null }}
              accessibilityLabel="Subtitles off"
            >
              <Text style={styles.rowText}>Off</Text>
              {selected === null && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>

            {tracks.length === 0 && (
              <Text style={styles.emptyText}>No subtitle tracks available</Text>
            )}
            {tracks.map((track) => {
              const isSelected = track.id === selected;
              return (
                <TouchableOpacity
                  key={track.id}
                  style={styles.row}
                  onPress={() => {
                    onSelect(track.id);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${track.label}${track.hearing_impaired ? ' hearing impaired' : ''}`}
                >
                  <View style={styles.rowContent}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowText}>
                        {track.label}
                      </Text>
                      <View style={styles.badges}>
                        {track.hearing_impaired && (
                          <View style={styles.badgeHearingImpaired}>
                            <Text style={styles.badgeText}>HI</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={styles.rowMeta}>
                      {track.codec}
                    </Text>
                  </View>
                  {isSelected && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  content: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  closeText: {
    color: '#fff',
    fontSize: 20,
  },
  list: {
    maxHeight: 300,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  rowContent: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  rowText: {
    color: '#fff',
    fontSize: 16,
  },
  rowMeta: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: 4,
  },
  badgeHearingImpaired: {
    backgroundColor: '#1a3d5a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  checkmark: {
    color: '#0066cc',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default SubtitleTrackList;
