/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/mediaFallback.ts
//
// M-MOBILE-42 (review mobile__crossfe): the poster fallbacks used to name a
// third-party placeholder web service — every self-hosted user's phone would
// call it on first launch (privacy leak of IP + library activity to an
// unrelated host) and it rendered nothing offline. The law is now: a missing
// image yields NO remote uri — the caller renders `LocalPlaceholder`
// instead. This module is the pure decision; the glyph lives in the
// component.

/**
 * First usable image uri among the candidates (truthy non-empty strings),
 * or `undefined` when none exists — `undefined` means "render the local
 * placeholder", never "fetch from somebody else's server".
 */
export function firstUsableUri(
  ...candidates: Array<string | null | undefined>
): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate !== '') {
      return candidate;
    }
  }
  return undefined;
}
