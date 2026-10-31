/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/useAuthStore.ts
import { create } from 'zustand';
import { authManager, User, LoginResponse } from '../api/AuthManager';
import { apiErrorMessage, onAuthInvalidated } from '../api/client';
import { syncPlayService } from '../syncplay/SyncPlayService';
import { notificationService } from '../services/NotificationService';
import { secureStorage } from '../services/SecureStorage';
import { useSettingsStore } from './useSettingsStore';
import { useConnectionSecurityStore } from './useConnectionSecurityStore';
import { hostOf } from '../utils/serverHost';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (serverUrl: string, username: string, password: string) => Promise<void>;
  register: (
    serverUrl: string,
    username: string,
    email: string,
    password: string
  ) => Promise<{ outcome: 'authenticated' } | { outcome: 'pending'; message: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshMe: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (serverUrl: string, username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      // The connection target is an INPUT, not part of the auth response —
      // persist it in settings before authenticating so the API client targets
      // the right server.
      if (serverUrl && serverUrl.trim() !== '') {
        useSettingsStore.getState().setServerUrl(serverUrl.trim());
      }

      const response = await authManager.login(serverUrl, username, password);

      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      // Surface the server's contract error (`{ error, code }` body), not the
      // axios transport string (audit M2).
      set({
        error: apiErrorMessage(error, 'Login failed'),
        isLoading: false,
      });
      throw error;
    }
  },

  register: async (
    serverUrl: string,
    username: string,
    email: string,
    password: string
  ): Promise<{ outcome: 'authenticated' } | { outcome: 'pending'; message: string }> => {
    set({ isLoading: true, error: null });
    try {
      // Same input law as login: the connection target is persisted BEFORE
      // the call so the API client dials the chosen server (M-MOBILE-05).
      if (serverUrl && serverUrl.trim() !== '') {
        useSettingsStore.getState().setServerUrl(serverUrl.trim());
      }

      const response = await authManager.register(serverUrl, username, email, password);
      if ('access_token' in response) {
        const loginResponse = response as LoginResponse;
        set({
          user: loginResponse.user,
          isAuthenticated: true,
          isLoading: false,
        });
        return { outcome: 'authenticated' };
      }
      // Server gating answered `{ status:'pending' }` (signup_mode / admin
      // approval): honest terminal — no session yet, the message is the
      // server's own.
      set({ isLoading: false });
      return { outcome: 'pending', message: response.message };
    } catch (error) {
      set({
        error: apiErrorMessage(error, 'Account creation failed'),
        isLoading: false,
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      // Full sign-out teardown (review M-MOBILE-53b/c): the live SyncPlay
      // socket (group presence, position reporting) and any scheduled local
      // notifications both outlive the credential wipe unless dismissed here —
      // previously logout only cleared tokens, leaving the viewer "in the room"
      // server-side until the socket's own timeouts noticed. Both legs are
      // best-effort and precede the async wipe so a failed network revoke
      // inside authManager.logout cannot skip them.
      try {
        syncPlayService.disconnect();
      } catch {
        // A dead socket tearing down twice is fine; never block sign-out.
      }
      try {
        notificationService.cancelAll();
      } catch {
        // Notification platform may be unavailable (e.g. tests) — best-effort.
      }
      // M-MOBILE-51: the next session resolves its lanes fresh — forget the
      // current cleartext verdicts at sign-out (banner goes with them).
      useConnectionSecurityStore.getState().resetLanes();
      await authManager.logout();
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      // M-MOBILE-33 — the biometric toggle is now a real gate, not a stored
      // preference: when the OS-protected marker slot exists (armed via
      // Settings → Biometric authentication), the vault is unreadable this
      // launch until the biometric passes. A denial leaves the credentials
      // untouched — the next launch (or re-entry into checkAuth) can prompt
      // again; nothing here wipes a session the user merely failed to
      // authenticate into right now.
      if (!(await secureStorage.authenticateWithBiometric())) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }
      const isAuth = await authManager.isAuthenticated();
      if (isAuth) {
        const user = await authManager.getCurrentUser();
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  refreshMe: async () => {
    try {
      const user = await authManager.getMe();
      set({ user });
    } catch {
      // Non-fatal: keep the cached user.
    }
  },

  setUser: (user) => set({ user }),
}));

// M3 — when the API client's refresh flow proves the session dead it wipes the
// vault and fires this. Drop the store to signed-out TOO: previously the token
// removal left `isAuthenticated` true, so the UI kept rendering authenticated
// screens while every request 401'd. This runs once per process (the client is
// a module singleton), so no unsubscribe is retained.
onAuthInvalidated(() => {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: 'Your session expired. Please sign in again.',
  });
});

// Target-change session teardown (review mobile__exploiter M1): the moment
// the dial target's HOST changes — a typed login address (even if the login
// then FAILS), a re-entered scheme, anything — the previous host's
// credentials stop existing: the vault is wiped and the store drops to
// signed-out, so a stale A-token pair can never ride along to a new host B
// even in the window before the first request. The interceptor's per-origin
// pin check (api/client.ts) is the belt for calls that race this async
// wipe; this subscription is the suspenders that also clears the UI state.
// Identity is judged by the SHARED `hostOf` parser — the same anchor the
// vault pin and the direct SyncPlay lane use; no second host law exists.
// The `getState?.()` / `subscribe === 'function'` guards are for hermetic
// suites that mock the settings store: a mocked-out store must not make this
// module-level wiring throw (its law is pinned live in authTargetWipe).
function currentServerHost(): string {
  const state = useSettingsStore.getState?.() as { serverUrl?: unknown } | undefined;
  return hostOf(typeof state?.serverUrl === 'string' ? state.serverUrl : '');
}
let boundServerHost = currentServerHost();
if (typeof useSettingsStore.subscribe === 'function') {
  useSettingsStore.subscribe((state) => {
    const nextHost = hostOf(state.serverUrl);
    if (nextHost === boundServerHost) {
      return;
    }
    boundServerHost = nextHost;
    useAuthStore.setState({ user: null, isAuthenticated: false });
    // Fire-and-forget by law: a zustand subscriber cannot await, and the
    // vault write-chain already orders this wipe against any later issuance.
    // eslint-disable-next-line no-void -- intentional fire-and-forget (vault chain serializes it)
    void secureStorage.clearTokens();
  });
}
