/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/syncplay/HubRelayConsumer.ts
/**
 * App-level wiring for the hub-relay pending-command consumer (S298, mobile
 * half).
 *
 * Two subscriptions, both plain-function (no React renderer needed):
 *
 * 1. **Socket lifecycle ("open-whenever")** — watches the hub store and opens
 *    the `:8804` relay socket whenever hub auth exists (hubUrl + session +
 *    activeServerId). Sign-out closes it; an active-server switch re-binds it
 *    (the old socket is closed by `openHubRelayConnection`'s rebind guard).
 *    The token provider mints per (user, server) over HTTP and is re-read on
 *    every reconnect because relay tokens expire.
 *
 * 2. **Command router** — watches the syncplay store's `pendingPlayMedia`
 *    slot. On a delivered `pending_command` / `play_media` frame it consumes
 *    the slot and asks the caller to navigate the player to the media id —
 *    the mobile load-a-new-title path (PlayerScreen loads the itemId from the
 *    route, resolves a stream, and auto-plays). Delivered frames are routed
 *    ONCE per unique command (`mediaId@issuedAt`); a repeat of the same frame
 *    is consumed but not re-routed.
 *
 * Mounted once from `App.tsx` at boot; `stopHubRelayConsumer()` tears both
 * subscriptions down.
 */

import { useHubStore } from '../store/hubStore';
import { useSyncplayStore } from '../store/syncplayStore';
import { createHubRelayTokenProvider } from '../hub/RelayTokenProvider';
import {
  openHubRelayConnection,
  closeHubRelayConnection,
} from './hubRelay';

export interface HubRelayConsumerOptions {
  /**
   * Route a delivered play-media command to the player with the given media
   * id. The caller decides WHEN navigation is possible (e.g. a navigation ref
   * that is only ready after the NavigationContainer mounts).
   */
  navigateToPlayer: (itemId: string) => void;
}

let started = false;
let unsubscribeHub: (() => void) | null = null;
let unsubscribeSyncplay: (() => void) | null = null;
let lastRoutedCommandKey: string | null = null;

/**
 * Open the hub-relay pending-command consumer (idempotent).
 */
export function startHubRelayConsumer(options: HubRelayConsumerOptions): void {
  if (started) {
    return;
  }
  started = true;
  lastRoutedCommandKey = null;

  // ── 1. socket lifecycle ───────────────────────────────────────────────────
  const syncSocket = (): void => {
    const { hubUrl, session, activeServerId } = useHubStore.getState();
    if (!hubUrl || !session || !activeServerId) {
      closeHubRelayConnection();
      return;
    }

    const tokenProvider = createHubRelayTokenProvider({
      hubUrl,
      serverId: activeServerId,
      getAccessToken: () => useHubStore.getState().session?.accessToken ?? null,
    });

    openHubRelayConnection({
      serverId: activeServerId,
      hubBaseUrl: hubUrl,
      tokenProvider,
      onPendingCommand: (command) => {
        useSyncplayStore.getState().applyPendingPlayMedia(command);
      },
    });
  };
  syncSocket();
  unsubscribeHub = useHubStore.subscribe((state, prev) => {
    if (
      state.hubUrl !== prev.hubUrl ||
      state.session !== prev.session ||
      state.activeServerId !== prev.activeServerId
    ) {
      syncSocket();
    }
  });

  // ── 2. command router ─────────────────────────────────────────────────────
  const routePending = (): void => {
    const { pendingPlayMedia } = useSyncplayStore.getState();
    if (!pendingPlayMedia) {
      return;
    }
    const key = `${pendingPlayMedia.mediaId}@${pendingPlayMedia.issuedAt}`;
    // Always consume: a command that was already routed must never linger in
    // the store slot and re-trigger the load path later.
    useSyncplayStore.getState().consumePendingPlayMedia();
    if (lastRoutedCommandKey === key) {
      return; // already routed — do not navigate twice for the same frame
    }
    lastRoutedCommandKey = key;
    options.navigateToPlayer(pendingPlayMedia.mediaId);
  };
  unsubscribeSyncplay = useSyncplayStore.subscribe((state, prev) => {
    if (state.pendingPlayMedia !== prev.pendingPlayMedia) {
      routePending();
    }
  });
}

/**
 * Close the hub-relay pending-command consumer: tear down both subscriptions
 * and close the relay socket.
 */
export function stopHubRelayConsumer(): void {
  unsubscribeHub?.();
  unsubscribeHub = null;
  unsubscribeSyncplay?.();
  unsubscribeSyncplay = null;
  closeHubRelayConnection();
  lastRoutedCommandKey = null;
  started = false;
}