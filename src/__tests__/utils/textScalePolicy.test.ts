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
