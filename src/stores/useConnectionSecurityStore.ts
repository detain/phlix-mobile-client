/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/useConnectionSecurityStore.ts
//
// M-MOBILE-51 (review mobile__secnet m3): the estate posture is "LAN http is
// accepted, cellular is not" — but nothing told the USER which side of that
// line they were on. Every cleartext lane (REST over http://, the direct
// SyncPlay socket over ws://, the hub relay over ws://) was reachable and
// silent, with the only signal being the scheme of whatever the user typed.
// This store is that missing signal: the dial seams REPORT, one banner
// listens.
//
// Law notes:
//  * Writers are the three URL-resolving seams ONLY (api/client.ts,
//    syncplay/wsEndpoint.ts, syncplay/hubRelay.ts). They call mark() with
//    the resolved URL; the predicate lives in ONE place here (isCleartextUrl).
//  * Marking is level-triggered per lane and write-gated: re-marking a lane
//    with the same security state does not notify (interceptors run per
//    request — a chatty store would repaint the banner endlessly).
//  * A lane goes back to SECURE only by resolving securely (or logout's
//    resetLanes); it is never presumed clean.

import { create } from 'zustand';

export type ConnectionLane = 'rest' | 'syncplayWs' | 'hubRelay';

/** `http://` and `ws://` are cleartext; everything else is treated secure. */
export function isCleartextUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('ws://');
}

interface ConnectionSecurityState {
  /** Cleartext verdict per lane — absent entry means "never resolved yet". */
  cleartext: Partial<Record<ConnectionLane, boolean>>;
  /** Report a lane's just-resolved URL. Write-gated (no notify on no-change). */
  mark: (lane: ConnectionLane, url: string) => void;
  /** Forget every lane (sign-out: the next session resolves fresh truth). */
  resetLanes: () => void;
}

export const useConnectionSecurityStore = create<ConnectionSecurityState>(
  (set, get) => ({
    cleartext: {},
    mark: (lane, url) => {
      const next = isCleartextUrl(url);
      if (get().cleartext[lane] === next) {
        return;
      }
      set((state) => ({ cleartext: { ...state.cleartext, [lane]: next } }));
    },
    resetLanes: () => set({ cleartext: {} }),
  })
);

/** True while ANY resolved lane is cleartext — the banner's condition. */
export function selectAnyCleartext(
  state: Pick<ConnectionSecurityState, 'cleartext'>
): boolean {
  return Object.values(state.cleartext).some((insecure) => insecure === true);
}
