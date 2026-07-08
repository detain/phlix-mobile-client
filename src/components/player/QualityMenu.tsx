/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/components/player/QualityMenu.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type { QualitySelection } from '@phlix/contracts';
import type { QualityOption } from './quality';

interface QualityMenuProps {
  visible: boolean;
  /** Selectable rows — `Auto` first, then pinnable rungs (highest-first). */
  options: QualityOption[];
  /** The currently active choice (`'auto'` or a rung id). */
  selected: QualitySelection;
  /** Called with the chosen value; the caller persists + swaps the stream. */
  onSelect: (value: QualitySelection) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet quality picker for the native player (G3). Lets the viewer pick
 * `Auto` (native ABR on the multi-variant master) or pin a specific rung (that
 * rung's own `media_v{id}.m3u8`). Consumes the shared `@phlix/contracts`
 * rendition shape via the pure `quality.ts` helpers — no local ladder model.
 *
 * The caller only mounts/opens this when `options.length > 1`, so it always has
 * a real choice to offer (it degrades to nothing on a legacy/pre-ABR server).
 */
export const QualityMenu: React.FC<QualityMenuProps> = ({
  visible,
  options,
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
            <Text style={styles.title}>Quality</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close quality menu">
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list}>
            {options.map((option) => {
              const isSelected = option.value === selected;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={styles.row}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={option.label}
                >
                  <Text style={styles.rowText}>
                    {option.label} {isSelected ? '✓' : ''}
                  </Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  rowText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default QualityMenu;
