/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/__tests__/AuthManager.test.ts
import { authManager } from '../AuthManager';
import apiClient from '../client';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../client');
jest.mock('../deviceIdentity', () => ({
  getDeviceId: jest.fn(async () => 'device-uuid-1'),
}));

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
    await AsyncStorage.clear();
  });

  it('login POSTs /auth/login with body + X-Device-Id header and persists tokens', async () => {
    mockedClient.post.mockResolvedValue(tokenEnvelope);

    const res = await authManager.login('https://srv', 'bob', 'pw');

    expect(mockedClient.post).toHaveBeenCalledWith(
      '/auth/login',
      { username: 'bob', password: 'pw' },
      { headers: { 'X-Device-Id': 'device-uuid-1' } }
    );
    expect(res.token_type).toBe('Bearer');
    expect(await AsyncStorage.getItem('access_token')).toBe('acc');
    expect(await AsyncStorage.getItem('refresh_token')).toBe('ref');
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
    expect(await AsyncStorage.getItem('access_token')).toBeNull();
  });

  it('register saves tokens when the token envelope is returned', async () => {
    mockedClient.post.mockResolvedValue(tokenEnvelope);

    await authManager.register('https://srv', 'bob', 'b@x.com', 'pw');

    expect(await AsyncStorage.getItem('access_token')).toBe('acc');
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
    await AsyncStorage.setItem('access_token', 'acc');
    await AsyncStorage.setItem('refresh_token', 'ref');

    await authManager.logout();

    expect(mockedClient.post).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('access_token')).toBeNull();
  });
});
