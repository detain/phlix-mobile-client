/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/utils/dimensionsPolicy.test.ts
//
// M-MOBILE-39 (review mobile__gameux m5): `Dimensions.get('window')` at
// module scope in six files plus a hardcoded numColumns — foldables/tablets/
// landscape froze at whatever the import-time snapshot said. The cure is the
// pattern the Photos screens already demonstrated (`useWindowDimensions`)
// plus one PURE column seam. The scan below is the regression law: a new
// module-scope snapshot reddens CI.

import * as fs from 'fs';
import * as path from 'path';

import { searchGridColumns } from '../../screens/search/searchScreenHelpers';

const SRC = path.resolve(__dirname, '../../');

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('M-MOBILE-39: no module-scope Dimensions snapshots in src/', () => {
  test('zero top-level `Dimensions.get(` lines anywhere in the tree', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(SRC)) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        // Module scope = no leading whitespace before the binding.
        if (/^const .*Dimensions\.get\(/.test(line)) {
          offenders.push(`${path.relative(SRC, file)}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  test('the six named surfaces now read useWindowDimensions', () => {
    for (const rel of [
      'src/screens/HomeScreen.tsx',
      'src/screens/MediaDetailScreen.tsx',
      'src/screens/SearchScreen.tsx',
      'src/components/media/MediaList.tsx',
      'src/components/media/MediaCard.tsx',
      'src/components/media/ContinueWatching.tsx',
    ]) {
      expect(fs.readFileSync(path.resolve(SRC, '..', rel), 'utf8')).toContain(
        'useWindowDimensions'
      );
    }
  });
});

describe('searchGridColumns (the responsive-count law, pure)', () => {
  test.each([
    [320, 2],
    [450, 2],
    [599.9, 2],
    [600, 3], // foldable/tablet width
    [899, 3],
    [900, 4], // large tablet / desktop-ish
    [1290, 4],
  ] as const)('width %i → %i columns', (width, columns) => {
    expect(searchGridColumns(width)).toBe(columns);
  });

  test('SearchScreen wires the seam to the live width (no literal 2)', () => {
    const source = fs.readFileSync(
      path.resolve(SRC, 'screens/SearchScreen.tsx'),
      'utf8'
    );
    expect(source).toMatch(/numColumns=\{searchGridColumns\(windowWidth\)\}/);
    expect(source).not.toMatch(/numColumns=\{2\}/);
  });
});
