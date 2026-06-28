// src/native/PhlixWebAuthn.ts
//
// Typed JS wrapper around the native `PhlixWebAuthn` module (slice E10e).
//
// Guards every native access so JS + Jest run WITHOUT the native module present:
//   - isSupported() resolves `false` (never throws) when the module is absent,
//     so the UI simply hides the passkey affordances.
//   - register()/authenticate() reject with a clear "passkeys unavailable"
//     error when the module is absent, so a caller that bypassed the
//     is-supported gate fails loudly instead of crashing the bridge.
//
// The bridge is thin: the server's WebAuthn options go in as a JSON string and
// the authenticator's response comes back as a JSON string. All base64url
// encoding/decoding happens natively.
import { NativeModules } from 'react-native';
import type { PhlixWebAuthnInterface } from './types';

/** Error thrown when a ceremony is requested but no native authenticator exists. */
export const PASSKEYS_UNAVAILABLE_MESSAGE =
  'Passkeys are not available on this device.';

function getNativeModule(): PhlixWebAuthnInterface | undefined {
  return NativeModules.PhlixWebAuthn as PhlixWebAuthnInterface | undefined;
}

/**
 * Whether platform passkeys are available. Resolves `false` (never rejects) when
 * the native module is missing OR when the device reports no platform
 * authenticator.
 */
export async function isSupported(): Promise<boolean> {
  const native = getNativeModule();
  if (!native) {
    return false;
  }
  try {
    return await native.isSupported();
  } catch {
    return false;
  }
}

/**
 * Run the registration (attestation) ceremony. Throws if no native module is
 * present.
 * @param optionsJson Raw creation-options JSON string from the server.
 * @returns The attestation credential JSON string from the authenticator.
 */
export async function register(optionsJson: string): Promise<string> {
  const native = getNativeModule();
  if (!native) {
    throw new Error(PASSKEYS_UNAVAILABLE_MESSAGE);
  }
  return native.register(optionsJson);
}

/**
 * Run the authentication (assertion) ceremony. Throws if no native module is
 * present.
 * @param optionsJson Raw request-options JSON string from the server.
 * @returns The assertion JSON string from the authenticator.
 */
export async function authenticate(optionsJson: string): Promise<string> {
  const native = getNativeModule();
  if (!native) {
    throw new Error(PASSKEYS_UNAVAILABLE_MESSAGE);
  }
  return native.authenticate(optionsJson);
}

export default { isSupported, register, authenticate };
