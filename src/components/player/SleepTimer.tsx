/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/player/SleepTimer.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

const PRESET_MINUTES = [15, 30, 45, 60, 90, 120];

interface SleepTimerProps {
  visible: boolean;
  /** Called when the user picks a duration (minutes > 0) or cancels (minutes = 0). */
  onSelect: (minutes: number) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet sleep-timer picker. Shows preset durations and an active
 * countdown when a timer is running. Honors `onClose` to dismiss without
 * changing the timer.
 */
export const SleepTimerMenu: React.FC<SleepTimerProps> = ({
  visible,
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
            <Text style={styles.title}>Sleep Timer</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close sleep timer">
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.presetGrid}>
            {PRESET_MINUTES.map((minutes) => (
              <TouchableOpacity
                key={minutes}
                style={styles.presetButton}
                onPress={() => {
                  onSelect(minutes);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel={`Set sleep timer for ${minutes} minutes`}
              >
                <Text style={styles.presetText}>{minutes}m</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              onSelect(0);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Cancel sleep timer"
          >
            <Text style={styles.cancelText}>Cancel Timer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

interface SleepTimerDisplayProps {
  remainingSeconds: number;
  onPress: () => void;
}

/**
 * Compact inline display of the running sleep-timer countdown.
 * Rendered in the player's top bar. Hidden when `remainingSeconds <= 0`.
 */
export const SleepTimerDisplay: React.FC<SleepTimerDisplayProps> = ({
  remainingSeconds,
  onPress,
}) => {
  if (remainingSeconds <= 0) return null;

  const mm = Math.floor(remainingSeconds / 60);
  const ss = remainingSeconds % 60;
  const label = `${mm}:${ss.toString().padStart(2, '0')}`;

  return (
    <TouchableOpacity
      style={styles.displayBadge}
      onPress={onPress}
      accessibilityLabel={`Sleep timer: ${label} remaining. Tap to change.`}
    >
      <Text style={styles.displayBadgeText}>🌙 {label}</Text>
    </TouchableOpacity>
  );
};

/** Hook: manages sleep-timer countdown, calls `onFire` when it expires. */
export const useSleepTimer = (onFire: () => void) => {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear timer helper
  const clearTimer = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRemainingSeconds(0);
  };

  const startTimer = (minutes: number) => {
    clearTimer();
    if (minutes <= 0) {
      onFire();
      return;
    }
    const total = minutes * 60;
    setRemainingSeconds(total);
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearTimer();
          onFire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { remainingSeconds, startTimer, clearTimer };
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  presetButton: {
    width: '30%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
  },
  presetText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#3d1a1a',
    alignItems: 'center',
  },
  cancelText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
  },
  displayBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  displayBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default SleepTimerMenu;
