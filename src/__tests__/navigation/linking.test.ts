/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/navigation/linking.test.ts
//
// M-MOBILE-17 (review mobile__gameux M-F, part b): external entry. The
// production pipeline is `Linking url → prefix strip → getStateFromPath →
// navigation state`, and react-navigation itself calls exactly these steps
// from the NavigationContainer `linking` prop. These tests drive the SAME
// pure function the container uses — no renderer needed, no mocks of the
// library (its routing math IS the behavior under test).
//
// Pinned laws:
//   1. windows-scheme parity: phlix://media/{id} and phlix://play/{id} reach
//      MediaDetail/Player with the itemId from the path (cross-desktop UX);
//   2. every mapped leaf route EXISTS in RootNavigator's tree today;
//   3. foreign schemes and empty/unknown links resolve to NOTHING (honest
//      drop — the config never invents routes);
//   4. the OS manifests actually register the scheme (a config that opens no
//      app on no OS is theater): Android VIEW+BROWSABLE filter, iOS
//      CFBundleURLSchemes.

import { readFileSync } from 'fs';
import { join } from 'path';
import { getStateFromPath } from '@react-navigation/native';
import type { NavigationState } from '@react-navigation/native';

import {
  extractPhlixPath,
  resolvePhlixUrl,
  PHLIX_LINKING_CONFIG,
  PHLIX_LINKING,
  PHLIX_URL_PREFIXES,
} from '../../navigation/linking';

type Leaf = { name: string; params?: Record<string, unknown> };

/** Seam: adapt the library's generic resolver to resolvePhlixUrl's loosely
 *  typed injected-parameter contract (documented in linking.ts). */
const libraryResolver = (
  path: string,
  options: unknown
): NavigationState | Partial<NavigationState> | undefined =>
  getStateFromPath(
    path,
    options as Parameters<typeof getStateFromPath>[1]
  ) as NavigationState | Partial<NavigationState> | undefined;

/** Walk react-navigation's nested partial state down to the ACTIVE leaf.
 *  v7 deep links append the matched route AFTER the initialRouteName branch
 *  (routes=[initial, matched], index=1), so following `index` — not
 *  routes[0] — is what a real device would navigate to. */
function leafOf(state: unknown): Leaf {
  const s = state as {
    routes?: Leaf[];
    index?: number;
    name?: string;
    params?: unknown;
    state?: unknown;
  };
  if (Array.isArray(s?.routes) && s.routes.length > 0) {
    const active = s.routes[s.index ?? s.routes.length - 1] as Leaf & {
      state?: unknown;
    };
    if (active.state) {
      return leafOf(active.state);
    }
    return { name: active.name, params: active.params as Record<string, unknown> };
  }
  if (typeof s?.name === 'string') {
    return { name: s.name, params: s.params as Record<string, unknown> };
  }
  throw new Error('unresolvable navigation state');
}

function resolve(url: string): Leaf | undefined {
  const state = resolvePhlixUrl(url, libraryResolver);
  return state ? leafOf(state) : undefined;
}

describe('extractPhlixPath — prefix stripping', () => {
  it('maps phlix://media/42 to media/42', () => {
    expect(extractPhlixPath('phlix://media/42')).toBe('media/42');
  });

  it('tolerates a leading slash', () => {
    expect(extractPhlixPath('phlix:///media/42')).toBe('media/42');
  });

  it('rejects foreign schemes and empty authority', () => {
    expect(extractPhlixPath('https://example.com/media/42')).toBeUndefined();
    expect(extractPhlixPath('phlix://')).toBeUndefined();
    expect(extractPhlixPath('random text')).toBeUndefined();
  });
});

