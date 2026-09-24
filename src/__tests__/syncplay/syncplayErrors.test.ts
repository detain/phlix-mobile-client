/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/syncplay/syncplayErrors.test.ts
//
// Pins for the SyncPlay error-code → user-message catalog: coverage against
// the contracts registry (so a v0.5.1→next bump without a catalog entry turns
// red) and the doctrine precedence (catalog hit > server text > generic).

import {
  LEGACY_SYNCPLAY_ERROR_CODES,
  SYNCPLAY_ERROR_CODES,
  SYNCPLAY_TWIN_ERROR_CODES,
} from '@phlix/contracts';
import {
  describeSyncPlayError,
  isMappedSyncPlayCode,
} from '../../syncplay/syncplayErrors';

describe('syncplayErrors — registry coverage', () => {
  it('maps EVERY code in the contracts SyncPlayErrorCode union', () => {
    // Census anchors: 12 legacy SCREAMING (incl. PROTOCOL_VERSION_MISMATCH)
    // + 7 dotted twins. A registry bump moves these — and the loop below
    // only goes green once syncplayErrors.ts grows the missing sentence
    // (Record<SyncPlayErrorCode, string> makes omission a compile error too).
    expect(LEGACY_SYNCPLAY_ERROR_CODES).toHaveLength(12);
    expect(SYNCPLAY_TWIN_ERROR_CODES).toHaveLength(7);
    expect(SYNCPLAY_ERROR_CODES).toHaveLength(19);

    for (const code of SYNCPLAY_ERROR_CODES) {
      expect(isMappedSyncPlayCode(code)).toBe(true);
    }
  });

  it('includes the PROTOCOL_VERSION_MISMATCH family in the legacy set', () => {
    expect(LEGACY_SYNCPLAY_ERROR_CODES).toContain('PROTOCOL_VERSION_MISMATCH');
    expect(isMappedSyncPlayCode('PROTOCOL_VERSION_MISMATCH')).toBe(true);
  });

  it('renders a real sentence for every mapped code — never the server text', () => {
    const SERVER_TEXT = 'RAW SERVER DEBUG TEXT MUST NOT RENDER';
    for (const code of SYNCPLAY_ERROR_CODES) {
      const sentence = describeSyncPlayError(code, SERVER_TEXT);
      expect(sentence.trim().length).toBeGreaterThan(0);
      expect(sentence).not.toBe(SERVER_TEXT);
    }
  });
});

describe('describeSyncPlayError — doctrine precedence', () => {
  it('code-catalog hit beats the server message', () => {
    expect(
      describeSyncPlayError('NOT_HOST', 'Only the host can control playback')
    ).toBe('Only the room host can do that.');
  });

  it('unknown code falls through to the server message', () => {
    expect(describeSyncPlayError('FUTURE_SERVER_CODE', 'Server says hello')).toBe(
      'Server says hello'
    );
  });

  it("the service's 'UNKNOWN' sentinel degrades like an unknown code", () => {
    expect(describeSyncPlayError('UNKNOWN', 'boom')).toBe('boom');
    expect(describeSyncPlayError('UNKNOWN')).toBe(
      'Something went wrong in the SyncPlay room.'
    );
  });

  it('unknown code + missing/blank message degrades to the generic fallback', () => {
    expect(describeSyncPlayError('FUTURE_SERVER_CODE')).toBe(
      'Something went wrong in the SyncPlay room.'
    );
    expect(describeSyncPlayError('FUTURE_SERVER_CODE', '   ')).toBe(
      'Something went wrong in the SyncPlay room.'
    );
    expect(describeSyncPlayError(undefined, undefined)).toBe(
      'Something went wrong in the SyncPlay room.'
    );
  });

  it('undefined code still surfaces the server message', () => {
    expect(describeSyncPlayError(undefined, 'frame carried no code')).toBe(
      'frame carried no code'
    );
  });
});
