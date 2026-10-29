/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/store/serverScope.ts
//
// M-MOBILE-18 (review mobile__gameux M-G): the hub server switch changed
// `activeServerId`/`effectiveServerUrl` and persisted — while every screen
// kept rendering the OLD server's cached rows, and queued writes carrying the
// OLD server's media/item ids survived to fire against the NEW server (a
// favorite/play/download id from server A addressed at server B is at best a
// 404 and at worst an unrelated same-id title). The switch must therefore be
// ATOMIC: caches drop in the same frame the server identity moves, and the
// remaining async writers disarm through their generation stamps (see
// PlaybackProgressReporter) or through this sweep (download queue, pending
// play-media).
//
// This module is the SINGLE cascade owner. Dependency law: hubStore imports
// this module — this module must never import hubStore (the graph stays
// acyclic and the cascade stays testable without the hub auth surface).

import { useCollectionStore } from '../stores/useCollectionStore';
import { useFavoritesStore } from '../stores/useFavoritesStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useLiveTvStore } from '../stores/useLiveTvStore';
import { useMusicStore } from '../stores/useMusicStore';
import { usePhotoStore } from '../stores/usePhotoStore';
import { useProfileStore } from '../stores/useProfileStore';
import { useSearchStore } from '../stores/useSearchStore';
import { useWatchHistoryStore } from '../stores/useWatchHistoryStore';
import { useDownloadStore } from './downloadStore';
import { useSyncplayStore } from './syncplayStore';

/**
 * Drop every piece of state that is addressed by the PREVIOUS active server:
 * read caches first (they must never render as the new server's truth), then
 * the queued old-id mutations that could still walk into the new server.
 *
 * Deliberately NOT touched — every omission is a documented decision, also
 * carried in .reviews/fixlog/M-MOBILE-18__fix.md:
 * - `usePlayerStore`: the current stream URL is already resolved and bound to
 *   the old server, so the bytes keep playing honestly; blanking it would
 *   kill the audio the user is hearing. Its progress writes are disarmed by
 *   the PlaybackProgressReporter generation stamp instead.
 * - `useSyncplayStore` room state: the socket is still live in the old
 *   server's room — clearing `currentGroup` would lie about a join the user
 *   is still in (the M-MOBILE-16 session-lifecycle law, same posture as cast).
 * - `useCastStore`: disconnects only on explicit action or the server's own
 *   `active: false` (M-MOBILE-16).
 * - `useSettingsStore` / `useAuthStore`: the direct-login server and JWT are
 *   user config, outside a hub switch's blast radius.
 * - `useAdminStore` / `useWebAuthnStore`: not server-data caches.
 */
export function resetServerScopedState(): void {
  // 1. Read caches — old-server rows must never present as new-server truth.
  useLibraryStore.getState().reset();
  useFavoritesStore.getState().reset();
  useWatchHistoryStore.getState().reset();
  useSearchStore.getState().reset();
  useCollectionStore.getState().reset();
  useMusicStore.getState().reset();
  usePhotoStore.getState().reset();
  useLiveTvStore.getState().reset();
  useProfileStore.getState().reset();

  // 2. Queued old-server-id mutations that could still fire post-switch.
  useSyncplayStore.getState().discardPendingPlayMedia();
  useDownloadStore.getState().cancelUnfinishedTasks();
}
