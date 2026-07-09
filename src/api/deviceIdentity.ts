/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/deviceIdentity.ts
//
// Stable per-install device identity used for the Phlix device headers
// (`X-Phlix-Device-ID` / `X-Phlix-Device-Name` / `X-Phlix-Device-Type`) and the
// login device-binding header (`X-Device-Id`).
//
// The device id is a v4 UUID persisted in AsyncStorage under `phlix_device_id`.
// It is generated once on first access and reused forever after.
//
// `buildPhlixHeaders` (from `@phlix/contracts`) is synchronous and runs on every
// outgoing request, so `client.ts` needs the id WITHOUT awaiting. To bridge the
// async AsyncStorage read with the sync header build, we cache the resolved id in
// a module-level variable. `initDeviceIdentity()` is called once at app boot to
// populate it; `getCachedDeviceId()` then returns it synchronously. Until the
// boot resolve completes (or if it is never called) callers fall back to a
// stable in-memory temporary id so requests are never sent with an empty value.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'phlix_device_id';

/** Generate an RFC-4122 v4 UUID using Math.random (no native crypto needed). */
/* eslint-disable no-bitwise -- canonical v4 UUID bit-twiddling */
const generateUuid = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
/* eslint-enable no-bitwise */

// In-memory fallback used before the persisted id resolves at boot. Generated
// once per process so every fallback request in a session shares one value.
const TEMP_DEVICE_ID = generateUuid();

let cachedDeviceId: string | null = null;
let resolvePromise: Promise<string> | null = null;

/**
 * Resolve the persisted device id, generating + persisting one on first call.
 * Idempotent: concurrent callers share a single AsyncStorage round-trip.
 */
export const getDeviceId = async (): Promise<string> => {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }
  if (resolvePromise) {
    return resolvePromise;
  }

  resolvePromise = (async () => {
    try {
      const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (stored && stored.trim() !== '') {
        cachedDeviceId = stored;
        return stored;
      }
      const fresh = generateUuid();
      await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
      cachedDeviceId = fresh;
      return fresh;
    } catch {
      // AsyncStorage failure: fall back to the in-memory temp id for this run.
      cachedDeviceId = TEMP_DEVICE_ID;
      return TEMP_DEVICE_ID;
    } finally {
      resolvePromise = null;
    }
  })();

  return resolvePromise;
};

/**
 * Synchronous accessor for the device id, for the per-request header builder.
 * Returns the resolved+cached id, or the in-memory temp id if boot resolution
 * has not finished yet.
 */
export const getCachedDeviceId = (): string => cachedDeviceId ?? TEMP_DEVICE_ID;

/** Human-friendly device name sent as `X-Phlix-Device-Name`. */
export const getDeviceName = (): string =>
  Platform.OS === 'ios' ? 'Phlix Mobile (ios)' : 'Phlix Mobile (android)';

/**
 * Kick off device-id resolution at app boot so `getCachedDeviceId()` returns the
 * real persisted value for subsequent requests. Safe to call multiple times.
 */
export const initDeviceIdentity = async (): Promise<void> => {
  await getDeviceId();
};
