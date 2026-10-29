/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/navigation/linking.ts
//
// M-MOBILE-17 (review mobile__gameux M-F, part b — external entry). Until now
// the app had NO way in from outside: no `linking` prop on the
// NavigationContainer, no OS url handling, no scheme registration in either
// manifest. A `phlix://` link typed, messaged, or scanned anywhere opened
// nothing.
//
// THE LAW: only routes that actually EXIST in RootNavigator are mapped —
// unknown links resolve to nothing and are dropped by react-navigation
// itself (honest failure). Registering phantom routes to make links "work"
// is forbidden. Param-required routes are mapped ONLY where every required
// param arrives through the path itself: `Cast` is deliberately absent
// because its `streamUrl` can never come from a URL (it is minted per
// playback request); `PhotoViewer`/`SeasonDetail` stay in-app for the same
// reason (session-scoped context); `PhotoAlbum` is absent because
// `RootStackParamList` requires BOTH `albumId` and `libraryId` while a path
// of the shape `album/:albumId/photos` carries only one — such a link
// deterministically renders ErrorView (r1 shipped exactly that mapping and
// a test pinned the broken resolution; r2 removed both — re-adding it
// needs a screen-side libraryId guard AND a real wire producer, and the
// estate today has none: windows emits only media/play/accept-invite/
// server/internal).
//
// DISCLOSED GAP (auth cold-start, M-MOBILE-17 r2): a link arriving while
// the session is unauthenticated resolves against a tree that renders only
// `Login`, so react-navigation drops it — there is no pending-URL replay
// after sign-in. Curing it needs an auth-gated linking callback (upstream
// `linking.subscribe`/`getInitialURL` overrides) and is filed as a
// follow-up, not silently pretended-works here.
//
// SCHEME PARITY with the windows client (`deepLinkValidator.ts`, W3
// unification): `phlix://media/{id}` and `phlix://play/{id}` mean the same
// thing on every Phlix desktop. The other paths are mobile-route names kept
// literal so a maintainer can read a link and predict its screen.
//
// react-navigation's `linking` prop subscribes to `Linking.getInitialURL` /
// the `url` event at the container root (useLinking.native) — cold-start AND
// warm links need no extra wiring here, and NO new dependency was added.

import type {
  LinkingOptions,
  NavigationState,
} from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';

/** Registered scheme(s). Single custom scheme; https app-links are absent
 *  because they require per-domain assetlinks.json / apple-app-site-
 *  association hosting that this client does not control (disclosed gap,
 *  not silently dropped). */
export const PHLIX_URL_PREFIXES = ['phlix://'];

/**
 * The nested screen map. TYPING SEAM: react-navigation's
 * `LinkingOptions<RootStackParamList>` only types the FIRST level against
 * the param list — full nested typing would need `NavigatorScreenParams`
 * threading through RootStackParamList/TabParamList (a cross-screen types
 * refactor outside this lane). Behavior is instead pinned at runtime by
 * src/__tests__/navigation/linking.test.ts, which drives the REAL
 * `getStateFromPath` over this exact object.
 */
export const PHLIX_LINKING_CONFIG = {
  initialRouteName: 'Main',
  screens: {
    Main: {
      initialRouteName: 'Home',
      screens: {
        Home: {
          screens: {
            HomeMain: 'home',
            Recommendations: 'recommendations',
            // windows parity: phlix://media/{itemId}
            MediaDetail: 'media/:itemId',
          },
        },
        Library: {
          screens: {
            LibraryMain: 'library',
          },
        },
        Search: 'search',
        Downloads: 'downloads',
        Settings: 'settings',
      },
    },
    // windows parity: phlix://play/{itemId}
    Player: 'play/:itemId',
    Favorites: 'favorites',
    WatchHistory: 'history',
    Collections: 'collections',
    CollectionDetail: 'collection/:collectionId',
    Music: 'music',
    MusicAlbum: 'album/:albumName',
    Photos: 'photos',
    // PhotoAlbum deliberately absent — required `libraryId` can never arrive
    // through a path (see THE LAW above + the r2 test). Re-adding needs both
    // a screen guard and a real producer.
    LiveTv: 'livetv',
    LiveTvRecordings: 'livetv/recordings',
    Profiles: 'profiles',
    Passkeys: 'passkeys',
  },
};

export const PHLIX_LINKING: LinkingOptions<RootStackParamList> = {
  prefixes: PHLIX_URL_PREFIXES,
  // Documented typing seam (see PHLIX_LINKING_CONFIG above): the object's
  // SHAPE is runtime-verified against real routes by the linking suite.
  config:
    PHLIX_LINKING_CONFIG as unknown as LinkingOptions<RootStackParamList>['config'],
};

/**
 * `phlix://media/42` → `media/42`; anything outside the registered prefix →
 * undefined. Mirrors the scheme-stripping step of @react-navigation/native's
 * extractPathFromURL for OUR prefix set (single custom scheme, path follows
 * the authority separator directly).
 */
export function extractPhlixPath(url: string): string | undefined {
  if (!url.startsWith('phlix://')) {
    return undefined;
  }
  const rest = url.slice('phlix://'.length).replace(/^\/+/, '');
  return rest.length > 0 ? rest : undefined;
}

/**
 * Pure resolver mirroring the production pipeline: prefix strip (above) +
 * react-navigation's `getStateFromPath` over the SAME config the container
 * uses. The `getStateFromPath` function is injected (loosely typed) so this
 * module keeps a navigation-runtime-free import surface for tests and future
 * callers that want to validate a link without navigating.
 */
export function resolvePhlixUrl(
  url: string,
  getStateFromPath: (
    path: string,
    options: unknown
  ) => NavigationState | Partial<NavigationState> | undefined
): NavigationState | Partial<NavigationState> | undefined {
  const path = extractPhlixPath(url);
  if (path === undefined) {
    return undefined;
  }
  return getStateFromPath(path, PHLIX_LINKING_CONFIG);
}
