/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/exitGuard.ts
//
// M-MOBILE-35 (review mobile__gameux m1): the app registered NO BackHandler
// anywhere, so on Android the hardware back button pressed at a dead root
// (Login, or the first tab with an empty stack) silently quit the app.
// The cure is an explicit EXIT CONFIRM at exactly that moment — and nowhere
// else: anywhere the navigator can still pop, back keeps popping.
//
// The decision lives in a pure factory so the law is unit-testable without a
// React renderer (repo doctrine: slot hosts and pure seams, never RTL).
// The React side (`RootExitGuard` in RootNavigator) just feeds this handler
// to BackHandler with the live navigationRef.

/** Everything the guard needs, injected — no RN imports in this module. */
export interface ExitGuardDeps {
  /** Same answer `navigationRef.canGoBack()` gives at press time. */
  canGoBack: () => boolean;
  /** Ask the user; `onConfirm` fires only if they choose to quit. */
  confirmExit: (onConfirm: () => void) => void;
  /** The actual leave (BackHandler.exitApp in the wired component). */
  exitApp: () => void;
}

/**
 * Hardware-back handler for the whole container. Return contract is RN's
 * BackHandler's: TRUE means "I handled it, stop default"; FALSE means
 * "pass to the next listener" (the navigator's own pop chain).
 *
 *  - Navigator can go back → decline (false): pops keep working untouched,
 *    including bottom-tabs' backBehaviour loop.
 *  - At a dead root → swallow the default exit (true) and raise the confirm;
 *    only the confirm's affirmative path leaves.
 */
export function createExitGuardHandler(deps: ExitGuardDeps): () => boolean {
  return () => {
    if (deps.canGoBack()) {
      return false;
    }
    deps.confirmExit(() => deps.exitApp());
    return true;
  };
}

/** Copy strings the confirm surfaces (pinned by test — no silent drift). */
export const EXIT_CONFIRM = {
  title: 'Exit Phlix?',
  message: 'This closes the app. Playback on this device stops.',
  cancel: 'Stay',
  confirm: 'Exit',
} as const;
