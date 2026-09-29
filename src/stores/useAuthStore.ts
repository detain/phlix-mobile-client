/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/useAuthStore.ts
import { create } from 'zustand';
import { authManager, User } from '../api/AuthManager';
import { apiErrorMessage, onAuthInvalidated } from '../api/client';
import { useSettingsStore } from './useSettingsStore';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (serverUrl: string, username: string, password: string) => Promise<void>;
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

  logout: async () => {
    set({ isLoading: true });
    try {
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
