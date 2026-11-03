/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/navigation/deepLinkGate.ts
//
// M-MOBILE-67 (review mobile__gameux Major 9 — deep links die silently when
// not signed in). The linking docblock used to disclose this as a follow-up:
// while the tree renders only `Login`, a `phlix://…` URL resolves against a
// navigator that cannot host its routes, react-navigation drops it, and after
// sign-in the link target is gone. This module is that follow-up: a park-and-
// replay gate around the SAME config/prefixes `linking.ts` ships.
//
// THE CONTRACT:
//  - A URL arriving while the gate is closed (unauthenticated) is PARKED —
//    latest-wins, one slot — and is never handed to the container, because a
//    resolution against the Login-only tree is guaranteed garbage.
//  - When the gate opens, RootNavigator's effect drains the slot and replays
//    the URL through the identical pipeline react-navigation itself uses
//    (prefix strip → getStateFromPath → CommonActions.reset), so warm and
//    post-login links share one resolution law.
//  - A link that still cannot resolve (unknown path, ref not ready) is
//    dropped exactly as react-navigation drops it — honest failure, no
//    phantom routes. THE LAW of `linking.ts` (only real routes are mapped)
//    applies unchanged here.
//
// The OS plumbing (`Linking.getInitialURL` / `url` event) is injected via
// `DeepLinkSource` so the gate logic is unit-testable without the react-native
// Linking module, mirroring how `resolvePhlixUrl` injects `getStateFromPath`.

import { Linking } from 'react-native';
import {
  CommonActions,
  getStateFromPath,
  type LinkingOptions,
  type NavigationState,
} from '@react-navigation/native';
import { extractPhlixPath, PHLIX_LINKING } from './linking';
import type { RootStackParamList } from '../types/navigation';

/** The raw-URL intake, injectable for tests. */
export interface DeepLinkSource {
  getInitialURL(): Promise<string | null | undefined>;
  /** Subscribe to incoming URLs; returns an unsubscribe function. */
  addURLListener(onUrl: (url: string) => void): () => void;
}

/** The production source: react-native's own Linking module. */
export const RN_DEEP_LINK_SOURCE: DeepLinkSource = {
  getInitialURL: () => Linking.getInitialURL(),
  addURLListener: (onUrl) => {
    const sub = Linking.addEventListener('url', ({ url }) => onUrl(url));
    return () => sub.remove();
  },
};

// ---------------------------------------------------------------------------
// Park slot — one pending URL, latest-wins (a re-shared link supersedes the
// one it replaced; replaying two cold links in a row would be worse theater
// than replaying the newest).
// ---------------------------------------------------------------------------

let pendingUrl: string | null = null;

export function parkPendingDeepLink(url: string): void {
  pendingUrl = url;
}

export function peekPendingDeepLink(): string | null {
  return pendingUrl;
}

/** Drain the slot (returns and clears; second caller gets null). */
export function takePendingDeepLink(): string | null {
  const url = pendingUrl;
  pendingUrl = null;
  return url;
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

/**
 * Build the container's `linking` options: identical prefixes/config object as
 * `PHLIX_LINKING`, with `getInitialURL`/`subscribe` wrapped so a closed gate
 * parks instead of dropping. `isReady` is re-checked at every event, never
 * captured, so login/logout transitions need no rebuild of this object.
 */
export function createGatedLinking(
  source: DeepLinkSource,
  isReady: () => boolean
): LinkingOptions<RootStackParamList> {
  return {
    ...PHLIX_LINKING,
    getInitialURL: async () => {
      const url = await source.getInitialURL();
      if (url !== null && url !== undefined && !isReady()) {
        parkPendingDeepLink(url);
        return null;
      }
      return url;
    },
    subscribe: (listener) =>
      source.addURLListener((url) => {
        if (!isReady()) {
          parkPendingDeepLink(url);
          return;
        }
        listener(url);
      }),
  };
}

/**
 * Replay one URL through the production resolution pipeline: prefix strip →
 * getStateFromPath over the SAME config the container uses → CommonActions.
 * reset. Returns true only when the reset was actually dispatched.
 *
 * dispatch is INJECTED (no default): this module must never import
 * RootNavigator at top level — that would drag the entire screens barrel,
 * and a true module cycle, into every consumer of the gate. RootNavigator
 * supplies its own navigationRef at the call site.
 */
export function replayDeepLinkUrl(
  url: string,
  dispatch: (action: ReturnType<typeof CommonActions.reset>) => void,
  resolve: (path: string) => NavigationState | Partial<NavigationState> | undefined = (path) =>
    // Same typing seam linking.test.ts uses: v7's getStateFromPath types its
    // result narrower than the reset() intake actually accepts.
    (
      getStateFromPath as unknown as (
        p: string,
        o: unknown
      ) => NavigationState | Partial<NavigationState> | undefined
    )(path, PHLIX_LINKING.config)
): boolean {
  const path = extractPhlixPath(url);
  if (path === undefined) {
    return false; // foreign scheme — nothing to park, nothing to replay
  }
  const state = resolve(path);
  if (!state) {
    return false; // unmapped path — dropped, per THE LAW
  }
  // getStateFromPath hands back a partial state exactly like react-navigation
  // own useLinking does, and reset() normalizes it; the cast is the library's
  // own seam (v7 types the option state as complete, runtime fills the gaps).
  dispatch(CommonActions.reset(state as NavigationState));
  return true;
}
