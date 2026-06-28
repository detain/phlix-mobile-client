// src/screens/webauthn/__tests__/webauthnHelpers.test.ts
import {
  passkeyLabel,
  lastUsedLabel,
  webauthnErrorMessage,
  cleanUsername,
} from '../webauthnHelpers';

describe('passkeyLabel', () => {
  it('prefers a non-empty name', () => {
    expect(passkeyLabel({ id: 'abcdefgh123', name: 'My Phone' })).toBe('My Phone');
  });

  it('trims the name', () => {
    expect(passkeyLabel({ id: 'x', name: '  Tablet  ' })).toBe('Tablet');
  });

  it('falls back to a short id-derived label when name is blank', () => {
    expect(passkeyLabel({ id: 'abcdefgh123456', name: '' })).toBe(
      'Passkey abcdefgh'
    );
    expect(passkeyLabel({ id: 'abcdefgh123456', name: '   ' })).toBe(
      'Passkey abcdefgh'
    );
  });

  it('returns generic "Passkey" when both name and id are blank', () => {
    expect(passkeyLabel({ id: '', name: '' })).toBe('Passkey');
  });
});

describe('lastUsedLabel', () => {
  it('returns "Never used" for null/empty/undefined', () => {
    expect(lastUsedLabel(null)).toBe('Never used');
    expect(lastUsedLabel(undefined)).toBe('Never used');
    expect(lastUsedLabel('   ')).toBe('Never used');
  });

  it('returns the raw timestamp otherwise', () => {
    expect(lastUsedLabel('2026-06-10T00:00:00Z')).toBe('2026-06-10T00:00:00Z');
  });
});

describe('webauthnErrorMessage', () => {
  it('handles null/undefined', () => {
    expect(webauthnErrorMessage(null)).toMatch(/went wrong/i);
    expect(webauthnErrorMessage(undefined)).toMatch(/went wrong/i);
  });

  it('reads an axios envelope message', () => {
    expect(
      webauthnErrorMessage({ response: { data: { message: 'Bad challenge' } } })
    ).toBe('Bad challenge');
  });

  it('reads an axios envelope error when message is absent', () => {
    expect(
      webauthnErrorMessage({ response: { data: { error: 'Forbidden' } } })
    ).toBe('Forbidden');
  });

  it('maps cancellation messages to a friendly cancel string', () => {
    expect(webauthnErrorMessage(new Error('The user canceled the request'))).toMatch(
      /cancelled/i
    );
    expect(webauthnErrorMessage(new Error('NotAllowedError'))).toMatch(/cancelled/i);
    expect(webauthnErrorMessage(new Error('AbortError occurred'))).toMatch(
      /cancelled/i
    );
  });

  it('maps unavailable messages', () => {
    expect(
      webauthnErrorMessage(new Error('Passkeys are not available on this device.'))
    ).toMatch(/not available/i);
  });

  it('falls back to the raw Error message', () => {
    expect(webauthnErrorMessage(new Error('Network timeout'))).toBe(
      'Network timeout'
    );
  });
});

describe('cleanUsername', () => {
  it('trims and returns a non-empty username', () => {
    expect(cleanUsername('  alice ')).toBe('alice');
  });

  it('returns null for empty/whitespace', () => {
    expect(cleanUsername('')).toBeNull();
    expect(cleanUsername('   ')).toBeNull();
  });
});
