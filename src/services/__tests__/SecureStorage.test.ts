/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/services/__tests__/SecureStorage.test.ts
/**
 * Token-vault law (audit M1): BOTH JWTs live in the OS keychain, AsyncStorage
 * never holds a token after a read/write cycle, and a pre-vault session
 * migrates exactly once — read → secure-write → delete-plaintext, never
 * orphaning the session when the secure write fails.
 *
 * The keychain is the in-memory stand-in installed by jest.setup.js
 * (`__resetKeychainMock`); per-service values are observed through
 * getGenericPassword calls.
 */

import { secureStorage } from '../SecureStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The global setup mock does not auto-apply to this file's typed surface —
// pull the seeded store helpers from it.
const keychainMock = jest.requireMock('react-native-keychain') as {
  __resetKeychainMock: () => void;
  getGenericPassword: jest.Mock;
  setGenericPassword: jest.Mock;
};

describe('SecureStorage (token vault)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    keychainMock.__resetKeychainMock();
    await AsyncStorage.clear();
    secureStorage.__resetMigrationLatchForTests();
  });

  describe('storeTokens / reads', () => {
    it('keeps BOTH tokens in keychain slots and sweeps the legacy AsyncStorage keys', async () => {
      await AsyncStorage.setItem('access_token', 'stale-leftover');
      await AsyncStorage.setItem('refresh_token', 'stale-leftover-r');

      await secureStorage.storeTokens('access123', 'refresh456');

      expect(await secureStorage.getAccessToken()).toBe('access123');
      expect(await secureStorage.getRefreshToken()).toBe('refresh456');

      // Nothing plaintext remains: the legacy keys are swept on write, so a
      // stale copy can never resurrect over the fresh login.
      expect(await AsyncStorage.getItem('access_token')).toBeNull();
      expect(await AsyncStorage.getItem('refresh_token')).toBeNull();
    });

    it('writes the two slots separately so a leak of one is not a leak of both', async () => {
      await secureStorage.storeTokens('a-tok', 'r-tok');

      const services = keychainMock.setGenericPassword.mock.calls.map(
        (call) => (call[2] as { service: string }).service
      );
      expect(services).toEqual(
        expect.arrayContaining(['com.phlix.mobile.access', 'com.phlix.mobile.refresh'])
      );
    });

    it('propagates a keychain write failure (caller must not claim persistence)', async () => {
      keychainMock.setGenericPassword.mockRejectedValueOnce(new Error('Keychain error'));

      await expect(secureStorage.storeTokens('access', 'refresh')).rejects.toThrow(
        'Keychain error'
      );
    });
  });

  describe('one-time AsyncStorage migration', () => {
    it('moves a pre-vault session into the keychain and deletes the plaintext', async () => {
      await AsyncStorage.setItem('access_token', 'legacy-access');
      await AsyncStorage.setItem('refresh_token', 'legacy-refresh');

      expect(await secureStorage.getAccessToken()).toBe('legacy-access');
      expect(await secureStorage.getRefreshToken()).toBe('legacy-refresh');

      // Post-migration, the plaintext keys are gone but the vault answers.
      expect(await AsyncStorage.getItem('access_token')).toBeNull();
      expect(await AsyncStorage.getItem('refresh_token')).toBeNull();
    });

    it('never orphans: a failed secure write leaves the plaintext copy in place for retry', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        await AsyncStorage.setItem('access_token', 'legacy-access');

        // The FIRST keychain write of the migration is the access slot; make
        // that one attempt fail (transient keychain outage).
        keychainMock.setGenericPassword.mockRejectedValueOnce(new Error('keychain outage'));

        // Migration fails → getAccessToken finds an empty vault…
        expect(await secureStorage.getAccessToken()).toBeNull();
        // …but the plaintext session is STILL THERE (never deleted first).
        expect(await AsyncStorage.getItem('access_token')).toBe('legacy-access');

        // Next read: the failure reset the latch, the retry (base in-memory
        // implementation) succeeds and only THEN the plaintext goes.
        expect(await secureStorage.getAccessToken()).toBe('legacy-access');
        expect(await AsyncStorage.getItem('access_token')).toBeNull();
      } finally {
        errorSpy.mockRestore();
      }
    });

    it('a stored vault value outranks a stale plaintext copy (no resurrection)', async () => {
      await secureStorage.storeTokens('fresh-access', 'fresh-refresh');
      await AsyncStorage.setItem('access_token', 'stale-plaintext');
      secureStorage.__resetMigrationLatchForTests();

      expect(await secureStorage.getAccessToken()).toBe('fresh-access');
      // The stale copy is still swept (the vault already holds the truth).
      expect(await AsyncStorage.getItem('access_token')).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('wipes BOTH keychain slots and BOTH legacy keys', async () => {
      await AsyncStorage.setItem('access_token', 'pre-migration');
      await secureStorage.storeTokens('access123', 'refresh456');

      await secureStorage.clearTokens();

      expect(await secureStorage.getAccessToken()).toBeNull();
      expect(await secureStorage.getRefreshToken()).toBeNull();
      expect(await AsyncStorage.getItem('access_token')).toBeNull();
      expect(await AsyncStorage.getItem('refresh_token')).toBeNull();
    });
  });

  describe('enableBiometric', () => {
    it('stores biometric enabled flag in Keychain', async () => {
      const result = await secureStorage.enableBiometric();
      expect(result).toBe(true);
      expect(keychainMock.setGenericPassword).toHaveBeenCalledWith(
        'biometric_enabled',
        'true',
        expect.objectContaining({
          service: 'com.phlix.mobile.biometric',
          accessControl: 'BiometryAny',
        })
      );
    });

    it('returns false when Keychain enableBiometric fails', async () => {
      keychainMock.setGenericPassword.mockRejectedValueOnce(new Error('Biometric error'));
      const result = await secureStorage.enableBiometric();
      expect(result).toBe(false);
    });
  });

  describe('isBiometricEnabled', () => {
    it('reflects the biometric service slot', async () => {
      const result = await secureStorage.isBiometricEnabled();
      expect(result).toBe(false); // empty mock store

      // Seed the biometric service slot directly through the same API.
      await keychainMock.setGenericPassword('biometric_enabled', 'true', {
        service: 'com.phlix.mobile.biometric',
      });
      expect(await secureStorage.isBiometricEnabled()).toBe(true);
    });

    it('returns false when Keychain check throws', async () => {
      keychainMock.getGenericPassword.mockRejectedValueOnce(new Error('Keychain error'));
      const result = await secureStorage.isBiometricEnabled();
      expect(result).toBe(false);
    });
  });

  describe('authenticateWithBiometric', () => {
    it('returns true when credentials retrieved with auth prompt', async () => {
      await keychainMock.setGenericPassword('phlix', 'refresh-token', {
        service: 'com.phlix.mobile.refresh',
      });

      const result = await secureStorage.authenticateWithBiometric();

      expect(result).toBe(true);
      expect(keychainMock.getGenericPassword).toHaveBeenCalledWith({
        service: 'com.phlix.mobile.refresh',
        authenticationPrompt: {
          title: 'Authenticate to access Phlix',
          subtitle: 'Use biometric authentication',
          cancel: 'Cancel',
        },
      });
    });

    it('returns false when no credentials found', async () => {
      const result = await secureStorage.authenticateWithBiometric();
      expect(result).toBe(false);
    });

    it('returns false when authentication throws', async () => {
      keychainMock.getGenericPassword.mockRejectedValueOnce(new Error('Auth failed'));
      const result = await secureStorage.authenticateWithBiometric();
      expect(result).toBe(false);
    });
  });
});
