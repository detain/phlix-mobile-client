/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/__tests__/AuthManager.test.ts
import { authManager } from '../AuthManager';
import apiClient, { getApiBaseUrl, absolutizeApiPath } from '../client';
import { secureStorage } from '../../services/SecureStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../client');
jest.mock('../deviceIdentity', () => ({
  getDeviceId: jest.fn(async () => 'device-uuid-1'),
}));

const keychainMock = jest.requireMock('react-native-keychain') as {
  __resetKeychainMock: () => void;
};

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const tokenEnvelope = {
  access_token: 'acc',
  refresh_token: 'ref',
  token_type: 'Bearer',
  expires_in: 3600,
  user: { id: 'u1', username: 'bob' },
};

describe('AuthManager', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    keychainMock.__resetKeychainMock();
    secureStorage.__resetMigrationLatchForTests();
    await AsyncStorage.clear();
    // The minting origin saveCredentials must pin: whatever base the API
    // client is aimed at when the auth response lands (review M2 pin).
    (getApiBaseUrl as jest.Mock).mockReturnValue('https://login.example/api/v1');
  });

  it('login POSTs /auth/login with body + X-Device-Id header and persists tokens to the vault', async () => {
    mockedClient.post.mockResolvedValue(tokenEnvelope);

    const res = await authManager.login('https://srv', 'bob', 'pw');

    expect(mockedClient.post).toHaveBeenCalledWith(
      '/auth/login',
      { username: 'bob', password: 'pw' },
      { headers: { 'X-Device-Id': 'device-uuid-1' } }
    );
    expect(res.token_type).toBe('Bearer');
    // M1 — the JWTs land in the keychain vault, NOT plaintext AsyncStorage.
    expect(await secureStorage.getAccessToken()).toBe('acc');
    expect(await secureStorage.getRefreshToken()).toBe('ref');
    expect(await AsyncStorage.getItem('access_token')).toBeNull();
    expect(await AsyncStorage.getItem('refresh_token')).toBeNull();
    // Only the non-secret user profile is a plaintext key.
    expect(JSON.parse((await AsyncStorage.getItem('user')) as string).username).toBe('bob');
    // No `server` is persisted from the response.
    expect(await AsyncStorage.getItem('server')).toBeNull();
    // The pair is pinned to its minting origin — the direct SyncPlay lane may
    // only ever dial THIS host with these tokens (review mobile__exploiter M2).
    expect(await secureStorage.getIssuedHost()).toBe('login.example');
  });

  it('register POSTs /auth/register and handles a pending status without saving tokens', async () => {
    mockedClient.post.mockResolvedValue({ status: 'pending', message: 'awaiting approval' });

    const res = await authManager.register('https://srv', 'bob', 'b@x.com', 'pw');

    expect(mockedClient.post).toHaveBeenCalledWith(
      '/auth/register',
      { username: 'bob', email: 'b@x.com', password: 'pw' },
      { headers: { 'X-Device-Id': 'device-uuid-1' } }
    );
    expect(res).toEqual({ status: 'pending', message: 'awaiting approval' });
    expect(await secureStorage.getAccessToken()).toBeNull();
  });

  it('register saves tokens when the token envelope is returned', async () => {
    mockedClient.post.mockResolvedValue(tokenEnvelope);

    await authManager.register('https://srv', 'bob', 'b@x.com', 'pw');

    expect(await secureStorage.getAccessToken()).toBe('acc');
  });

  it('refresh POSTs /auth/refresh with the refresh token', async () => {
    mockedClient.post.mockResolvedValue(tokenEnvelope);

    await authManager.refresh('ref-old');

    expect(mockedClient.post).toHaveBeenCalledWith('/auth/refresh', { refresh_token: 'ref-old' });
  });

  it('getMe GETs /auth/me and unwraps { user }', async () => {
    mockedClient.get.mockResolvedValue({ user: { id: 'u1', username: 'bob' } });

    const user = await authManager.getMe();

    expect(mockedClient.get).toHaveBeenCalledWith('/auth/me');
    expect(user.username).toBe('bob');
  });

  it('logout POSTs the root-level /auth/logout revoke leg, then clears local credentials', async () => {
    // M-MOBILE-53a flipped the old "no network logout" law: the root-level
    // route (OUTSIDE /api/v1 — hence the absolutized URL) performs real
    // server-side revocation whenever the bearer token is attached.
    await secureStorage.storeTokens('acc', 'ref', 'login.example');
    (absolutizeApiPath as jest.Mock).mockReturnValue('https://login.example/auth/logout');

    await authManager.logout();

    expect(mockedClient.post).toHaveBeenCalledWith('https://login.example/auth/logout', {});
    expect(await secureStorage.getAccessToken()).toBeNull();
    expect(await secureStorage.getRefreshToken()).toBeNull();
  });

  it('logout still wipes the vault when the revoke leg fails (best-effort)', async () => {
    // An offline device or an old server build must never strand the user
    // signed-in locally — the leg is fired for its side effect only.
    await secureStorage.storeTokens('acc', 'ref', 'login.example');
    mockedClient.post.mockRejectedValue(new Error('offline'));

    await authManager.logout();

    expect(await secureStorage.getAccessToken()).toBeNull();
    expect(await AsyncStorage.getItem('user')).toBeNull();
  });

  it('isAuthenticated follows the vault across logout', async () => {
    await secureStorage.storeTokens('acc', 'ref', 'login.example');
    expect(await authManager.isAuthenticated()).toBe(true);

    await authManager.logout();
    expect(await authManager.isAuthenticated()).toBe(false);
  });
});
