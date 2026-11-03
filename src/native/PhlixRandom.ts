/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/native/PhlixRandom.ts
//
// M7 (deferred lane): thin typed wrapper around the native `PhlixRandom`
// module (Android SecureRandom / iOS SecRandomCopyBytes). The contract is a
// soft one ON PURPOSE: this feeds device-identity generation, where the
// documented fallback (Math.random-shaped v4, pre-existing) must keep the app
// functional under Jest, before the native build exists, or on a reject. A
// hard-throwing wrapper would turn a nice-to-have entropy upgrade into a boot
// crash class. Every success path is still PARSED at this boundary: wrong
// shape === unavailable.
import { NativeModules } from 'react-native';
import type { PhlixRandomInterface } from './types';

function getNativeModule(): PhlixRandomInterface | undefined {
  return NativeModules.PhlixRandom as PhlixRandomInterface | undefined;
}

/**
 * `byteCount` CSPRNG bytes as lowercase hex, or null when the native source
 * is unavailable (module absent / bridge reject / malformed return).
 */
export async function nativeRandomHex(byteCount: number): Promise<string | null> {
  const native = getNativeModule();
  if (!native) {
    return null;
  }
  try {
    const hex = await native.randomHex(byteCount);
    if (typeof hex !== 'string' || hex.length !== byteCount * 2 || !/^[0-9a-f]+$/.test(hex)) {
      return null; // a malformed native return is as good as no native at all
    }
    return hex;
  } catch {
    return null;
  }
}
