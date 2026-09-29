/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/__tests__/AuthManager.test.ts
import { authManager } from '../AuthManager';
import apiClient from '../client';
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

  it('logout clears local credentials only (no network logout)', async () => {
    // Seed the vault the way a real login does (tokens now live in keychain).
    await secureStorage.storeTokens('acc', 'ref');

    await authManager.logout();

    expect(mockedClient.post).not.toHaveBeenCalled();
    expect(await secureStorage.getAccessToken()).toBeNull();
    expect(await secureStorage.getRefreshToken()).toBeNull();
  });

  it('isAuthenticated follows the vault across logout', async () => {
    await secureStorage.storeTokens('acc', 'ref');
    expect(await authManager.isAuthenticated()).toBe(true);

    await authManager.logout();
    expect(await authManager.isAuthenticated()).toBe(false);
  });
});