describe('deep-link resolution through the PRODUCTION config', () => {
  it('phlix://media/{id} lands on MediaDetail with itemId (windows parity)', () => {
    expect(resolve('phlix://media/abc123')).toEqual({
      name: 'MediaDetail',
      params: { itemId: 'abc123' },
    });
  });

  it('phlix://play/{id} lands on Player with itemId (windows parity)', () => {
    expect(resolve('phlix://play/tt0111161')).toEqual({
      name: 'Player',
      params: { itemId: 'tt0111161' },
    });
  });

  it.each([
    ['phlix://home', 'HomeMain'],
    ['phlix://library', 'LibraryMain'],
    ['phlix://search', 'Search'],
    ['phlix://downloads', 'Downloads'],
    ['phlix://settings', 'Settings'],
    ['phlix://recommendations', 'Recommendations'],
    ['phlix://favorites', 'Favorites'],
    ['phlix://history', 'WatchHistory'],
    ['phlix://collections', 'Collections'],
    ['phlix://music', 'Music'],
    ['phlix://photos', 'Photos'],
    ['phlix://livetv', 'LiveTv'],
    ['phlix://livetv/recordings', 'LiveTvRecordings'],
    ['phlix://profiles', 'Profiles'],
    ['phlix://passkeys', 'Passkeys'],
  ] as const)('%s → %s', (url, expectedLeaf) => {
    expect(resolve(url)?.name).toBe(expectedLeaf);
  });

  it('carries param routes: collection/:collectionId, album/:albumName', () => {
    expect(resolve('phlix://collection/col-9')).toEqual({
      name: 'CollectionDetail',
      params: { collectionId: 'col-9' },
    });
    expect(resolve('phlix://album/Daft%20Punk')).toEqual({
      name: 'MusicAlbum',
      params: { albumName: 'Daft Punk' },
    });
  });

  it('PhotoAlbum is NOT mapped: its required libraryId never arrives through a path (param law)', () => {
    // R-M-MOBILE-17 r2 (MAJOR-1 cure). RootStackParamList declares
    // PhotoAlbum as { albumId: string; libraryId: string } — the album id
    // alone yields a screen whose getAlbum(albumId, undefined) call lands on
    // ErrorView, guaranteed. Same class as the excluded Cast/PhotoViewer/
    // SeasonDetail routes: a param-incomplete mapping is forbidden, and the
    // estate emits no `phlix://album/.../photos` link from any producer
    // (windows emits only media/play/accept-invite/server/internal). The
    // shape must resolve to NOTHING — honestly dropped, like any unknown
    // route — and MUST NOT be re-added without a screen-side libraryId
    // guard + a pinned wire producer.
    expect(
      'PhotoAlbum' in
        ((PHLIX_LINKING_CONFIG as { screens: Record<string, unknown> })
          .screens ?? {})
    ).toBe(false);
    expect(resolve('phlix://album/al-1/photos')).toBeUndefined();
  });

  it('an unknown path resolves to NOTHING (honest drop, no phantom route)', () => {
    expect(resolve('phlix://definitely-not-a-route')).toBeUndefined();
  });

  it('a foreign URL resolves to NOTHING', () => {
    expect(resolve('https://app.phlix.example/media/1')).toBeUndefined();
  });
});

describe('config ↔ container wiring', () => {
  it('PHLIX_LINKING exposes the registered prefixes and config', () => {
    expect(PHLIX_LINKING.prefixes).toEqual(PHLIX_URL_PREFIXES);
    expect(PHLIX_LINKING.prefixes).toEqual(['phlix://']);
    expect(PHLIX_LINKING.config).toBe(PHLIX_LINKING_CONFIG);
  });

  it('RootNavigator passes the linking config to NavigationContainer', () => {
    const src = readFileSync(
      join(__dirname, '../../navigation/RootNavigator.tsx'),
      'utf8'
    );
    expect(src).toContain('linking={PHLIX_LINKING}');
    expect(src).toContain("import { PHLIX_LINKING } from './linking'");
  });
});

describe('OS manifests register the scheme (no config theater)', () => {
  it('Android declares a VIEW + BROWSABLE intent-filter on scheme=phlix', () => {
    const xml = readFileSync(
      join(__dirname, '../../../android/app/src/main/AndroidManifest.xml'),
      'utf8'
    );
    expect(xml).toContain('<action android:name="android.intent.action.VIEW" />');
    expect(xml).toContain('<category android:name="android.intent.category.BROWSABLE" />');
    expect(xml).toContain('<data android:scheme="phlix" />');
  });

  it('iOS declares CFBundleURLTypes with the phlix scheme', () => {
    const plist = readFileSync(
      join(__dirname, '../../../ios/PhlixMobile/Info.plist'),
      'utf8'
    );
    expect(plist).toContain('<key>CFBundleURLTypes</key>');
    expect(plist).toContain('<string>phlix</string>');
    expect(plist).toContain('<key>CFBundleURLSchemes</key>');
  });

  it('iOS CFBundleURLName matches the project bundle identifier (no stale label)', () => {
    // R-M-MOBILE-17 r2 (MINOR-3 cure): the URL type label shipped as
    // `app.phlix.mobile`, a label no file in the project owns — the real
    // bundle id is declared in project.pbxproj. Cross-file equality (not a
    // second literal) so an identifier change cannot silently orphan it.
    const plist = readFileSync(
      join(__dirname, '../../../ios/PhlixMobile/Info.plist'),
      'utf8'
    );
    const urlName = /<key>CFBundleURLName<\/key>\s*<string>([^<]+)<\/string>/.exec(
      plist
    );
    expect(urlName).not.toBeNull();
    const pbx = readFileSync(
      join(
        __dirname,
        '../../../ios/PhlixMobile.xcodeproj/project.pbxproj'
      ),
      'utf8'
    );
    const bundleIds = [
      ...pbx.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = "?([^";\n]+)"?;/g),
    ].map((m) => m[1]);
    expect(bundleIds.length).toBeGreaterThan(0);
    expect(new Set(bundleIds).size).toBe(1);
    expect(urlName![1]).toBe(bundleIds[0]);
  });
});
