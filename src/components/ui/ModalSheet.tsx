/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/ui/ModalSheet.tsx
//
// MW-116 (review mobile__gameux #1 + mobile__crossfe #6): six modal sheets —
// the SyncPlay room panel, Hub sign-in, collection create, profile editor +
// PIN, passkey rename, and the admin user form — place their TextInputs with
// NO keyboard avoidance, so the keyboard buries the focused field (and its
// submit button) exactly when the user needs them. The repo already knew
// better ONCE (M-MOBILE-47: the Search filter sheet wraps its body in a
// KeyboardAvoidingView) but the lesson never spread — every later sheet
// re-forgot it. This component makes the law single-source: a sheet rendered
// through it structurally cannot forget.
//
// behavior="padding" on BOTH platforms is repo modal law, not an oversight:
// inside a transparent <Modal>, Android's adjustResize never applies to the
// dialog window, so 'height' is the snapping variant (SearchScreen
// M-MOBILE-47 comment). The sheet FILLS its dismiss overlay (flex:1) and
// reproduces the overlay's alignment, so the wrapped card lays out exactly
// as before — only now the keyboard is dodged.

import React from 'react';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** MOB-11: the sheet card's own bottom padding (its pre-existing floor). */
export const SHEET_BOTTOM_FLOOR = 20;

/**
 * MOB-11: insets-aware floor for bottom-anchored sheets — max(20, insets.bottom)
 * so the last row clears the home-indicator / gesture strip. Single cure point:
 * every bottom sheet card applies this as `paddingBottom`. The safe-area
 * provider propagates through RN Modal.
 */
export function useSheetBottomPad(): number {
  const insets = useSafeAreaInsets();
  return Math.max(SHEET_BOTTOM_FLOOR, insets.bottom);
}

interface ModalSheetProps {
  children: React.ReactNode;
  /** Centered dialog (default); false = bottom-anchored sheet. */
  centered?: boolean;
}

const ModalSheet: React.FC<ModalSheetProps> = ({ children, centered = true }) => (
  <KeyboardAvoidingView
    behavior="padding"
    style={[styles.sheet, !centered && styles.sheetBottom]}
  >
    {children}
  </KeyboardAvoidingView>
);

const styles = StyleSheet.create({
  sheet: {
    // Fills the transparent overlay so the keyboard padding pushes inside it…
    flex: 1,
    width: '100%',
    // …while reproducing the overlay's centering, so the card's percentage
    // widths resolve against the same definite width they had before.
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetBottom: {
    // The bottom-sheet variant (SyncPlay): anchor to the floor, stretch.
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
});

export { ModalSheet };
export default ModalSheet;
