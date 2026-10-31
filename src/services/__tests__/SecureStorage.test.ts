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

      await secureStorage.storeTokens('access123', 'refresh456', 'login.example');

      expect(await secureStorage.getAccessToken()).toBe('access123');
      expect(await secureStorage.getRefreshToken()).toBe('refresh456');

      // Nothing plaintext remains: the legacy keys are swept on write, so a
      // stale copy can never resurrect over the fresh login.
      expect(await AsyncStorage.getItem('access_token')).toBeNull();
      expect(await AsyncStorage.getItem('refresh_token')).toBeNull();
    });

    it('writes the two slots separately so a leak of one is not a leak of both', async () => {
      await secureStorage.storeTokens('a-tok', 'r-tok', 'login.example');

      const services = keychainMock.setGenericPassword.mock.calls.map(
        (call) => (call[2] as { service: string }).service
      );
      expect(services).toEqual(
        expect.arrayContaining(['com.phlix.mobile.access', 'com.phlix.mobile.refresh'])
      );
    });

    it('propagates a keychain write failure (caller must not claim persistence)', async () => {
      keychainMock.setGenericPassword.mockRejectedValueOnce(new Error('Keychain error'));

      await expect(secureStorage.storeTokens('access', 'refresh', 'login.example')).rejects.toThrow(
        'Keychain error'
      );
    });
  });

  describe('minted-host pin (review mobile__exploiter M2)', () => {
    it('records which host minted the pair, normalized through the shared parser', async () => {
      await secureStorage.storeTokens('a', 'b', 'https://Login.Example:32400');
      expect(await secureStorage.getIssuedHost()).toBe('login.example');
    });

    it('accepts a bare hostname from the caller', async () => {
      await secureStorage.storeTokens('a', 'b', 'home.lan');
      expect(await secureStorage.getIssuedHost()).toBe('home.lan');
    });

    it('refuses to store a pair without a minting host (fail fast, nothing lands)', async () => {
      await expect(secureStorage.storeTokens('a', 'b', '   ')).rejects.toThrow(/minting host/);
      expect(await secureStorage.getAccessToken()).toBeNull();
    });

    it('clearTokens wipes the pin alongside the pair — never an orphaned minted host', async () => {
      await secureStorage.storeTokens('a', 'b', 'login.example');
      await secureStorage.clearTokens();
      expect(await secureStorage.getIssuedHost()).toBeNull();
    });

    it('a migrated pre-vault session has NO pin — getIssuedHost stays null (dial lane fails closed)', async () => {
      await AsyncStorage.setItem('access_token', 'legacy-access');
      await AsyncStorage.setItem('refresh_token', 'legacy-refresh');

      expect(await secureStorage.getAccessToken()).toBe('legacy-access');
      expect(await secureStorage.getIssuedHost()).toBeNull();
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
      await secureStorage.storeTokens('fresh-access', 'fresh-refresh', 'login.example');
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
      await secureStorage.storeTokens('access123', 'refresh456', 'login.example');

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
    it('reads the OS-protected MARKER slot with the auth prompt (M-MOBILE-33)', async () => {
      await keychainMock.setGenericPassword('biometric_enabled', 'true', {
        service: 'com.phlix.mobile.biometric',
        accessControl: 'BiometryAny',
      });

      const result = await secureStorage.authenticateWithBiometric();

      expect(result).toBe(true);
      expect(keychainMock.getGenericPassword).toHaveBeenCalledWith({
        service: 'com.phlix.mobile.biometric',
        authenticationPrompt: {
          title: 'Authenticate to access Phlix',
          subtitle: 'Use biometric authentication',
          cancel: 'Cancel',
        },
      });
    });

    it('allows entry when no gate is armed (marker slot absent)', async () => {
      // The gate must not exist by default: an absent marker resolves the
      // protected read to `false` (no throw) and the caller proceeds —
      // byte-identical cold-start behavior to pre-feature installs.
      const result = await secureStorage.authenticateWithBiometric();
      expect(result).toBe(true);
    });

    it('returns false when authentication throws', async () => {
      // Armed slot + cancelled/rejected biometric ⇒ the protected read throws:
      // the vault stays closed this launch.
      keychainMock.getGenericPassword.mockRejectedValueOnce(new Error('Auth failed'));
      const result = await secureStorage.authenticateWithBiometric();
      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // M-MOBILE-05 (review mobile__crossfe.md M2): the vault law extends to the
  // HUB session pair — hub sign-in mints its own access+refresh JWTs and
  // `store/hubStore.ts` used to persist them plaintext in its AsyncStorage
  // blob. Hub lanes get their own slots, `.hub.`-namespaced so neither lane
  // can clobber the other.
  // ---------------------------------------------------------------------------
  describe('hub session slots (M-MOBILE-05)', () => {
    it('storeHubTokens writes the two hub-scoped services — never the server pair, never bare keys', async () => {
      await secureStorage.storeHubTokens('hub-a', 'hub-r');

      const services = keychainMock.setGenericPassword.mock.calls.map(
        (call) => (call[2] as { service: string }).service
      );
      expect(services).toEqual(
        expect.arrayContaining([
          'com.phlix.mobile.hub.access',
          'com.phlix.mobile.hub.refresh',
        ])
      );
      expect(services).not.toContain('com.phlix.mobile.access');
      expect(services).not.toContain('com.phlix.mobile.refresh');
      expect(await AsyncStorage.getItem('access_token')).toBeNull();
      expect(await AsyncStorage.getItem('refresh_token')).toBeNull();
    });

    it('hub and server pairs occupy separate slots (one lane cannot read the other)', async () => {
      await secureStorage.storeHubTokens('hub-a', 'hub-r');
      expect(await secureStorage.getHubAccessToken()).toBe('hub-a');
      expect(await secureStorage.getHubRefreshToken()).toBe('hub-r');
      expect(await secureStorage.getAccessToken()).toBeNull();

      await secureStorage.storeTokens('srv-a', 'srv-r', 'srv.example');
      expect(await secureStorage.getAccessToken()).toBe('srv-a');
      expect(await secureStorage.getHubAccessToken()).toBe('hub-a');
    });

    it('clearHubTokens wipes ONLY the hub pair — the server vault survives', async () => {
      await secureStorage.storeTokens('srv-a', 'srv-r', 'srv.example');
      await secureStorage.storeHubTokens('hub-a', 'hub-r');

      await secureStorage.clearHubTokens();

      expect(await secureStorage.getHubAccessToken()).toBeNull();
      expect(await secureStorage.getHubRefreshToken()).toBeNull();
      expect(await secureStorage.getAccessToken()).toBe('srv-a');
      expect(await secureStorage.getRefreshToken()).toBe('srv-r');
    });

    it('clearTokens (server sign-out) does not wipe the hub pair', async () => {
      await secureStorage.storeHubTokens('hub-a', 'hub-r');

      await secureStorage.clearTokens();

      expect(await secureStorage.getHubAccessToken()).toBe('hub-a');
      expect(await secureStorage.getHubRefreshToken()).toBe('hub-r');
    });
  });

  // Vault WRITE-ORDERING law (review mobile__exploiter M1): the target-change
  // teardown fires `clearTokens()` synchronously from a store subscription,
  // and the very same user gesture can complete a login whose success leg
  // stores a fresh pair. Unchained, the wipe's trailing resets delete the
  // just-written slots (and its multiRemove sweeps the just-set host pin),
  // orphaning the new session — a login that "fails" by immediately losing
  // its tokens. The chain makes call order the law.
  describe('write ordering (chain)', () => {
    it('a pending wipe cannot erase a session stored behind it', async () => {
      const keychain = jest.requireMock('react-native-keychain') as {
        resetGenericPassword: jest.Mock;
      };
      const original = keychain.resetGenericPassword;
      let releaseFirst!: () => void;
      const held = new Promise<false>((resolve) => {
        releaseFirst = () => resolve(false);
      });
      let gateUsed = false;
      keychain.resetGenericPassword = jest.fn((options?: { service?: string }) => {
        if (!gateUsed) {
          gateUsed = true;
          return held.then(() => original(options));
        }
        return original(options);
      }) as jest.Mock;

      try {
        // Wipe FIRST (blocked inside its gated reset), issuance BEHIND it.
        // eslint-disable-next-line no-void -- intentional fire-and-forget: the test drives the chain's ordering
        void secureStorage.clearTokens();
        const issued = secureStorage.storeTokens(
          'fresh',
          'fresh-ref',
          'https://srv-a.example'
        );
        await Promise.resolve();
        await Promise.resolve();
        releaseFirst();
        await issued;

        expect(await secureStorage.getAccessToken()).toBe('fresh');
        expect(await secureStorage.getRefreshToken()).toBe('fresh-ref');
        expect(await secureStorage.getIssuedHost()).toBe('srv-a.example');
      } finally {
        keychain.resetGenericPassword = original;
      }
    });

    it('a wipe issued after a store still wins (FIFO, not last-call-hijack)', async () => {
      await secureStorage.storeTokens('acc', 'ref', 'https://srv-a.example');
      await secureStorage.clearTokens();

      expect(await secureStorage.getAccessToken()).toBeNull();
      expect(await secureStorage.getIssuedHost()).toBeNull();
    });
  });
});
