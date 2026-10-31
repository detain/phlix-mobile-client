/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/homeFailurePolicy.ts
//
// M-MOBILE-02 (review mobile__casualgamer #2, majors): every home rail used
// to swallow its own failure (`.catch(() => [])`), so when the SERVER went
// unreachable — the classic router-reboot IP change — Home rendered a
// cheerful empty shelf-world with "Hello, User" and the screen's own
// ErrorView branch was unreachable code. This is the pure blackout decision;
// the screen mounts `ErrorView` (message + retry) when it says so.
//
// Partial failure stays GRACEFUL on purpose: one broken rail must not block
// the rest of home. Only the all-hands case — every request the screen
// actually issued failed — means "you cannot reach the server", because no
// data path survived to contradict it. The signed-out guest asks for fewer
// rails, and the decision counts only the attempted ones.
export interface HomeRailFailures {
  /** `getRecentlyAdded` rejected. */
  recentlyAdded: boolean;
  /** `getContinueWatching` rejected (ignored when not attempted). */
  continueWatching: boolean;
  /** `getLibraries` rejected. */
  libraries: boolean;
}

/**
 * The blackout copy — app-owned, actionable, and honest about the recovery
 * path (the Settings server card is display-only; re-pointing means signing
 * out and signing in at the new address, one clean flow since the M-10
 * vault teardown).
 */
export const HOME_SERVER_BLACKOUT_MESSAGE =
  "Can't reach your Phlix server. Check that it's running and you're on the same network. " +
  'If its address changed, sign out and sign in again with the new address.';

/** True when every rail Home attempted actually failed — server blackout. */
export function homeServerBlackout(failures: HomeRailFailures, signedIn: boolean): boolean {
  const attempted = signedIn
    ? [failures.recentlyAdded, failures.continueWatching, failures.libraries]
    : [failures.recentlyAdded, failures.libraries];
  return attempted.every((failed) => failed);
}
