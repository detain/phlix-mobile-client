/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/textScalePolicy.ts
//
// M-MOBILE-45 (review mobile__gameux m11): the app held no font policy at
// all — sub-12 text existed in ten styles (worst in the SyncPlayOverlay
// stats), and with no `maxFontSizeMultiplier` anywhere a large-text user
// blew past the fixed 60pt tab bar and the 44pt glyph rows while a normal-
// text user still read 10pt captions. Two laws:
//
//  1. FLOOR — no text below MIN_FONT_SIZE_PT (12pt, Apple HIG / Material
//     smallest-accepted). The law test scans the whole tree and fails on
//     anything lower.
//  2. CEILING — the fixed-height CHROME (tab bar icons, the A–Z rail, the
//     SyncPlay stat row, the glyph buttons that sit inside 44pt circles)
//     carries `maxFontSizeMultiplier={1.5}` as a PROP: large text still
//     grows those labels usefully, but bounded, so 60pt/44pt geometry
//     survives it.
//
// VENUE TRUTH (why prop-level, not global): RN 0.85 ships the Fabric Text
// implementation — the legacy `Text.maxFontSizeMultiplier` app-wide static
// is GONE from `Libraries/Text/Text.js` (verified against the vendored
// source, not the internet), and `Text.defaultProps` died with Paper. The
// supported surface is the per-Text prop, so the policy rides the chrome
// that can overflow. Body copy stays fully scalable BY DESIGN — an
// accessibility default the review did not ask to remove.

/** The floor every `fontSize` in the app must meet (law test pins it). */
export const MIN_FONT_SIZE_PT = 12;

/** Bounded growth for fixed-height chrome: 1.5× — boost survives geometry. */
export const TEXT_MAX_FONT_SIZE_MULTIPLIER = 1.5;
