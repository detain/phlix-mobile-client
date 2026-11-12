/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/serverUnreachableCopy.ts
//
// MOB-35: the "can't reach your server" checklist used to be typed twice —
// once in `api/client.ts` (transport-error lane) and once in
// `screens/homeFailurePolicy.ts` (Home blackout) — and the two copies had
// already drifted ("that this device is" vs "you're", `;` vs `.`). The shared
// stem lives here, dependency-free, so the pure Home policy does not have to
// import the axios client graph to reuse it.
//
// Each lane keeps its OWN remedy tail on purpose, because the remedies are
// genuinely different (adjudicated in-lane):
//   - transport lane (`SERVER_UNREACHABLE_MESSAGE`) fires at sign-in too,
//     where the user is still typing the address — the full-address hint
//     (scheme-less input defaults to https; :8096 LAN servers are http) is
//     the fix for the most common first-evening mistake;
//   - Home blackout fires only once an address is already stored — the
//     Settings server card is display-only, so the honest recovery for a
//     changed address is sign out → sign in at the new address.

/** Shared first two sentences of every server-unreachable message. */
export const SERVER_UNREACHABLE_STEM =
  "Can't reach your Phlix server. Check that it's running and that this device is on the same network.";
