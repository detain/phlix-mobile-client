/**
 * The SyncPlay protocol boundary's unit decoders.
 *
 * The wire speaks MILLISECONDS (phlix-syncplay SPEC.md:91 — S293 moved every
 * SEND boundary to ms), while everything inside the app — `syncplayStore`,
 * the React state in `PlayerScreen`, and the native player's `seekTo` —
 * speaks SECONDS (AGENTS.md: "positions go on the wire in milliseconds…
 * while state and the native player stay in seconds").
 *
 * S441 (finish-S293): inbound frames used to land RAW, so a host's 42 500 ms
 * seek arrived as 42 500 SECONDS and threw the native player 1000× down the
 * timeline. The fix is ONE decode, applied at every inbound leg —
 * `SyncPlayService`'s WS handlers and `SyncPlayManager.mapPlaybackState()` —
 * and nothing below this module is allowed to do unit math of its own.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */

/**
 * Decode a WIRE position (MILLISECONDS) into the app-internal unit (SECONDS).
 *
 * Pure and total: `undefined` stays `undefined` so a command that carries no
 * position (e.g. a bare play) does not silently become "seek to 0" — the
 * consumer's own guard keeps deciding.
 */
export function wireMsToSeconds(positionMs: number | undefined): number | undefined {
  if (positionMs === undefined) {
    return undefined;
  }
  return positionMs / 1000;
}

/**
 * Normalize a wire `server_time` stamp to MILLISECONDS (R-MOBILE-01).
 *
 * The ONE mixed-unit field on the SyncPlay wire (phlix-syncplay SPEC §4/§8.4):
 * the :8097 server worker stamps `time()` — UNIX SECONDS (SyncPlayManager
 * group echo, S446 nudge echo, and the `?? time()` command fallbacks) — while
 * the hub relay stamps milliseconds (`nowMs()`). This is a byte-mirror of the
 * library's `SyncPlayClient.serverTimeToMs` (law shipped post-v0.1.5 by
 * M-SYNCPLAY-04/12): a stamp below the 1e12 discrimination threshold is
 * seconds and is scaled x1000; anything at-or-above is already ms and passes
 * through. Epoch-seconds reach 1e12 only in year 33658 — the window is
 * ambiguity-free for the lifetime of this pin.
 *
 * Pure and total on finite numbers, exactly like `wireMsToSeconds` — the
 * parse (finite-check) stays at the service's `wireNumber` boundary. RETIRE
 * this mirror and import the library export: the v0.1.7 re-pin cascade
 * (2026-11-03) made `SyncPlayClient.serverTimeToMs` live at this pin, but the
 * wave itself is scoped to pin bumps (its RESULT: syncplay consumers = "Pin
 * bump only"), so the swap stays an open follow-up — behavior-identical and
 * unit-pinned meanwhile (this repo does not bump tag-pins in rider lanes; the
 * wave is owner-scheduled).
 *
 * Scope law (same as the library): `time_pong`'s `t2` and the `time_sync`
 * advisory are NOT consumers of this function — the pong is ms on BOTH
 * carriers (server TimeSync.php `(int)(microtime(true)*1000)`; hub `nowMs()`),
 * so `handleTimePong` reads it RAW; the advisory carries an explicit
 * `serverTimeSec` name and stays seconds by contract.
 */
export function serverTimeToMs(raw: number): number {
  return raw < 1e12 ? raw * 1000 : raw;
}

/**
 * The sanity ceiling applied when the media duration is NOT yet known
 * (metadata still loading, exotic live-ish items): 24 hours in seconds.
 * A host-sent position beyond that is not a seek target any player can
 * survive — it is malformed data (M-MOBILE-27 shipped exactly the example:
 * `1e303` is finite, so the old finite-check let it reach the native API).
 */
export const SEEK_UNKNOWN_DURATION_CEILING_SECONDS = 86_400;

