/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/useAuthStore.targetWipe.test.ts
//
// Review mobile__exploiter M1 — target-change session teardown. `useAuthStore`
// installs a module-level subscription on the settings store: the instant the
// dialled server's HOST changes (a typed login address, even if the login
// later fails), the vault is wiped and the store drops to signed-out, so a
// credential minted for host A can never ride to a freshly-chosen host B.
//
// This uses the REAL settings store and REAL keychain-backed vault (the
// in-memory keychain stand-in from jest.setup.js) — the law lives in the
// wiring between them, which the store-level unit suite (useAuthStore.test.ts)
// mocks away.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '../useSettingsStore';
import { useAuthStore } from '../useAuthStore';
import { secureStorage } from '../../services/SecureStorage';

const keychainMock = jest.requireMock('react-native-keychain') as {
  __resetKeychainMock: () => void;
};

// Let the `void secureStorage.clearTokens()` the subscription fires settle.
const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
};

const mockUser = { id: 'u1', username: 'bob' };

describe('useAuthStore target-change teardown (review mobile__exploiter M1)', () => {
  beforeEach(async () => {
    keychainMock.__resetKeychainMock();
    await AsyncStorage.clear();
    // Reset the dial target to a known-clean "no host bound" baseline.
    await useSettingsStore.getState().setServerUrl('');
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    await flush();
  });

  it('wipes the vault and signs out when the dialled host changes', async () => {
    // Establish a live, authenticated session bound to host A.
    await useSettingsStore.getState().setServerUrl('https://a.example');
    await secureStorage.storeTokens('acc-a', 'ref-a', 'https://a.example');
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });

    expect(await secureStorage.getAccessToken()).toBe('acc-a');
    expect(await secureStorage.getIssuedHost()).toBe('a.example');

    // The phishing gesture: type a DIFFERENT server address.
    await useSettingsStore.getState().setServerUrl('https://b.example');
    await flush();

    // Vault gone AND the UI state dropped — no stale A-token can reach B, and
    // no phantom-authenticated screen survives the switch.
    expect(await secureStorage.getAccessToken()).toBeNull();
    expect(await secureStorage.getRefreshToken()).toBeNull();
    expect(await secureStorage.getIssuedHost()).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('does NOT tear the session down for a same-host re-entry (no false wipe)', async () => {
    await useSettingsStore.getState().setServerUrl('https://a.example');
    await secureStorage.storeTokens('acc-a', 'ref-a', 'https://a.example');
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });

    // Re-saving the SAME host (e.g. a retried login, a normalized rewrite)
    // must not nuke a live session — identity is hostOf, not string equality.
    await useSettingsStore.getState().setServerUrl('https://a.example');
    await flush();

    expect(await secureStorage.getAccessToken()).toBe('acc-a');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('treats scheme/port-only differences as the SAME host (hostOf identity)', async () => {
    await useSettingsStore.getState().setServerUrl('https://a.example');
    await secureStorage.storeTokens('acc-a', 'ref-a', 'https://a.example');
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });

    // hostOf ignores port + path; `a.example:8443` and `a.example` are the
    // same machine identity — no teardown for a port hop.
    await useSettingsStore.getState().setServerUrl('https://a.example:8443');
    await flush();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(await secureStorage.getAccessToken()).toBe('acc-a');
  });
});
