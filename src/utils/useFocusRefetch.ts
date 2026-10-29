/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/useFocusRefetch.ts
//
// M-MOBILE-17 (review mobile__gameux M-F): refetch server-backed data when a
// screen re-gains focus (tab switch, back-navigation) so the phone learns
// what changed elsewhere — a TV starting an episode now surfaces in Continue
// Watching the moment the user lands back on Home. The mount-focus is skipped
// (the screen's own load-on-mount effect already fires) and repeat focuses
// inside the staleness window reuse loaded data — both laws live in the pure
// `createFocusRefetchGate`; this file is only the navigation adapter.
//
// M-MOBILE-18 (review mobile__gameux M-G) adds the SECOND wake-up channel on
// the same gate: a hub server switch resets every cache under the mounted
// screens, and neither a focus transition nor the mount effect covers data
// invalidated mid-residency. The hook therefore also subscribes to the hub
// store's server-generation channel; each invalidation refetches NOW through
// the exact same quiet fire-and-forget path (same error contract, one
// mechanism — the gate, not a second bespoke reload).

import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useHubStore } from '../store/hubStore';
import {
  createFocusRefetchGate,
  DEFAULT_MIN_INTERVAL_MS,
} from './focusRefetchGate';

export interface UseFocusRefetchOptions {
  /** Focus-vs-last-load window under which refetch is skipped (ms). */
  minIntervalMs?: number;
}

/**
 * Fire the latest loader closure and forget about it. Swallowed by design on
 * BOTH failure shapes: a rejected promise (every wired screen owns error UI
 * for its loader) and a synchronous throw (a background reload must never
 * raise into navigation or into a zustand notify loop).
 */
function refetchQuietly(refetch: () => unknown): void {
  try {
    // eslint-disable-next-line no-void -- fire-and-forget; the screen's loader owns its errors
    void Promise.resolve(refetch()).catch(() => undefined);
  } catch {
    // no-op: loader blew up synchronously; its screen's next render owns it.
  }
}

/**
 * Call `refetch` on navigation focus, gated against stampedes, and
 * immediately whenever the active-server identity moves (the gate treats an
 * invalidation as outranking the staleness window). `refetch` may be a fresh
 * closure every render — the latest one is always invoked.
 */
export function useFocusRefetch(
  refetch: () => unknown,
  options: UseFocusRefetchOptions = {}
): void {
  const { minIntervalMs = DEFAULT_MIN_INTERVAL_MS } = options;

  const gateRef = useRef<ReturnType<typeof createFocusRefetchGate> | null>(
    null
  );
  if (gateRef.current === null) {
    gateRef.current = createFocusRefetchGate(minIntervalMs);
  }

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useFocusEffect(
    useCallback(() => {
      if (gateRef.current!.onFocus(Date.now())) {
        refetchQuietly(refetchRef.current);
      }
      return undefined;
    }, [])
  );

  useEffect(() => {
    // zustand v5 listener contract: (state, previousState) — the generation
    // number is the ONLY changed field this subscription reacts to; unrelated
    // hub writes (loading flags, errors) must stay inert.
    return useHubStore.subscribe((state, previous) => {
      if (state.serverGeneration === previous.serverGeneration) {
        return;
      }
      if (gateRef.current!.onInvalidate(Date.now())) {
        refetchQuietly(refetchRef.current);
      }
    });
  }, []);
}
