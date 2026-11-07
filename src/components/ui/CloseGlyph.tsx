/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/ui/CloseGlyph.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { TEXT_MAX_FONT_SIZE_MULTIPLIER } from '../../utils/textScalePolicy';

interface CloseGlyphProps {
  onPress: () => void;
  /** REQUIRED on purpose (MW-103): a close control that announces nothing
   * is the bug this component exists to end. Every prior call site shipped
   * a bare `✕` — invisible to screen readers, and the glyph box was the
   * only touch region. */
  accessibilityLabel: string;
  /** Ink color only; defaults to the chrome white used by every menu. */
  color?: string;
}

/**
 * CloseGlyph — the repo's canonical modal-dismiss control (MW-103, review
 * mobile__gameux #4 / the M-MOBILE-46 touch-target family).
 *
 * The `✕` glyph renders at 20pt (≈24pt line box) and the hitSlop widens
 * the touch region 10pt per side → 44pt effective, the platform floor,
 * with zero layout change. `role="button"` plus the mandatory label give it
 * an accessible name, and the glyph text is bounded by the shared
 * TEXT_MAX_FONT_SIZE_MULTIPLIER so a large-text device grows the ink
 * inside the slop-widened region instead of overflowing the header row.
 */
export const CloseGlyph: React.FC<CloseGlyphProps> = ({
  onPress,
  accessibilityLabel,
  color = '#fff',
}) => (
  <TouchableOpacity
    style={styles.wrap}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  >
    <Text
      style={[styles.glyph, { color }]}
      maxFontSizeMultiplier={TEXT_MAX_FONT_SIZE_MULTIPLIER}
    >
      ✕
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  wrap: {
    // No padding: the slop carries the touch enlargement so headers keep
    // their exact ink geometry (the old wrappers had none or a stray 4).
    alignSelf: 'flex-start',
  },
  glyph: {
    fontSize: 20,
    lineHeight: 24,
  },
});

export default CloseGlyph;
