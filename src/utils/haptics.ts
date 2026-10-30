/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/haptics.ts
//
// M-MOBILE-40 (review mobile__gameux m6): zero haptic feedback app-wide —
// destructive confirms, long-press-delete starts, tab switches and SyncPlay
// joins were silent, where the RN convention is a light/medium impact.
//
// VENUE LAW (why this is not expo-haptics): the repo is BARE React Native
// and `ios/Podfile.lock` is deliberately committed with pinned pods —
// W-min57 (M-MOBILE-09) restored exactly that pin to stop every caret pod
// floating, and the lock may only move through a real macOS `pod install`.
// A NEW native pod (expo-haptics / react-native-haptic-feedback) would
// desync the committed lock from what CI resolves on every build. This
// module therefore rides RN core `Vibration`, which is already compiled in:
//
//   * Android — real tactile pulse: the platform has no named impact
//     generators, so the idiom is a short vibration, timed per kind.
//   * iOS — honest no-op. Vibration.vibrate() cannot fire on iOS (the
//     private haptics selector RN does not touch). Tactile impact on iOS
//     is deferred to a native-module wave that can regenerate Podfile.lock
//     on macOS in the same change — disclosed, never pretended.
//
// Every call site goes through this wrapper so the seam is swappable: when
// the pod wave lands, only this file changes.

import { Platform, Vibration } from 'react-native';

/** The three impact weights the review's convention calls for. */
export type HapticKind = 'light' | 'medium' | 'destructive';

/**
 * Android pulse length per kind (ms). Kept short on purpose: the platform
 * guideline for UI feedback is a tap, not an alarm. `destructive` is a
 * double-tap pattern so it reads differently without looking like an error.
 */
export const HAPTIC_PATTERNS_MS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 16,
  destructive: [24, 40, 24],
};

/**
 * Fire one haptic. NEVER throws: a missing/unavailable vibration binding is
 * a degraded-feedback situation, never a reason to break the interaction
 * that asked for it (the long-press that starts a delete must still start
 * the delete if the motor call fails).
 */
export function fireHaptic(kind: HapticKind): void {
  if (Platform.OS !== 'android') {
    return; // iOS: no-op by the venue law in the header.
  }
  try {
    Vibration.vibrate(HAPTIC_PATTERNS_MS[kind]);
  } catch {
    // Swallowed by design — see NEVER throws above.
  }
}
