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

// ---------------------------------------------------------------------------
// MW-104 — CONTRAST law (the third font-policy pillar in this file).
//
// The app's secondary/meta copy and every input placeholder carried the
// 40% gray token (666666, prefixed) on the dark chrome: measured 2.97:1 on
// the sheet (1a1a2e) and 2.33:1 on the input fill (2d2d44) — under even the large/advisory-text bar, let
// alone WCAG AA's 4.5:1 for normal text. The 53% gray (888, prefixed) lifts the SAME tokens to
// 4.81:1 / 3.77:1: meta copy clears AA outright; placeholder ink (advisory
// text the field itself labels) clears the placeholder floor pinned below.
// The seven screens that carried the whole on-screen family were promoted
// in this wave; the admin/back-office residue is census-pinned (its exact
// file list) so the pin REDDENS on any NEW site of the retired ink while
// the known residue waits on its own wave.

/** The promoted meta/placeholder ink — one token, one truth (MW-104). */
export const META_TEXT_COLOR = '#888';

/** WCAG AA normal-text floor: meta copy must clear this (measured 4.81). */
export const MIN_META_CONTRAST_RATIO = 4.5;

/** Floor for advisory ink (placeholders — self-labelled by their field):
 * measured 3.77 for META_TEXT_COLOR on the input fill. */
export const MIN_PLACEHOLDER_CONTRAST_RATIO = 3.5;

/** sRGB channel → linear light (WCAG relative-luminance definition). */
function linearChannel(byte: number): number {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function parseHexColor(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (m === null) {
    // Fail fast: a non-hex token here means a rgba()/named color entered a
    // WCAG-math call — the law tests only ever pass #rgb/#rrggbb literals.
    throw new Error(`contrastRatio: not a hex color: ${hex}`);
  }
  const body = m[1];
  const hex6 =
    body.length === 3
      ? body
          .split('')
          .map((nibble) => nibble + nibble)
          .join('')
      : body;
  return [
    parseInt(hex6.slice(0, 2), 16),
    parseInt(hex6.slice(2, 4), 16),
    parseInt(hex6.slice(4, 6), 16),
  ];
}

/** WCAG 2.x relative luminance of a hex color. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHexColor(hex);
  return (
    0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b)
  );
}

/**
 * WCAG contrast ratio of two hex colors — symmetric, 1..21, pure.
 * The law test drives it with the measured pairs; production code reads
 * the constants, never this function (the math is the PIN, not a runtime
 * gate — RN has no live-contrast enforcement surface).
 */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

