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
  describeSyncPlayRestError,
  isMappedSyncPlayCode,
} from '../../syncplay/syncplayErrors';

describe('syncplayErrors — registry coverage', () => {
  it('maps EVERY code in the contracts SyncPlayErrorCode union', () => {
    // Census anchors at contracts v0.5.3: 12 legacy SCREAMING (incl.
    // PROTOCOL_VERSION_MISMATCH) + 8 dotted twins — the 7th twin era grew to
    // 8 when v0.5.3 minted the RESERVED `syncplay.queue_limit_exceeded`
    // (registry 202→204). A registry bump moves these — and the loop below
    // only goes green once syncplayErrors.ts grows the missing sentence
    // (Record<SyncPlayErrorCode, string> makes omission a compile error too;
    // the v0.5.3 pin arrived exactly that way, TS2741 measured).
    expect(LEGACY_SYNCPLAY_ERROR_CODES).toHaveLength(12);
    expect(SYNCPLAY_TWIN_ERROR_CODES).toHaveLength(8);
    expect(SYNCPLAY_ERROR_CODES).toHaveLength(20);

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

describe('describeSyncPlayRestError — REST-envelope doctrine (R15-10)', () => {
  // The axios failure shape the /syncplay/groups rails actually throw:
  // transport prose on err.message, the real signal inside response.data.
  const restFailure = (data: unknown, message = 'Request failed with status code 400') =>
    Object.assign(new Error(message), { response: { data } });

  it('a catalog code in the body beats the server English text', () => {
    const err = restFailure({ error: 'Group is full', code: 'syncplay.group_full' });
    expect(describeSyncPlayRestError(err)).toBe('That SyncPlay room is full.');
  });

  it("reads the SPEC order: error_code before 'code'", () => {
    const err = restFailure({
      error_code: 'syncplay.invalid_password',
      code: 'syncplay.group_full',
    });
    expect(describeSyncPlayRestError(err)).toBe(
      'That password is not correct for this SyncPlay room.'
    );
  });

  it('unknown code degrades to the server error text, like the WS lane', () => {
    const err = restFailure({ error: 'Group not found', code: 'syncplay.future_code' });
    expect(describeSyncPlayRestError(err)).toBe('Group not found');
  });

  it('code-less envelope renders the server error text', () => {
    const err = restFailure({ error: 'Group name is required' });
    expect(describeSyncPlayRestError(err)).toBe('Group name is required');
  });

  it('never surfaces raw err.message — the defect this replaced', () => {
    const transport = 'Request failed with status code 503';
    expect(describeSyncPlayRestError(restFailure({}, transport))).toBe(
      'Something went wrong in the SyncPlay room.'
    );
    expect(describeSyncPlayRestError(new Error(transport))).toBe(
      'Something went wrong in the SyncPlay room.'
    );
  });

  it('bodyless and non-Error throws degrade to the generic fallback', () => {
    const generic = 'Something went wrong in the SyncPlay room.';
    expect(describeSyncPlayRestError('a bare string')).toBe(generic);
    expect(describeSyncPlayRestError(undefined)).toBe(generic);
    expect(describeSyncPlayRestError(null)).toBe(generic);
    // Non-JSON/html body: axios can hand back a raw string.
    expect(describeSyncPlayRestError(restFailure('<html>502 Bad Gateway</html>'))).toBe(generic);
  });

  it('non-string body fields are ignored, not rendered', () => {
    const err = restFailure({ error: { nested: true }, code: 42 });
    expect(describeSyncPlayRestError(err)).toBe('Something went wrong in the SyncPlay room.');
  });
});
