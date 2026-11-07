/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/screens/playerWatchParty.test.ts
//
// MW-107 (review mobile__gameux #7, Info) + MW-117 (review mobile__gameux #2,
// Major) — renderer-free source pins per the SeekBar.test doctrine.
//
//  * Player chrome is a fullScreenModal over a hidden status bar with no
//    safe-area reads: the fixed 20pt paddings park the top bar under a notch
//    and the transport row under the home indicator, and in landscape the
//    cutout intrudes edge-side. useSafeAreaInsets is the rotation-aware
//    per-edge API — chrome must pad by the ACTIVE edge's inset (M-MOBILE-39
//    lesson: never assume the cutout sits at the top).
//  * The watch-party entry was a bare glyph inside the chrome that fades
//    away after 3s, and the in-group pill shared that gate — an active
//    member could not even see which room they were in while controls were
//    hidden. The entry glyph stays inside the chrome (it is an affordance),
//    but the in-group pill moves to an always-on layer, and MediaDetail
//    gets a labeled "Watch with friends" row so the feature is findable
//    BEFORE playback starts.

import * as fs from 'fs';
import * as path from 'path';

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../..', rel), 'utf8');

describe('MW-107 — player chrome pads by the live insets', () => {
  const source = read('src/screens/PlayerScreen.tsx');

  test('the screen reads the safe-area insets at all', () => {
    expect(source).toMatch(/useSafeAreaInsets\(\)/);
  });

  test('the top bar crowns itself by the TOP inset (not a fixed 20)', () => {
    expect(source).toMatch(/paddingTop: insets\.top \+ 8/);
    // Landscape: the notch lands on the leading/trailing edge instead.
    expect(source).toMatch(/paddingLeft: insets\.left \+ 20/);
    expect(source).toMatch(/paddingRight: insets\.right \+ 20/);
  });

  test('the bottom transport respects the BOTTOM inset', () => {
    // The rail keeps a 40pt floor but must rise with a real home indicator.
    expect(source).toMatch(/paddingBottom:[^\n]*insets\.bottom/);
  });
});

describe('MW-117 — watch-party entry survives the chrome fade', () => {
  const player = read('src/screens/PlayerScreen.tsx');

  test('the in-group pill lives on an always-on layer, outside the showControls gate', () => {
    expect(player).toMatch(/testID="syncPlayPillLayer"/);
    expect(player).toMatch(/\{currentGroup && \(/);
    // The old shape — the pill as the ternary branch of the fading top bar —
    // is gone; the chrome only keeps the entry glyph for signed-out-of-room
    // users.
    expect(player).not.toMatch(/currentGroup\s*\?\s*\(?\s*<SyncPlayOverlay/);
    expect(player).toMatch(/\{!currentGroup && \(/);
  });

  test('the pill carries a stable testID for e2e visibility', () => {
    expect(read('src/components/syncplay/SyncPlayOverlay.tsx')).toMatch(
      /testID="syncPlayPill"/
    );
  });

  test('MediaDetail offers a labeled watch-party entry before playback', () => {
    const detail = read('src/screens/MediaDetailScreen.tsx');
    expect(detail).toMatch(/Watch with friends/);
    expect(detail).toMatch(/<SyncPlayModal\s+visible=\{showWatchParty\}/);
    expect(detail).toMatch(/itemId=\{itemId\}/);
  });
});
