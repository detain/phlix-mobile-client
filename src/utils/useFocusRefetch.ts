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

import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import {
  createFocusRefetchGate,
  DEFAULT_MIN_INTERVAL_MS,
} from './focusRefetchGate';

export interface UseFocusRefetchOptions {
  /** Focus-vs-last-load window under which refetch is skipped (ms). */
  minIntervalMs?: number;
}

/**
 * Call `refetch` on navigation focus, gated against stampedes. `refetch` may
 * be a fresh closure every render — the latest one is always invoked. Focus
 * errors are swallowed here on purpose: every wired screen owns error UI for
 * its loader (or degrades to empty rails), and a background refetch must
 * never surface a second error channel.
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
        // Swallowed by design: the screen's loader owns its own errors/UI,
        // and a background focus-refetch must never raise into navigation —
        // rejections AND sync throws.
        try {
          // eslint-disable-next-line no-void -- fire-and-forget; the screen's loader owns its errors
          void Promise.resolve(refetchRef.current()).catch(() => undefined);
        } catch {
          // no-op: loader blew up synchronously; its screen's next render owns it.
        }
      }
      return undefined;
    }, [])
  );
}
