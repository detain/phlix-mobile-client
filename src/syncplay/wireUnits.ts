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
 * this mirror and import the library export in the v0.1.6 re-pin cascade
 * (this repo does not bump tag-pins in rider lanes; the wave is
 * owner-scheduled).
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
