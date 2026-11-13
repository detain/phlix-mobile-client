/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/screens/safeAreaEdges.test.ts
//
// MW-105 (review mobile__gameux #6): root-stack screens render WITHOUT the
// tab bar, and M-MOBILE-36 only grew the TAB BAR for the home indicator —
// so a stack screen that keeps the SafeContainer top-only default parks its
// last row under the 34pt gesture strip. Stack screens must opt into
// STACK_EDGES; tab screens must NOT (the bar already carries the inset —
// doing both double-pads). Renderer-free source pins per the SeekBar.test
// doctrine.

import * as fs from 'fs';
import * as path from 'path';

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../..', rel), 'utf8');

describe('MW-105 — bottom safe-area opt-in on stack screens', () => {
  test('SafeContainer exports STACK_EDGES covering top AND bottom', () => {
    expect(read('src/components/layout/SafeContainer.tsx')).toMatch(
      /export const STACK_EDGES[\s\S]{0,80}\[[^\]]*'top'[^\]]*'bottom'[^\]]*\]/
    );
    // Reachable through the layout barrel the screens already import from.
    expect(read('src/components/layout/index.ts')).toMatch(/STACK_EDGES/);
  });

  test('ProfileSelectScreen (named victim: the CTA parked under the home indicator) opts in', () => {
    const source = read('src/screens/ProfileSelectScreen.tsx');
    expect(source).toMatch(/STACK_EDGES/);
    expect(source).toMatch(/edges=\{STACK_EDGES\}/);
  });

  const tabScreens = [
    'src/screens/HomeScreen.tsx',
    'src/screens/SearchScreen.tsx',
    'src/screens/LibraryScreen.tsx',
    'src/screens/DownloadsScreen.tsx',
    'src/screens/SettingsScreen.tsx',
  ];

  test.each(tabScreens)('tab-bar screen %s never pads the bottom twice', (rel) => {
    expect(read(rel)).not.toMatch(/edges=\{(?:\[[^\]]*bottom[^\]]*\]|STACK_EDGES)/);
  });
});

describe('MOB-54 — SafeContainer pads landscape horizontal cutouts', () => {
  const src = read('src/components/layout/SafeContainer.tsx');

  test('reads window dimensions to detect landscape', () => {
    expect(src).toMatch(/useWindowDimensions/);
    expect(src).toMatch(/isLandscape\s*=\s*width\s*>\s*height/);
  });

  test('left/right insets apply in landscape regardless of edges', () => {
    expect(src).toMatch(/paddingLeft:\s*isLandscape \|\| edges\.includes\('left'\)/);
    expect(src).toMatch(/paddingRight:\s*isLandscape \|\| edges\.includes\('right'\)/);
  });

  test('player chrome (MW-107 geometry) does not route through SafeContainer', () => {
    expect(read('src/screens/PlayerScreen.tsx')).not.toMatch(/SafeContainer/);
  });
});

describe('MOB-11 — bottom-anchored sheets floor at max(20, insets.bottom)', () => {
  test('ModalSheet is the single cure point (hook over safe-area insets)', () => {
    const src = read('src/components/ui/ModalSheet.tsx');
    expect(src).toMatch(/useSafeAreaInsets/);
    expect(src).toMatch(/Math\.max\(SHEET_BOTTOM_FLOOR,\s*insets\.bottom\)/);
    expect(src).toMatch(/SHEET_BOTTOM_FLOOR\s*=\s*20/);
  });

  test.each([
    'src/components/syncplay/SyncPlayModal.tsx',
    'src/components/player/QualityMenu.tsx',
    'src/components/player/SubtitleTrackList.tsx',
    'src/components/player/AudioTrackList.tsx',
    'src/components/player/SleepTimer.tsx',
  ])('%s applies the insets-aware floor to its sheet card', (rel) => {
    const src = read(rel);
    expect(src).toMatch(/useSheetBottomPad/);
    expect(src).toMatch(/const sheetBottomPad = useSheetBottomPad\(\)/);
    expect(src).toMatch(/paddingBottom:\s*sheetBottomPad/);
  });
});
