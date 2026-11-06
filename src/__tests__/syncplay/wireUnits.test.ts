/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/syncplay/wireUnits.test.ts
//
// M-MOBILE-27 (review mobile__exploiter m2): host-sent seek positions were
// finite-checked but never BOUNDED — `1e303` passed the old gate and met the
// native player raw (iOS CMTime stall, Android Long saturation).
// clampSeekSeconds is the consumer-side bound; these are its tables.

import { readFileSync } from 'fs';
import * as path from 'path';
import {
  clampSeekSeconds,
  serverTimeToMs,
  wireMsToSeconds,
  syncReanchorTargetSeconds,
  SEEK_UNKNOWN_DURATION_CEILING_SECONDS,
  SYNC_REANCHOR_TOLERANCE_SECONDS,
} from '../../syncplay/wireUnits';
import { wirePlaybackState } from '../../syncplay/SyncPlayService';
import type { PlaybackState } from '@phlix/syncplay';

describe('wireMsToSeconds', () => {
  it('decodes ms to seconds and passes undefined through', () => {
    expect(wireMsToSeconds(42500)).toBe(42.5);
    expect(wireMsToSeconds(undefined)).toBeUndefined();
  });
});

describe('serverTimeToMs (R-MOBILE-01 — mirror of the library law)', () => {
  // Carrier vectors: :8097 stamps UNIX seconds (SyncPlayManager time()),
  // the hub relay stamps ms (nowMs()). Threshold 1e12 — epoch-seconds cross
  // it only in year 33658, so the discrimination window is exact.
  it('scales an :8097 seconds stamp x1000 (server carrier vector)', () => {
    expect(serverTimeToMs(1_700_000_000)).toBe(1_700_000_000_000);
  });

  it('passes a hub ms stamp through untouched (hub carrier vector)', () => {
    expect(serverTimeToMs(1_700_000_000_000)).toBe(1_700_000_000_000);
  });

  it('pins the discrimination boundary pair (1e12-1 scales, 1e12 passes)', () => {
    expect(serverTimeToMs(999_999_999_999)).toBe(999_999_999_999_000);
    expect(serverTimeToMs(1_000_000_000_000)).toBe(1_000_000_000_000);
  });

  it('keeps zero and negative stamps in the seconds arm (pure, total)', () => {
    expect(serverTimeToMs(0)).toBe(0);
    expect(serverTimeToMs(-5)).toBe(-5000);
  });
});

describe('clampSeekSeconds (M-MOBILE-27)', () => {
  it('keeps in-range targets verbatim', () => {
    expect(clampSeekSeconds(42.5, 600)).toBe(42.5);
    expect(clampSeekSeconds(600, 600)).toBe(600);
    expect(clampSeekSeconds(0, 600)).toBe(0); // a real "start over" seek
  });

  it('caps at the known duration', () => {
    expect(clampSeekSeconds(900, 600)).toBe(600);
    expect(clampSeekSeconds(1e303, 600)).toBe(600); // the review's exact vector
  });

  it('caps at the 24h sanity ceiling when the duration is unknown', () => {
    expect(clampSeekSeconds(1e303, 0)).toBe(SEEK_UNKNOWN_DURATION_CEILING_SECONDS);
    expect(clampSeekSeconds(500, 0)).toBe(500); // normal seek still works
    expect(clampSeekSeconds(500, NaN)).toBe(500);
  });

  it('floors negatives and non-finite input at zero', () => {
    expect(clampSeekSeconds(-10, 600)).toBe(0);
    expect(clampSeekSeconds(NaN, 600)).toBe(0);
    expect(clampSeekSeconds(Number.POSITIVE_INFINITY, 600)).toBe(0);
    expect(clampSeekSeconds(Number.MAX_VALUE, 600)).toBe(600);
  });
});

