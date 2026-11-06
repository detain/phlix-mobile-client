/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/screens/w04L4StructuralPins.test.ts
//
// Source-read pins (wmin61UiPins.test.ts precedent) for the two MW-lane items
// whose law is STRUCTURAL — no @testing-library/renderHook infra exists in
// this repo (and inventing it for one pin would mean a dependency this wave
// must not add), so the fix's shape is pinned against the real sources:
//
// - MW-014 (review mobile__crossfe): the screens must type their routes from
//   the GLOBAL param lists in src/types/navigation.ts; the private twins
//   (PlayerRouteParams / DetailRouteParams) are retired for good.
// - MW-015 (review mobile__crossfe): the sleep-timer tick must be a PURE
//   decrement and the terminal handling (clear + fire) must live in the
//   transition effect — side effects inside a setState updater double-fire
//   under React 19 StrictMode (dev), dispatching the pause twice.

import fs from 'fs';
import path from 'path';

const read = (...parts: string[]): string =>
  fs.readFileSync(path.resolve(__dirname, '..', '..', ...parts), 'utf8');

describe('MW-014 — route params ride the global RootStackParamList', () => {
  const player = read('screens', 'PlayerScreen.tsx');
  const detail = read('screens', 'MediaDetailScreen.tsx');

  it('PlayerScreen types its route via RouteProp<RootStackParamList, "Player">', () => {
    expect(player).toContain("useRoute<RouteProp<RootStackParamList, 'Player'>>");
    expect(player).toContain("from '../types/navigation'");
  });

  it('the local PlayerRouteParams twin is retired (and its replace() site moved)', () => {
    expect(player).not.toMatch(/\bPlayerRouteParams\b/);
    // The second historic consumer — the episode-advance replace() cast —
    // now speaks the global list too.
    expect(player).toContain("RootStackParamList['Player']");
  });

  it('MediaDetailScreen derives its route from the Home|Library stacks union it mounts on', () => {
    // Registered twice in RootNavigator.tsx (:144 Home stack, :166 Library
    // stack); SearchStackParamList also declares MediaDetail but never
    // mounts this screen, so it is NOT part of the pin.
    expect(detail).toContain(
      "RouteProp<HomeStackParamList | LibraryStackParamList, 'MediaDetail'>"
    );
    expect(detail).not.toMatch(/\bDetailRouteParams\b/);
  });

  it('the single global declarations still carry the shapes (Player + MediaDetail)', () => {
    const nav = read('types', 'navigation.ts');
    expect(nav).toContain('Player: {');
    expect(nav).toContain("MediaDetail: { itemId: string };");
  });
});

describe('MW-015 — sleep-timer terminal arm lives outside the state updater', () => {
  const sleep = read('components', 'player', 'SleepTimer.tsx');

  // Slice out the interval callback body (from the handle assignment to the
  // 1000 ms close) — the region whose purity is the law.
  const tick = sleep.match(/intervalRef\.current = setInterval\(\(\) => \{([\s\S]*?)\}, 1000\);/);

  it('the tick is a PURE decrement updater', () => {
    expect(tick).not.toBeNull();
    expect(tick![1]).toContain('Math.max(0, prev - 1)');
  });

  it('no clearTimer/onFire side effect survives inside the updater', () => {
    expect(tick![1]).not.toContain('clearTimer');
    expect(tick![1]).not.toContain('onFire');
  });

  it('the terminal arm is a transition effect guarded by the still-armed handle', () => {
    // The guard is what separates EXPIRY (fire) from explicit cancel
    // (clearTimer has already nullled intervalRef) — pinned by shape.
    expect(sleep).toMatch(
      /if \(remainingSeconds === 0 && intervalRef\.current !== null\)/
    );
    expect(sleep).toMatch(/clearInterval\(intervalRef\.current\);\s*\n\s*intervalRef\.current = null;\s*\n\s*onFire\(\);/);
  });
});
