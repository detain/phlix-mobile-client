/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/useAuthStore.test.ts
import { useAuthStore } from '../useAuthStore';
import { authManager } from '../../api/AuthManager';
import { useSettingsStore } from '../useSettingsStore';

jest.mock('../../api/AuthManager', () => ({
  authManager: {
    login: jest.fn(),
    logout: jest.fn(),
    isAuthenticated: jest.fn(),
    getCurrentUser: jest.fn(),
    getMe: jest.fn(),
  },
}));

jest.mock('../useSettingsStore');

const mockedAuthManager = authManager as jest.Mocked<typeof authManager>;
const mockedSettingsStore = useSettingsStore as jest.Mocked<typeof useSettingsStore>;

const mockUser = { id: 'u1', username: 'bob' };

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
    });
    mockedSettingsStore.getState = jest.fn(() => ({
      setServerUrl: jest.fn(),
    })) as any;
  });

  describe('initial state', () => {
    it('has correct initial values', () => {
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().isLoading).toBe(true);
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('login', () => {
    it('sets server URL and authenticates successfully', async () => {
      mockedAuthManager.login.mockResolvedValue({
        user: mockUser,
        token_type: 'Bearer',
      } as never);
      const setServerUrlMock = jest.fn();
      mockedSettingsStore.getState = jest.fn(() => ({
        setServerUrl: setServerUrlMock,
      })) as any;

      await useAuthStore.getState().login('https://srv', 'bob', 'pw');

      expect(setServerUrlMock).toHaveBeenCalledWith('https://srv');
      expect(mockedAuthManager.login).toHaveBeenCalledWith('https://srv', 'bob', 'pw');
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('trims server URL before saving', async () => {
      mockedAuthManager.login.mockResolvedValue({
        user: mockUser,
        token_type: 'Bearer',
      } as never);
      const setServerUrlMock = jest.fn();
      mockedSettingsStore.getState = jest.fn(() => ({
        setServerUrl: setServerUrlMock,
      })) as any;

      await useAuthStore.getState().login('  https://srv  ', 'bob', 'pw');

      expect(setServerUrlMock).toHaveBeenCalledWith('https://srv');
    });

    it('does not set server URL when empty', async () => {
      mockedAuthManager.login.mockResolvedValue({
        user: mockUser,
        token_type: 'Bearer',
      } as never);
      const setServerUrlMock = jest.fn();
      mockedSettingsStore.getState = jest.fn(() => ({
        setServerUrl: setServerUrlMock,
      })) as any;

      await useAuthStore.getState().login('', 'bob', 'pw');

      expect(setServerUrlMock).not.toHaveBeenCalled();
    });

    it('sets error and throws on login failure', async () => {
      mockedAuthManager.login.mockRejectedValue(new Error('bad creds'));

      await expect(
        useAuthStore.getState().login('https://srv', 'bob', 'bad')
      ).rejects.toThrow('bad creds');

      expect(useAuthStore.getState().error).toBe('bad creds');
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('logout', () => {
    it('clears auth state after logout', async () => {
      mockedAuthManager.logout.mockResolvedValue(undefined);
      useAuthStore.setState({ user: mockUser, isAuthenticated: true });

      await useAuthStore.getState().logout();

      expect(mockedAuthManager.logout).toHaveBeenCalled();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('clears state even if logout throws', async () => {
      mockedAuthManager.logout.mockRejectedValue(new Error('network error'));
      useAuthStore.setState({ user: mockUser, isAuthenticated: true });

      try {
        await useAuthStore.getState().logout();
      } catch (_e) {
        // Expected - logout throws when API fails
      }

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('checkAuth', () => {
    it('sets user when authenticated', async () => {
      mockedAuthManager.isAuthenticated.mockResolvedValue(true);
      mockedAuthManager.getCurrentUser.mockResolvedValue(mockUser);

      await useAuthStore.getState().checkAuth();

      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('sets unauthenticated when not authenticated', async () => {
      mockedAuthManager.isAuthenticated.mockResolvedValue(false);

      await useAuthStore.getState().checkAuth();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('sets unauthenticated on error', async () => {
      mockedAuthManager.isAuthenticated.mockRejectedValue(new Error('token expired'));

      await useAuthStore.getState().checkAuth();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('refreshMe', () => {
    it('updates user from /auth/me', async () => {
      const updatedUser = { id: 'u1', username: 'bob Updated' };
      mockedAuthManager.getMe.mockResolvedValue(updatedUser);

      await useAuthStore.getState().refreshMe();

      expect(useAuthStore.getState().user).toEqual(updatedUser);
    });

    it('keeps current user on error (non-fatal)', async () => {
      useAuthStore.setState({ user: mockUser });
      mockedAuthManager.getMe.mockRejectedValue(new Error('server error'));

      await useAuthStore.getState().refreshMe();

      // User should remain unchanged
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });
  });

  describe('setUser', () => {
    it('directly sets the user', () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });
  });
});
