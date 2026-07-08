/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/types/webauthn.ts
//
// WebAuthn / passkeys domain types (slice E10e).
//
// The server's `WebAuthnController` returns standard WebAuthn JSON
// (PublicKeyCredentialCreationOptions / PublicKeyCredentialRequestOptions),
// where all binary fields (challenge, user.id, allowCredentials[].id, ...) are
// **base64url** strings. We model the fields we need and otherwise keep the
// options loosely typed (`Record<string, unknown>` via index signatures) so the
// raw server object can be shuttled, verbatim, as a JSON string to the native
// authenticator (iOS ASAuthorization / Android Credential Manager) without any
// lossy re-shaping on the JS side.
//
// IMPORTANT: the base64url <-> binary plumbing lives entirely in native code.
// JS only passes JSON strings through. These types describe the JSON we read on
// the JS side (for documentation and the few fields we touch) — they are NOT a
// full WebAuthn spec model.

/**
 * A registered passkey credential, as returned by
 * `GET /me/webauthn/credentials` → `{ credentials: PasskeyCredential[] }`.
 * Field names are the server payload verbatim (snake_case).
 */
export interface PasskeyCredential {
  id: string;
  created_at: string;
  /** ISO timestamp of last use, or `null` when never used since registration. */
  last_used_at: string | null;
  /** Human label for the credential (e.g. device name). May be empty. */
  name: string;
}

/**
 * The relying-party block inside creation options. `id` is the rpId the native
 * authenticator scopes the passkey to (must match the associated-domain on iOS
 * / the assetlinks on Android for cross-device portability).
 */
export interface PublicKeyRp {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

/** The user block inside creation options (`id` is base64url). */
export interface PublicKeyUser {
  id: string;
  name?: string;
  displayName?: string;
  [key: string]: unknown;
}

/**
 * `PublicKeyCredentialCreationOptions` JSON returned by
 * `POST /auth/webauthn/register/options`. Binary fields are base64url strings.
 * Only the fields we may inspect are named; the rest ride along via the index
 * signature and are forwarded to the native side untouched.
 */
export interface CreationOptions {
  /** base64url challenge. */
  challenge: string;
  rp?: PublicKeyRp;
  user?: PublicKeyUser;
  pubKeyCredParams?: Array<{ type: string; alg: number }>;
  timeout?: number;
  attestation?: string;
  authenticatorSelection?: Record<string, unknown>;
  excludeCredentials?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/**
 * `PublicKeyCredentialRequestOptions` JSON returned by
 * `POST /auth/webauthn/login/options`. Binary fields are base64url strings.
 */
export interface RequestOptions {
  /** base64url challenge. */
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: Array<{ type: string; id: string; transports?: string[] }>;
  userVerification?: string;
  [key: string]: unknown;
}

/**
 * Result of `POST /auth/webauthn/register/verify`.
 */
export interface RegistrationResult {
  credential_id: string;
  message: string;
}

/**
 * Result of `POST /auth/webauthn/login/verify` — the SAME token envelope
 * password login returns. Stored via the existing AuthManager credential path
 * so a passkey login leaves the app in the identical authenticated state.
 */
export interface AuthResult {
  access_token: string;
  refresh_token: string;
  user: import('../api/AuthManager').User;
}
