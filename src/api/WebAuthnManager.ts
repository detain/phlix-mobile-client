// src/api/WebAuthnManager.ts
import apiClient from './client';
import type {
  CreationOptions,
  RequestOptions,
  RegistrationResult,
  AuthResult,
  PasskeyCredential,
} from '../types/webauthn';

/**
 * WebAuthn / passkeys API surface (slice E10e) — `WebAuthnController`.
 *
 * The apiClient baseURL already adds `/api/v1`, so paths start `/auth/webauthn`
 * and `/me/webauthn`.
 *
 * Two auth contexts:
 *   - register/options + register/verify + list + delete are BEARER-gated (the
 *     user is already logged in and is adding/managing a passkey).
 *   - login/options + login/verify are PRE-AUTH (passwordless sign-in) — no
 *     bearer token; the verify step RETURNS the token envelope.
 *
 * The options endpoints return the server's raw WebAuthn options JSON
 * (PublicKeyCredentialCreation/Request options) where binary fields are
 * base64url strings. The ceremony orchestration (WebAuthnService) hands that
 * object, as a JSON string, straight to the native authenticator and posts the
 * authenticator's response (also JSON) back to the verify endpoints — JS never
 * touches the base64url plumbing.
 *
 * Field names are the server payload verbatim (snake_case); do NOT camelCase.
 *
 * Errors bubble — the service/store owns the try/catch.
 */
class WebAuthnManager {
  // POST /api/v1/auth/webauthn/register/options (BEARER)
  // body { username? } → PublicKeyCredentialCreationOptions JSON (raw).
  async registerOptions(username?: string): Promise<CreationOptions> {
    const body = username !== undefined ? { username } : {};
    return apiClient.post<CreationOptions>('/auth/webauthn/register/options', body);
  }

  // POST /api/v1/auth/webauthn/register/verify (BEARER)
  // body { credential, challenge } → { credential_id, message }.
  // `credential` is the native attestation object (already parsed from the JSON
  // string the native module returned); `challenge` is the base64url challenge
  // from the creation options, echoed back so the server can verify it.
  async registerVerify(
    credential: Record<string, unknown>,
    challenge: string
  ): Promise<RegistrationResult> {
    return apiClient.post<RegistrationResult>('/auth/webauthn/register/verify', {
      credential,
      challenge,
    });
  }

  // POST /api/v1/auth/webauthn/login/options (PRE-AUTH)
  // body { username } → PublicKeyCredentialRequestOptions JSON (raw).
  async loginOptions(username: string): Promise<RequestOptions> {
    return apiClient.post<RequestOptions>('/auth/webauthn/login/options', {
      username,
    });
  }

  // POST /api/v1/auth/webauthn/login/verify (PRE-AUTH)
  // body { username, credential, challenge } → { access_token, refresh_token, user }.
  // `credential` is the native assertion object; the SAME token envelope
  // password login returns.
  async loginVerify(
    username: string,
    credential: Record<string, unknown>,
    challenge: string
  ): Promise<AuthResult> {
    return apiClient.post<AuthResult>('/auth/webauthn/login/verify', {
      username,
      credential,
      challenge,
    });
  }

  // GET /api/v1/me/webauthn/credentials (BEARER) → { credentials }
  async getCredentials(): Promise<PasskeyCredential[]> {
    const res = await apiClient.get<{ credentials: PasskeyCredential[] }>(
      '/me/webauthn/credentials'
    );
    return res.credentials;
  }

  // DELETE /api/v1/me/webauthn/credentials/{id} (BEARER) → { message } (discarded)
  async deleteCredential(id: string): Promise<void> {
    await apiClient.delete<{ message: string }>(
      `/me/webauthn/credentials/${encodeURIComponent(id)}`
    );
  }
}

export const webAuthnManager = new WebAuthnManager();
export default webAuthnManager;
