// src/screens/webauthn/webauthnHelpers.ts
//
// Pure (off-React) helpers for the WebAuthn / passkeys screens (slice E10e).
// No native, no I/O — fully unit-testable.
import type { PasskeyCredential } from '../../types/webauthn';

/**
 * Human label for a passkey row. Prefers the credential's `name`; falls back to
 * a short, stable label derived from the id when the name is blank.
 */
export function passkeyLabel(cred: Pick<PasskeyCredential, 'id' | 'name'>): string {
  const name = (cred.name ?? '').trim();
  if (name !== '') {
    return name;
  }
  const id = (cred.id ?? '').trim();
  if (id === '') {
    return 'Passkey';
  }
  // Show a short prefix so distinct unnamed passkeys are distinguishable.
  return `Passkey ${id.slice(0, 8)}`;
}

/**
 * "Last used" subtitle for a passkey row. `null`/empty → "Never used".
 * Returns the raw timestamp otherwise (the screen formats it via the shared
 * formatRelativeTime util — kept out of here so this stays pure/dependency-free).
 */
export function lastUsedLabel(lastUsedAt: string | null | undefined): string {
  if (!lastUsedAt || lastUsedAt.trim() === '') {
    return 'Never used';
  }
  return lastUsedAt;
}

/**
 * Maps a thrown ceremony/HTTP error to a friendly, user-facing message.
 * Covers the common cases: user-cancelled, passkeys unavailable, and an axios
 * error envelope (`error.response.data.message|error`). Falls back to the raw
 * Error message, then a generic string.
 */
export function webauthnErrorMessage(err: unknown): string {
  if (err == null) {
    return 'Something went wrong. Please try again.';
  }

  // Axios-style error envelope: { response: { data: { message | error } } }
  const maybeAxios = err as {
    response?: { data?: { message?: unknown; error?: unknown } };
    message?: unknown;
    code?: unknown;
  };
  const data = maybeAxios.response?.data;
  if (data) {
    if (typeof data.message === 'string' && data.message.trim() !== '') {
      return data.message;
    }
    if (typeof data.error === 'string' && data.error.trim() !== '') {
      return data.error;
    }
  }

  const raw =
    typeof maybeAxios.message === 'string' ? maybeAxios.message : String(err);
  const lowered = raw.toLowerCase();

  if (
    lowered.includes('cancel') ||
    lowered.includes('user_canceled') ||
    lowered.includes('not allowed') ||
    lowered.includes('notallowed') ||
    lowered.includes('aborterror')
  ) {
    return 'Passkey prompt was cancelled.';
  }
  if (lowered.includes('not available') || lowered.includes('unavailable')) {
    return 'Passkeys are not available on this device.';
  }

  return raw.trim() !== '' ? raw : 'Something went wrong. Please try again.';
}

/**
 * Validates the username for a passwordless login. Trims; non-empty required.
 * Returns the cleaned username, or null when invalid.
 */
export function cleanUsername(username: string): string | null {
  const trimmed = (username ?? '').trim();
  return trimmed === '' ? null : trimmed;
}
