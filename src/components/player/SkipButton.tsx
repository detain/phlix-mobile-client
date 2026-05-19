// src/components/player/SkipButton.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

export type SkipType = 'intro' | 'outro';

interface SkipMarkerRange {
  start: number;
  end: number;
}

interface SkipButtonProps {
  type: SkipType;
  marker: SkipMarkerRange | null;
  currentTime: number;
  onSkip: (endPosition: number) => void;
}

/**
 * Shows "Skip Intro" or "Skip Outro" button when playback enters the marker range.
 * Automatically hides when position is outside the marker range or marker is null.
 */
export const SkipButton: React.FC<SkipButtonProps> = ({
  type,
  marker,
  currentTime,
  onSkip,
}) => {
  if (marker === null) {
    return null;
  }

  const isInRange = currentTime >= marker.start && currentTime <= marker.end;

  if (!isInRange) {
    return null;
  }

  const label = type === 'intro' ? 'Skip Intro' : 'Skip Outro';
  const endPosition = type === 'intro' ? marker.end : marker.end;

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => onSkip(endPosition)}
      accessibilityLabel={label}
      accessibilityHint={`Tap to skip ${type}`}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SkipButton;