/**
 * Clamp a decoded-seconds seek target into what the player can honor
 * (M-MOBILE-27): non-finite or negative becomes 0; with a known positive
 * duration the target caps AT the duration; without one it caps at the
 * 24-hour sanity ceiling. The upper bound is the whole point — iOS AVPlayer
 * refuses an out-of-range CMTime (permanent stall) and Android's ExoPlayer
 * seek takes a Long whose saturation behavior is nobody's friend.
 */
export function clampSeekSeconds(
  positionSeconds: number,
  durationSeconds: number
): number {
  if (!Number.isFinite(positionSeconds) || positionSeconds <= 0) {
    return 0;
  }
  const ceiling =
    Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : SEEK_UNKNOWN_DURATION_CEILING_SECONDS;
  return Math.min(positionSeconds, ceiling);
}

/**
 * The local ±N-second skip-button target (MOB-30), routed through the same
 * {@link clampSeekSeconds} arm the SyncPlay seek legs use.
 *
 * The old forward leg was `Math.min(duration, currentTime + 15)`: while the
 * duration is still 0 (metadata loading) — and permanently for a live stream,
 * which never reports one — that evaluated to 0 and "+15" jumped the viewer
 * to the START. Decision (pinned in wireUnits.test.ts): with an unknown /
 * non-positive duration the step seeks UNCLAMPED by duration (only the
 * 24-hour sanity ceiling applies), so live streams can still skip; with a
 * known duration it caps AT the duration; a backward step floors at 0.
 */
export function stepSeekSeconds(
  currentSeconds: number,
  deltaSeconds: number,
  durationSeconds: number
): number {
  const base = Number.isFinite(currentSeconds) ? currentSeconds : 0;
  return clampSeekSeconds(base + deltaSeconds, durationSeconds);
}

/**
 * The mobile re-anchor tolerance, in SECONDS (MW-118).
 *
 * A `playback_sync` / group play-pause command carries the room's
 * authoritative position. Correcting a local delta SMALLER than the server's
 * own in-sync tolerance is audible seek churn, not correction — the member is
 * already where the room agrees they are. The value mirrors the server
 * constant by NUMBER, not by import: phlix-server
 * `src/Session/SyncPlay/GroupState.php:136` defines
 * `POSITION_TOLERANCE = 2000` (ms), the drift law's only authoritative
 * statement. `wireUnits.test.ts` pins both the 2 and this file:line proof
 * prose (source-read precedent).
 */
export const SYNC_REANCHOR_TOLERANCE_SECONDS = 2;

/**
 * Decide the re-anchor seek for an inbound play/pause command (MW-118).
 * Pure: (command position, local position, force flag) → the seconds target
 * to seek to, or `null` meaning "leave the player alone".
 *
 * Unforced group echoes honor the tolerance window above. A FORCED command —
 * the S446 nudge marker parsed at the service boundary — re-anchors even
 * inside the window: the nudge is a drift verdict the server MEASURED at
 * check time (SyncPlayManager::sendOutOfSyncNudge, phlix-server
 * src/Session/SyncPlay/SyncPlayManager.php:1593-1630), and by the time the
 * frame lands the local clock may have drifted back in-window without the
 * room having moved. The server's cooldown (GroupState.php:157
 * `NUDGE_COOLDOWN_MS`) already rate-bounds these frames, so unconditional
 * apply cannot churn.
 */
export function syncReanchorTargetSeconds(
  cmdPositionSeconds: number,
  localPositionSeconds: number,
  forceReanchor: boolean
): number | null {
  if (!forceReanchor) {
    const drift = Math.abs(cmdPositionSeconds - localPositionSeconds);
    // NaN-safe by design: an unknown local position makes `drift` NaN, the
    // comparison false — the command position wins as the target, which is
    // the fail-toward-the-room direction.
    if (drift <= SYNC_REANCHOR_TOLERANCE_SECONDS) {
      return null;
    }
  }
  return cmdPositionSeconds;
}
