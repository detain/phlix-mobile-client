/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/theme/tokens.ts
/**
 * Design tokens — the single color source (MW-123, review mobile__gameux #8).
 *
 * The audit counted 47 distinct raw hex values hand-copied 865 times across
 * 66 files (measured at this lane's parent 9a599d7, `src/` minus
 * `__tests__`), including two near-identical darks used interchangeably:
 * `#0f0f1a` (the app-wide shell ground) and `#1a1a2e` (the bottom-sheet /
 * nav-chrome ground). A reader could not tell a shell from a sheet by its
 * color literal, and a designer could not retint either one without a
 * 66-file hunt. This file names the family; the names say what the surface
 * IS, so the two darks can never be confused again — the cure is naming,
 * not merging: both values stay, each finally carries its role.
 *
 * The ratchet law: the ESLint rule in `.eslintrc.js` (MW-123) forbids raw
 * hex literals inside StyleSheet.create blocks in the files converted here,
 * and the converted files list is the pin — new files join by converting,
 * never by being born raw. Estate precedent: the console client's
 * check-i18n-hardcoded pinned-file-list (same grow-only discipline).
 *
 * Scope note: rgba() alpha composites (scrims, pressed states) are NOT yet
 * tokenized — they are shades of these colors, and inventing an alpha
 * family without a design-tool consumer would be a second source in
 * disguise. When one is needed it gets its own named slot here.
 */
export const colors = {
  /** The app-wide shell ground (StatusBar, Home, tab screens). */
  appBackground: '#0f0f1a',
  /** Bottom-sheet content ground — also what RootNavigator's header/tab
   * chrome uses (one value, two roles; the census says so, the name says
   * the primary one). This is NOT the shell ground; see appBackground. */
  sheetBackground: '#1a1a2e',
  /** Cards, list dividers, switch "off" track. */
  cardSurface: '#2d2d44',
  /** Text-input ground (darker than the sheet it sits on). */
  inputBackground: '#1a1a1a',

  /** Highest-emphasis text on any dark ground. */
  textPrimary: '#fff',
  /** Labels, timestamps, helper text — the MW-104 PROMOTED ink: the only
   * grays measured to clear both contrast floors on their real grounds
   * (4.81 on the sheet, 3.77 on the fill). Retired values deliberately do
   * NOT get token homes: naming a convicted color would launder it back
   * into every converted file (the census pin in
   * `__tests__/utils/textScalePolicy.test.ts` enforces the law). */
  textSecondary: '#888',
  /** Borders/disabled states — quieter than secondary. */
  textMuted: '#444',

  /** Interactive accent: links, buttons, active toggles. */
  link: '#0066cc',
  /** Destructive action ground (leave group, delete). */
  danger: '#cc3333',
  /** Destructive TEXT on dark grounds (error lines) — lighter than danger. */
  dangerText: '#ff6666',
  /** True black underlays (player letterbox, video surface). */
  black: '#000',
} as const;

export type ColorToken = keyof typeof colors;
