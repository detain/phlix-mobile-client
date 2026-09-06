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
