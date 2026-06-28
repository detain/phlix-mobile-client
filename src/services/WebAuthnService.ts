// src/services/WebAuthnService.ts
//
// WebAuthn / passkey ceremony orchestration (slice E10e).
//
// Ties together the three pieces:
//   1. WebAuthnManager — the HTTP options/verify endpoints.
//   2. PhlixWebAuthn (native wrapper) — the on-device attestation/assertion
//      ceremony (iOS ASAuthorization / Android Credential Manager).
//   3. AuthManager + useAuthStore — the SAME credential store + auth state
//      password login uses, so a passwordless login lands the app in the
//      identical authenticated state.
//
// The base64url plumbing stays on the native side. JS just shuttles JSON
// strings: the server's options object → JSON string → native → response JSON
// string → parsed object → verify endpoint.
import { webAuthnManager } from '../api/WebAuthnManager';
import { authManager } from '../api/AuthManager';
import { useAuthStore } from '../stores/useAuthStore';
import * as PhlixWebAuthn from '../native/PhlixWebAuthn';
import type {
  PasskeyCredential,
  RegistrationResult,
} from '../types/webauthn';

class WebAuthnService {
  /**
   * Whether platform passkeys are available on this device. Never throws —
   * resolves false when the native module is absent or the platform reports no
   * authenticator.
   */
  async isSupported(): Promise<boolean> {
    return PhlixWebAuthn.isSupported();
  }

  /**
   * Register a new passkey for the CURRENT (logged-in) user.
   * Flow: registerOptions (BEARER) → native.register (attestation ceremony) →
   * registerVerify (BEARER, echoing the challenge through).
   * @param name Optional display name / username hint for the credential.
   * @returns The server's RegistrationResult ({ credential_id, message }).
   */
  async registerPasskey(name?: string): Promise<RegistrationResult> {
    // 1. Ask the server for creation options (raw WebAuthn JSON).
    const options = await webAuthnManager.registerOptions(name);

    // 2. Run the on-device attestation ceremony. The native module takes the
    //    options as a JSON string and returns the attestation credential JSON.
    const credentialJson = await PhlixWebAuthn.register(JSON.stringify(options));
    const credential = JSON.parse(credentialJson) as Record<string, unknown>;

    // 3. Verify with the server, echoing the original challenge back so the
    //    server can match it to the issued options.
    return webAuthnManager.registerVerify(credential, options.challenge);
  }

  /**
   * Passwordless login with a passkey.
   * Flow: loginOptions (PRE-AUTH) → native.authenticate (assertion ceremony) →
   * loginVerify (PRE-AUTH → token envelope) → persist tokens + set auth store.
   * On success the auth gate (RootNavigator reads useAuthStore) navigates as
   * usual — identical to password login.
   * @param username The account to sign in as.
   */
  async loginWithPasskey(username: string): Promise<void> {
    // 1. Ask the server for request options (raw WebAuthn JSON).
    const options = await webAuthnManager.loginOptions(username);

    // 2. Run the on-device assertion ceremony.
    const assertionJson = await PhlixWebAuthn.authenticate(
      JSON.stringify(options)
    );
    const credential = JSON.parse(assertionJson) as Record<string, unknown>;

    // 3. Verify with the server → token envelope (same shape password login
    //    returns).
    const result = await webAuthnManager.loginVerify(
      username,
      credential,
      options.challenge
    );

    // 4. Persist via the SAME credential path password login uses, then flip the
    //    auth store so the navigator swaps Login → Main.
    const user = await authManager.savePasskeyLogin(result);
    useAuthStore.getState().setUser(user);
    useAuthStore.setState({ isAuthenticated: true, isLoading: false, error: null });
  }

  /** List the current user's registered passkeys. */
  async listPasskeys(): Promise<PasskeyCredential[]> {
    return webAuthnManager.getCredentials();
  }

  /** Delete a registered passkey by id. */
  async deletePasskey(id: string): Promise<void> {
    return webAuthnManager.deleteCredential(id);
  }
}

export const webAuthnService = new WebAuthnService();
export default webAuthnService;
