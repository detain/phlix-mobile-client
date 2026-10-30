/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/ui/LocalPlaceholder.tsx
//
// M-MOBILE-42 (review mobile__crossfe): the offline-honest poster/photo
// placeholder. Where a card used to fall back to a third-party placeholder
// web service (a remote call per missing image), the surface now stays
// local: brand-dark tile + a per-kind glyph. No network, no bitmap asset,
// no layout size — the CALLER supplies the same width/height it would have
// given the Image, so rows never reflow.

import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

interface LocalPlaceholderProps {
  /** Same box the replaced <Image> occupied. */
  style?: StyleProp<ViewStyle>;
  /** Glyph hint: what kind of media is missing. */
  kind?: 'poster' | 'photo';
}

const GLYPH: Record<NonNullable<LocalPlaceholderProps['kind']>, string> = {
  poster: '🎬',
  photo: '🖼️',
};

export const LocalPlaceholder: React.FC<LocalPlaceholderProps> = ({
  style,
  kind = 'poster',
}) => (
  <View style={[styles.tile, style]} accessibilityLabel="No preview available">
    <Text style={styles.glyph} accessibilityElementsHidden>
      {GLYPH[kind]}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  tile: {
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 28,
    opacity: 0.55,
  },
});
