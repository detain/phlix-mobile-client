/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/syncplay/syncplayErrors.ts
//
// The SyncPlay error-code → user-facing message catalog (error-code-first
// doctrine). The stable machine code on the wire decides what the viewer
// reads; the server's English `message` field is a debug fallback, never the
// rendering target. See the `phlix-contracts` errors.ts header ("servers
// speak codes, clients speak languages") and the `phlix-syncplay` SPEC:
// clients read `error_code` first, then `code`.
//
// LANGUAGE: this catalog is ENGLISH-ONLY, deliberately. This repo has no i18n
// infrastructure today — its ~32 screens carry inline English strings and it
// does not depend on @phlix/ui. Shipping a half-wired translation layer would
// be dishonest. Instead the catalog is a keyed code→message table behind ONE
// resolver (`describeSyncPlayError`), so a future i18n wave only has to swap
// the value type for a locale map and every call site keeps working.
//
// COVERAGE: every member of the contracts `SyncPlayErrorCode` union —
// the 12 legacy SCREAMING_SNAKE codes the server emits in `error_code` today
// (verified at phlix-server f8cba60c: SyncPlayManager::sendError +
// MessageHandler via Messages::error), the 7 dotted `syncplay.*` twins (4
// already on the wire at the group-limit / join-validation sites; 3 reserved
// for the Wave-2 cutover — the registry's own rule is "clients localize them
// now, so the switch needs no client release"), and PROTOCOL_VERSION_MISMATCH
// inside the legacy set. `Record<SyncPlayErrorCode, string>` makes omission a
// COMPILE error, and syncplayErrors.test.ts pins the catalog against
// `SYNCPLAY_ERROR_CODES` so a registry bump without a catalog entry turns red.

import type { SyncPlayErrorCode } from '@phlix/contracts';

/** Last-resort copy when neither the code nor the server text can help. */
const GENERIC_ROOM_ERROR = 'Something went wrong in the SyncPlay room.';

/**
 * User-facing English sentences per wire code. Keyed by the exact wire value
 * so the lookup is a plain property read — no normalization layer to drift.
 */
const SYNCPLAY_USER_MESSAGES: Record<SyncPlayErrorCode, string> = {
  // ── Legacy SCREAMING codes — live wire traffic today (error_code field) ──
  UNKNOWN_MESSAGE: 'That message was not recognized in the SyncPlay room.',
  HANDLER_ERROR: 'The SyncPlay room hit an internal error. Please try again.',
  NOT_AUTHENTICATED: 'Please sign in to use SyncPlay.',
  NOT_IN_GROUP: 'You are no longer in a SyncPlay room.',
  NOT_HOST: 'Only the room host can do that.',
  INVALID_NEW_HOST: 'That member cannot take over the room.',
  MEMBER_NOT_FOUND: 'That member is no longer in the room.',
  SAME_HOST: 'That member is already the host.',
  CREATE_FAILED: 'Could not create the SyncPlay room. Please try again.',
  JOIN_FAILED: 'Could not join the SyncPlay room. Please try again.',
  LEAVE_FAILED: 'Could not leave the SyncPlay room cleanly. Please try again.',
  PROTOCOL_VERSION_MISMATCH:
    'Please update the Phlix app — this server speaks a newer SyncPlay protocol.',

  // ── Dotted `syncplay.*` twins — 4 emitted today, 3 reserved for Wave-2 ──
  'syncplay.create_failed': 'Could not create the SyncPlay room. Please try again.',
  'syncplay.group_limit_reached':
    'This server has reached its SyncPlay room limit. Try again later.',
  'syncplay.join_failed': 'Could not join the SyncPlay room. Please try again.',
  'syncplay.group_not_found': 'That SyncPlay room no longer exists.',
  'syncplay.invalid_password': 'That password is not correct for this SyncPlay room.',
  'syncplay.group_full': 'That SyncPlay room is full.',
  'syncplay.leave_failed': 'Could not leave the SyncPlay room cleanly. Please try again.',
};

/** True when `code` is a wire value this catalog renders a sentence for. */
export function isMappedSyncPlayCode(code: string): code is SyncPlayErrorCode {
  return Object.prototype.hasOwnProperty.call(SYNCPLAY_USER_MESSAGES, code);
}

/**
 * Resolve the sentence the viewer should see for a `syncplay_error` frame.
 *
 * Precedence (doctrine): catalog hit for the code → server's English message
 * (honest last signal for codes newer than this app) → generic fallback.
 *
 * @param code           wire code, already parsed by the SPEC read order
 *                       (`error_code` ?? `code`); the service's 'UNKNOWN'
 *                       sentinel intentionally degrades like an unknown code.
 * @param serverMessage  the frame's `message` field, used only as fallback.
 */
export function describeSyncPlayError(code: string | undefined, serverMessage?: string): string {
  if (code !== undefined && isMappedSyncPlayCode(code)) {
    return SYNCPLAY_USER_MESSAGES[code];
  }
  if (serverMessage !== undefined && serverMessage.trim() !== '') {
    return serverMessage;
  }
  return GENERIC_ROOM_ERROR;
}
