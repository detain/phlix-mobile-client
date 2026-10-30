/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/noRemotePlaceholder.test.ts
//
// M-MOBILE-42 (review mobile__crossfe) — SOURCE-SCAN LAW (precedent:
// NativeAudioSelectionBoundary.test.ts greps production files the same way,
// because runtime render tests cannot prove the ABSENCE of a URL): no file
// under src/ may name `via.placeholder.com` — the old fallback phoned a
// third-party host from every self-hosted user's phone and rendered nothing
// offline. Missing artwork goes through `firstUsableUri` (pure) and renders
// `LocalPlaceholder` (local). If this test reddens, the cure is the same
// swap the six originals received — not an exception list.
import fs from 'fs';
import path from 'path';

const SRC_ROOT = path.join(__dirname, '..', '..'); // repo root
const FORBIDDEN = 'via.placeholder';

function collectSources(dir: string, hits: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') {
        continue; // this law file legitimately NAMES the forbidden URL
      }
      collectSources(full, hits);
    } else if (/\.tsx?$/.test(entry.name)) {
      if (fs.readFileSync(full, 'utf8').includes(FORBIDDEN)) {
        hits.push(path.relative(SRC_ROOT, full));
      }
    }
  }
  return hits;
}

describe('no remote placeholder service in shipped sources', () => {
  it('names zero via.placeholder references under src/ (excluding tests)', () => {
    const offenders = collectSources(path.join(SRC_ROOT, 'src'));
    expect(offenders).toEqual([]);
  });

  // Companion pin (mutation teeth): the six original call sites must keep
  // routing through the local seam — if one reverts to an inline fallback
  // chain, the scan above would need the URL back to fail; this catches a
  // refactor that swaps the local tile for any other remote source.
  it.each([
    'src/components/media/MediaCard.tsx',
    'src/components/media/PosterCard.tsx',
    'src/components/media/ContinueWatching.tsx',
    'src/screens/MediaDetailScreen.tsx',
    'src/screens/PhotosScreen.tsx',
    'src/screens/PhotoAlbumScreen.tsx',
  ])('%s renders LocalPlaceholder for missing art', (rel) => {
    const source = fs.readFileSync(path.join(SRC_ROOT, rel), 'utf8');
    expect(source).toContain('LocalPlaceholder');
    expect(source).toContain('firstUsableUri');
  });
});
