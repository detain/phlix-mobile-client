/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/utils/textScalePolicy.test.ts
//
// M-MOBILE-45 (review mobile__gameux m11): sub-12 text existed in ten styles
// and no font-scaling policy existed at all — OS large text blew past the
// fixed chrome while normal users still read 10pt. Two laws: a FLOOR every
// scanned style must meet, and a CEILING installed app-wide on import.

import * as fs from 'fs';
import * as path from 'path';

import {
  MIN_FONT_SIZE_PT,
  TEXT_MAX_FONT_SIZE_MULTIPLIER,
  META_TEXT_COLOR,
  MIN_META_CONTRAST_RATIO,
  MIN_PLACEHOLDER_CONTRAST_RATIO,
  contrastRatio,
} from '../../utils/textScalePolicy';

const SRC = path.resolve(__dirname, '../../');

function listStyleFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listStyleFiles(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('M-MOBILE-45 floor law', () => {
  test('the floor is 12pt (platform minimum the review names)', () => {
    expect(MIN_FONT_SIZE_PT).toBe(12);
  });

  test('no fontSize in src/ rides below the floor', () => {
    const offenders: string[] = [];
    for (const file of listStyleFiles(SRC)) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const match = /fontSize:\s*(\d+(?:\.\d+)?)/.exec(line);
        if (match && Number.parseFloat(match[1]) < MIN_FONT_SIZE_PT) {
          offenders.push(`${path.relative(SRC, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe('M-MOBILE-45 ceiling law (prop-level on fixed-height chrome)', () => {
  const read = (rel: string) =>
    fs.readFileSync(path.resolve(SRC, '..', rel), 'utf8');

  test('the multiplier is bounded at 1.5', () => {
    expect(TEXT_MAX_FONT_SIZE_MULTIPLIER).toBe(1.5);
  });

  test('RN 0.85 venue truth is respected: no dead global-static pretense', () => {
    // The Fabric Text.js has no app-wide `maxFontSizeMultiplier` static —
    // if a future RN restores it and someone wires the dead idiom here,
    // this pin demands a deliberate update instead of silent drift.
    expect(read('src/utils/textScalePolicy.ts')).not.toMatch(
      /Text\.maxFontSizeMultiplier =/
    );
    expect(read('src/App.tsx')).not.toMatch(/applyTextScalePolicy/);
  });

  test.each([
    ['src/navigation/RootNavigator.tsx', 'tab bar (60pt)'],
    ['src/screens/SearchScreen.tsx', 'A–Z rail (44pt squares)'],
    ['src/components/syncplay/SyncPlayOverlay.tsx', 'player pill'],
    ['src/screens/HomeScreen.tsx', 'profile glyph (44pt circle)'],
    ['src/components/media/ContinueWatching.tsx', 'play glyph (44pt circle)'],
  ])('%s carries the bounded ceiling (%s)', (rel) => {
    expect(read(rel)).toMatch(/maxFontSizeMultiplier=\{TEXT_MAX_FONT_SIZE_MULTIPLIER\}/);
  });
});

// ── MW-104: the CONTRAST pillar ─────────────────────────────────────────────
describe('M-MOBILE-46 family / MW-104 contrast law', () => {
  const read = (rel: string) =>
    fs.readFileSync(path.resolve(SRC, '..', rel), 'utf8');
  const closeTo = (value: number, expected: number) =>
    expect(Math.abs(value - expected)).toBeLessThan(0.05);

  test('the WCAG math is right on the anchors (pure function, no fixtures)', () => {
    closeTo(contrastRatio('#888', '#1a1a2e'), 4.81); // meta on the sheet
    closeTo(contrastRatio('#888', '#2d2d44'), 3.77); // placeholder on the fill
    closeTo(contrastRatio('#666', '#1a1a2e'), 2.97); // the RETIRED ink — convicted
    closeTo(contrastRatio('#666', '#2d2d44'), 2.33);
    closeTo(contrastRatio('#fff', '#000'), 21);
    closeTo(contrastRatio('#888', '#888'), 1);
    // Symmetric: swapping foreground/background changes nothing.
    expect(contrastRatio('#1a1a2e', '#888')).toBeCloseTo(
      contrastRatio('#888', '#1a1a2e'),
      10
    );
    // short-hex normalization agrees with the long form
    expect(contrastRatio('#888888', '#1a1a2e')).toBeCloseTo(
      contrastRatio('#888', '#1a1a2e'),
      10
    );
  });

  test('bad hex fails loud (law 4) — no silent NaN ratio', () => {
    expect(() => contrastRatio('red', '#000')).toThrow(/not a hex color/);
    expect(() => contrastRatio('#12345', '#000')).toThrow(/not a hex color/);
    expect(() => contrastRatio('#000', '')).toThrow(/not a hex color/);
  });

  test('the promoted token clears both floors on its measured grounds', () => {
    expect(META_TEXT_COLOR).toBe('#888');
    expect(contrastRatio(META_TEXT_COLOR, '#1a1a2e')).toBeGreaterThanOrEqual(
      MIN_META_CONTRAST_RATIO
    );
    expect(contrastRatio(META_TEXT_COLOR, '#2d2d44')).toBeGreaterThanOrEqual(
      MIN_PLACEHOLDER_CONTRAST_RATIO
    );
  });

  test('the retired #666 could not clear either floor — why it died', () => {
    expect(contrastRatio('#666', '#1a1a2e')).toBeLessThan(MIN_META_CONTRAST_RATIO);
    expect(contrastRatio('#666', '#2d2d44')).toBeLessThan(
      MIN_PLACEHOLDER_CONTRAST_RATIO
    );
  });

  test('the seven promoted screens carry zero #666 anywhere', () => {
    for (const rel of [
      'src/components/syncplay/SyncPlayModal.tsx',
      'src/screens/LoginScreen.tsx',
      'src/screens/AdminDashboardScreen.tsx',
      'src/screens/SettingsScreen.tsx',
      'src/screens/CollectionsScreen.tsx',
      'src/screens/ProfileSelectScreen.tsx',
      'src/screens/PasskeysScreen.tsx',
    ]) {
      expect(read(rel)).not.toContain('#666');
    }
  });

  test('CENSUS: the only #666 survivors are the known back-office residue', () => {
    // Exact-list by design: a NEW #666 site ANYWHERE reddens this pin, and
    // curing a listed file means ROTATING the list in the same commit.
    const promoted = new Set([
      'components/syncplay/SyncPlayModal.tsx',
      'screens/LoginScreen.tsx',
      'screens/AdminDashboardScreen.tsx',
      'screens/SettingsScreen.tsx',
      'screens/CollectionsScreen.tsx',
      'screens/ProfileSelectScreen.tsx',
      'screens/PasskeysScreen.tsx',
    ]);
    const survivors: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__') {
            continue;
          }
          walk(full);
        } else if (/\.(tsx?|js)$/.test(entry.name)) {
          const rel = path.relative(path.resolve(SRC, '..'), full);
          const relPosix = rel.split(path.sep).join('/');
          const bodyPosix = relPosix.replace(/^\.\.\//, '');
          const key = bodyPosix.replace(/^src\//, '');
          if (!promoted.has(key) && fs.readFileSync(full, 'utf8').includes('#666')) {
            survivors.push(key);
          }
        }
      }
    };
    walk(path.resolve(SRC));
    expect(survivors.sort()).toEqual(
      [
        'screens/AdminLibrariesScreen.tsx',
        'screens/AdminUsersScreen.tsx',
        'screens/ParentalControlsScreen.tsx',
        'screens/PlayerScreen.tsx',
        'screens/admin/AdminBackupScreen.tsx',
        'screens/admin/AdminFsBrowseScreen.tsx',
        'screens/admin/AdminLogsScreen.tsx',
        'screens/admin/AdminPluginsScreen.tsx',
        'screens/admin/AdminServerSettingsScreen.tsx',
      ].sort()
    );
  });
});
