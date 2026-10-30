/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/useAuthStore.test.ts
import { useAuthStore } from '../useAuthStore';
import { authManager } from '../../api/AuthManager';
import { syncPlayService } from '../../syncplay/SyncPlayService';
import { notificationService } from '../../services/NotificationService';
import { useSettingsStore } from '../useSettingsStore';

jest.mock('../../api/AuthManager', () => ({
  authManager: {
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    isAuthenticated: jest.fn(),
    getCurrentUser: jest.fn(),
    getMe: jest.fn(),
  },
}));

jest.mock('../useSettingsStore');

// M-MOBILE-53: logout now orchestrates cross-subsystem teardown; the store
// test keeps the boundary hermetic and PINS that the teardown legs fire.
jest.mock('../../syncplay/SyncPlayService', () => ({
  syncPlayService: { disconnect: jest.fn() },
}));
jest.mock('../../services/NotificationService', () => ({
  notificationService: { cancelAll: jest.fn() },
}));

// useAuthStore imports apiErrorMessage/onAuthInvalidated from the API client;
// importing the REAL client here would boot ApiClient against the auto-mocked
// settings store (getState() undefined). Stub the two helpers with the same
// shape the client exports.
jest.mock('../../api/client', () => ({
  apiErrorMessage: (
    error: { response?: { data?: { error?: string; code?: string } }; message?: string },
    fallback: string,
  ) => {
    const msg = error?.response?.data?.error;
    const code = error?.response?.data?.code;
    if (msg && code) return `${msg} (${code})`;
    return msg ?? error?.message ?? fallback;
  },
  onAuthInvalidated: jest.fn(() => () => undefined),
}));

const mockedAuthManager = authManager as jest.Mocked<typeof authManager>;
const mockedSettingsStore = useSettingsStore as jest.Mocked<typeof useSettingsStore>;
const mockedSyncPlay = syncPlayService as jest.Mocked<typeof syncPlayService>;
const mockedNotifications = notificationService as jest.Mocked<typeof notificationService>;

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
      // M-MOBILE-53b/c: sign-out must dismiss live group presence and any
      // scheduled notifications, not just the credentials.
      expect(mockedSyncPlay.disconnect).toHaveBeenCalled();
      expect(mockedNotifications.cancelAll).toHaveBeenCalled();
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

    // M-MOBILE-33 — when the OS biometric marker read throws (prompt armed and
    // denied/cancelled), checkAuth must NOT reach authManager: the vault stays
    // closed this launch and the session is left intact (no wipe).
    it('is gated by the biometric marker when armed and denied', async () => {
      const keychain = jest.requireMock('react-native-keychain') as {
        getGenericPassword: jest.Mock;
      };
      keychain.getGenericPassword.mockRejectedValueOnce(new Error('biometry denied'));
      mockedAuthManager.isAuthenticated.mockClear();

      await useAuthStore.getState().checkAuth();

      expect(mockedAuthManager.isAuthenticated).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('register', () => {
    // M-MOBILE-05 — the signup path: token envelope lands the session and
    // persists the target host first; `{status:'pending'}` reports the
    // server's approval notice without authenticating.
    it('authenticates on a token response', async () => {
      const tokenResponse = {
        access_token: 'a',
        refresh_token: 'r',
        token_type: 'Bearer',
        expires_in: 3600,
        user: mockUser,
      };
      mockedAuthManager.register.mockResolvedValue(tokenResponse);

      const result = await useAuthStore
        .getState()
        .register('https://box.test:8096', 'alice', 'a@x.test', 'pw12345');

      expect(result).toEqual({ outcome: 'authenticated' });
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    it('reports the server notice on a pending approval', async () => {
      mockedAuthManager.register.mockResolvedValue({
        status: 'pending',
        message: 'Ask an admin to approve your account.',
      });

      const result = await useAuthStore
        .getState()
        .register('https://box.test:8096', 'bob', 'b@x.test', 'pw12345');

      expect(result).toEqual({
        outcome: 'pending',
        message: 'Ask an admin to approve your account.',
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
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
