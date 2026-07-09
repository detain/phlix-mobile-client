/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/syncplay/contract.test.ts
/**
 * Shared-package wiring contract test.
 *
 * Locks the mobile client to the canonical `@phlix/syncplay` protocol surface so
 * a drift in the package (or an accidental local re-fork) fails CI immediately:
 *   - exactly 19 SyncPlay message types
 *   - PROTOCOL_VERSION === 1
 *   - the CHAT/TYPING keys carry the expected wire-string values
 */
import {
  SYNCPLAY_MESSAGE_TYPES,
  PROTOCOL_VERSION,
} from '@phlix/syncplay';

describe('@phlix/syncplay contract', () => {
  it('exposes exactly 19 SyncPlay message types', () => {
    expect(Object.keys(SYNCPLAY_MESSAGE_TYPES)).toHaveLength(19);
  });

  it('pins the protocol version to 1', () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });

  it('uses the canonical CHAT/TYPING keys with the shared wire values', () => {
    // Mobile previously used CHAT_MESSAGE/CHAT_TYPING; the package keys are
    // CHAT/TYPING but the wire string values are unchanged.
    expect(SYNCPLAY_MESSAGE_TYPES.CHAT).toBe('syncplay_chat');
    expect(SYNCPLAY_MESSAGE_TYPES.TYPING).toBe('syncplay_typing');
  });
});
