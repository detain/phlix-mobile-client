/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/rnvi-static-bridge.d.ts
//
// M29 (deferred lane): tsc on this repo pins moduleResolution "node" (node10),
// which cannot see the `exports` subpath "./static" that
// @react-native-vector-icons/material-icons publishes — Metro (0.8x,
// package-exports enabled) resolves it natively at bundle time, so ONLY the
// type checker needs this bridge to the physical declaration file. Keep the
// re-export pointed at the shipped .d.ts so the glyph-name union below stays
// the package's own truth (a hand-written subset would drift).
declare module '@react-native-vector-icons/material-icons/static' {
  export * from '@react-native-vector-icons/material-icons/lib/typescript/src/static';
  export { default } from '@react-native-vector-icons/material-icons/lib/typescript/src/static';
}
