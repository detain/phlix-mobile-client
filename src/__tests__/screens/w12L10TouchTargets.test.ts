/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/screens/w12L10TouchTargets.test.ts
//
// MW-102 (review mobile__gameux Major-adjacent): destructive and mode
// controls BELOW the 44pt platform floor. Honest fs source-read pins
// (precedent: keyboardAndSkeleton suite) — this repo ships no layout
// renderer, so the pins hold the three laws each site needed: an accessible
// NAME on a destructive control, the slop/minHeight arithmetic that reaches
// 44pt, and button role + selected state on the connection-mode rail.

import * as fs from 'fs';
import * as path from 'path';

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../../', rel), 'utf8');

describe('collection item removal (MW-102)', () => {
  const source = read('src/screens/CollectionDetailScreen.tsx');

  it('the remove control is named to assistive tech', () => {
    expect(source).toContain('accessibilityLabel="Remove from collection"');
  });

  it('28pt ink + 8pt slop per side = 44pt effective', () => {
    const siteAt = source.indexOf('accessibilityLabel="Remove from collection"');
    expect(siteAt).toBeGreaterThan(-1);
    const window = source.slice(siteAt - 400, siteAt + 400);
    expect(window).toContain('hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}');
    expect(source).toMatch(/removeButton: \{[^}]*width: 28,[^}]*height: 28,/s);
  });
});

describe('blocked-tag removal (MW-102)', () => {
  const source = read('src/screens/ParentalControlsScreen.tsx');

  it('the × on a BLOCKING rule is named and widened 20pt + 2×12 = 44pt', () => {
    expect(source).toContain('accessibilityLabel="Remove blocked tag"');
    const siteAt = source.indexOf('accessibilityLabel="Remove blocked tag"');
    const window = source.slice(siteAt - 400, siteAt + 400);
    expect(window).toContain('hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}');
    expect(source).toMatch(/tagRemove: \{[^}]*width: 20,[^}]*height: 20,/s);
  });
});

describe('connection-mode rail (MW-102)', () => {
  const source = read('src/components/ServerSwitcher.tsx');

  it('both mode segments are announced as buttons with selected state', () => {
    const uses = source.split('accessibilityRole="button"').length - 1;
    expect(uses).toBe(2);
    expect(source).toContain(
      `accessibilityState={{ selected: connectionMode === 'direct' }}`
    );
    expect(source).toContain(
      `accessibilityState={{ selected: connectionMode === 'relay' }}`
    );
  });

  it('the rail itself clears 44pt (paddingVertical 13 on 13pt ink) + minHeight law', () => {
    expect(source).toMatch(/modeButton: \{[^}]*paddingVertical: 13,/s);
    expect(source).toMatch(/modeButton: \{[^}]*minHeight: 44,/s);
  });
});

describe('player pills clear the 44pt floor (MOB-28)', () => {
  it('Skip Intro/Outro pill carries minHeight 44 with centred ink', () => {
    const source = read('src/components/player/SkipButton.tsx');
    expect(source).toMatch(/button: \{[^}]*minHeight: 44,/s);
    expect(source).toMatch(/button: \{[^}]*justifyContent: 'center',/s);
  });

  it('running sleep-timer badge matches the 44pt top-bar row', () => {
    const source = read('src/components/player/SleepTimer.tsx');
    expect(source).toMatch(/displayBadge: \{[^}]*minHeight: 44,/s);
    expect(source).toMatch(/displayBadge: \{[^}]*justifyContent: 'center',/s);
    expect(source).toMatch(/displayBadge: \{[^}]*flexShrink: 0,/s);
  });
});

describe('skip-pill layer geometry rides the live insets (MOB-29)', () => {
  const source = read('src/screens/PlayerScreen.tsx');

  it('the skip layer is a plain View, not a self-measuring SafeAreaView', () => {
    expect(source).not.toMatch(/<SafeAreaView style=\{styles\.skipButtonsContainer\}/);
    expect(source).toContain('testID="skipButtonsLayer"');
  });

  it('crown and trailing edge come from insets.top / insets.right', () => {
    const siteAt = source.indexOf('testID="skipButtonsLayer"');
    expect(siteAt).toBeGreaterThan(-1);
    const window = source.slice(siteAt, siteAt + 300);
    expect(window).toContain('{ top: insets.top + 60, right: insets.right + 20 }');
  });
});
