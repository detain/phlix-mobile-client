/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/ui/ContentSkeleton.tsx
//
// M-MOBILE-43 (review mobile__gameux m9): cold loads replaced the screen
// with a lone centered spinner — the app read slow even when data arrived
// fast, because the user saw nothing shaped like the content on its way.
// (The other half of the review's ask — previous-content HOLD across
// re-fetches — already shipped under M-MOBILE-17: loaders set the full
// loading state only while there is nothing to show.)
//
// These are layout-shaped placeholders: they pulse in the SHAPE of what is
// coming (detail hero + poster + rails, grid rows), so the first paint
// communicates the page structure. RN core `Animated` only — no new pod,
// per the W-min57 Podfile.lock law the haptics module documents.
//
// Honesty rule: a skeleton is a shape, never fake data — no counts, no
// titles, no durations.

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';

interface SkeletonBoxProps {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: ViewStyle;
}

/**
 * One pulsing block. The loop is created per instance and cancelled on
 * unmount (an orphaned Animation loop is a timer leak on every fast
 * navigation burst).
 */
const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  width,
  height,
  radius = 8,
  style,
}) => {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.75,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      style={[
        styles.box,
        { width: width ?? '100%', height, borderRadius: radius },
        { opacity: pulse },
        style,
      ]}
    />
  );
};

/**
 * MediaDetail cold-load shape: 300pt hero band, poster + title/meta row,
 * then three content rails. Mirrors MediaDetailScreen's real proportions
 * (hero height 300, poster 35% width, 20pt gutters).
 */
export const DetailSkeleton: React.FC = () => (
  <View style={styles.container} accessibilityLabel="Loading details">
    <SkeletonBox height={300} radius={0} />
    <View style={styles.infoRow}>
      <SkeletonBox width="35%" height={158} />
      <View style={styles.infoStack}>
        <SkeletonBox height={22} width="80%" radius={6} />
        <SkeletonBox height={14} width="55%" radius={6} style={styles.gap8} />
        <SkeletonBox height={14} width="65%" radius={6} style={styles.gap8} />
        <SkeletonBox height={44} width="60%" radius={12} style={styles.gap16} />
      </View>
    </View>
    <View style={styles.rail}>
      <SkeletonBox height={18} width="40%" radius={6} />
      <View style={styles.railRow}>
        <SkeletonBox width={110} height={165} />
        <SkeletonBox width={110} height={165} style={styles.gap12} />
        <SkeletonBox width={110} height={165} style={styles.gap12} />
      </View>
    </View>
  </View>
);

/**
 * Grid cold-load shape (Search first query, Home rails): rows of two
 * poster cards, matching MediaCard's 2-up footprint at a typical phone
 * width. `rows` keeps it cheap on short viewports.
 */
export const GridSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <View style={styles.container} accessibilityLabel="Loading results">
    {Array.from({ length: rows }, (_, row) => (
      <View key={row} style={styles.railRow}>
        <SkeletonBox width="47%" height={200} />
        <SkeletonBox width="47%" height={200} />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  box: {
    backgroundColor: '#2d2d44',
  },
  infoRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -40,
    alignItems: 'flex-start',
  },
  infoStack: {
    flex: 1,
    paddingLeft: 16,
    paddingTop: 8,
  },
  rail: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  railRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  gap8: { marginTop: 8 },
  gap12: { marginLeft: 12 },
  gap16: { marginTop: 16 },
});