// ── MW-118 (review mobile__crossfe Critical): the re-anchor decision ───────
// playback_sync/group play-pause commands carry the room's authoritative
// position; `syncReanchorTargetSeconds` decides when the local playhead is
// far enough off to be worth seeking.
//
// The tolerance window mirrors the server's OWN in-sync verdict:
// `GroupState::POSITION_TOLERANCE` = 2000 ms (phlix-server
// src/Session/SyncPlay/GroupState.php:136). Below it the member is in-sync by
// the server's law, and a corrective seek is audible churn, not correction.
describe('syncReanchorTargetSeconds (MW-118)', () => {
  it('the tolerance mirrors the server POSITION_TOLERANCE: 2000 ms = 2 s', () => {
    expect(SYNC_REANCHOR_TOLERANCE_SECONDS).toBe(2);
    // Source-read pin: the module must CARRY its proof — the server file and
    // the constant name it mirrors are named in the source prose
    // (NativeAudioSelectionBoundary.test.ts precedent for read-pins).
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'syncplay', 'wireUnits.ts'),
      'utf8'
    );
    expect(source).toContain('GroupState.php');
    expect(source).toContain('POSITION_TOLERANCE');
  });

  it('within the window, unforced: leave the player alone (null)', () => {
    expect(syncReanchorTargetSeconds(20, 20, false)).toBeNull();
    expect(syncReanchorTargetSeconds(21.5, 20, false)).toBeNull();
    // AT the window (delta exactly 2) is still within it — the server
    // compares `< POSITION_TOLERANCE`; equal is the boundary the echo used
    // to call in-sync.
    expect(syncReanchorTargetSeconds(22, 20, false)).toBeNull();
  });

  it('beyond the window, unforced: the command position is the target', () => {
    expect(syncReanchorTargetSeconds(95, 10, false)).toBe(95);
    expect(syncReanchorTargetSeconds(22.5, 20, false)).toBe(22.5);
    expect(syncReanchorTargetSeconds(5, 100, false)).toBe(5); // ahead, not just behind
  });

  it('forced (S446 nudge) re-anchors even inside the window', () => {
    // The nudge is a verdict the server MEASURED at check time; by the time
    // the frame lands the local clock may sit inside the window — stale
    // verdict still wins: NUDGE_COOLDOWN_MS (GroupState.php:157) already
    // bounds the churn rate.
    expect(syncReanchorTargetSeconds(21, 20, true)).toBe(21);
    expect(syncReanchorTargetSeconds(20.4, 20, true)).toBe(20.4);
  });
});

// ── MW-011 (review mobile__crossfe): the playback-state boundary parser ─────
// The canonical SPEC §4 union lives in @phlix/syncplay
// (node_modules/@phlix/syncplay/dist/messages.d.ts:64 — playing | paused |
// buffering | stopped). The service whitelist used to be a 3-member local
// twin, so every legitimate `buffering` group frame collapsed to `stopped`
// — the group UI read an active party as ended.
describe('wirePlaybackState (MW-011 — library-union parity)', () => {
  // Exhaustiveness by CONSTRUCTION: `Record<PlaybackState, true>` makes `tsc`
  // red if the library union grows (key missing here) OR renames (key extra
  // here) — the same compile gate already pins the service's
  // `PLAYBACK_STATES: readonly PlaybackState[]` literal. This table and the
  // whitelist are then reconciled at RUNTIME by the identity test below.
  const LIBRARY_STATES: Record<PlaybackState, true> = {
    playing: true,
    paused: true,
    buffering: true,
    stopped: true,
  };

  it.each(Object.keys(LIBRARY_STATES))(
    'admits the canonical library state %s unchanged (no collapse)',
    (state) => {
      expect(wirePlaybackState(state)).toBe(state);
    }
  );

  it('preserves buffering — the M-MOBILE-26/54 collapse this wave cures', () => {
    expect(wirePlaybackState('buffering')).toBe('buffering');
  });

  it('still lands hostile values on the stopped-safe fallback (M-MOBILE-26/54 law intact)', () => {
    expect(wirePlaybackState('playing-fast')).toBe('stopped');
    expect(wirePlaybackState(7)).toBe('stopped');
    expect(wirePlaybackState({ state: 'playing' })).toBe('stopped');
    expect(wirePlaybackState(null)).toBe('stopped');
    expect(wirePlaybackState(undefined)).toBe('stopped');
  });
});
