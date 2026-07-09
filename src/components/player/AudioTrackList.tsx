/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/components/player/AudioTrackList.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type { StreamAudioTrack } from '@phlix/contracts';

interface AudioTrackListProps {
  visible: boolean;
  /** Selectable audio tracks. */
  tracks: StreamAudioTrack[];
  /** The currently active track id (null = no track selected / audio off). */
  selected: string | null;
  /** Called with the chosen track id; the caller persists + swaps the stream. */
  onSelect: (trackId: string) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet audio track picker for the native player. Displays
 * `StreamAudioTrack[]` with language, codec, channel count, and bitrate.
 * Uses BCP 47 language tags from the server's `bc_p47_language` column.
 */
export const AudioTrackList: React.FC<AudioTrackListProps> = ({
  visible,
  tracks,
  selected,
  onSelect,
  onClose,
}) => {
  const formatChannels = (channels: number): string => {
    if (channels === 1) return 'Mono';
    if (channels === 2) return 'Stereo';
    return `${channels} ch`;
  };

  const formatBitrate = (bitrate?: number): string => {
    if (!bitrate) return '';
    if (bitrate >= 1000000) return `${(bitrate / 1000000).toFixed(1)} Mbps`;
    if (bitrate >= 1000) return `${(bitrate / 1000).toFixed(0)} kbps`;
    return `${bitrate} bps`;
  };

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
            <Text style={styles.title}>Audio</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close audio menu">
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list}>
            {tracks.length === 0 && (
              <Text style={styles.emptyText}>No audio tracks available</Text>
            )}
            {tracks.map((track) => {
              const isSelected = track.id === selected;
              const bitrateStr = formatBitrate(track.bitrate);
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
                  accessibilityLabel={`${track.title || track.language} ${formatChannels(track.channels)} ${bitrateStr}`}
                >
                  <View style={styles.rowContent}>
                    <Text style={styles.rowText}>
                      {track.title || track.language}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {[track.codec, formatChannels(track.channels), bitrateStr]
                        .filter(Boolean)
                        .join(' • ')}
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
  rowText: {
    color: '#fff',
    fontSize: 16,
  },
  rowMeta: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  checkmark: {
    color: '#0066cc',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default AudioTrackList;
