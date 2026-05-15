import { create } from 'zustand';
import api, { User } from '../utils/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.login(username, password);
      set({
        user: result.user,
        isAuthenticated: true,
        isLoading: false
      });
      return true;
    } catch (err) {
      set({
        error: 'Login failed. Please check your credentials.',
        isLoading: false
      });
      return false;
    }
  },

  logout: () => {
    api.logout();
    set({
      user: null,
      isAuthenticated: false,
      error: null
    });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const restored = await api.restoreSession();
      set({
        isAuthenticated: restored,
        user: restored ? api.currentUser : null,
        isLoading: false
      });
    } catch {
      set({
        isAuthenticated: false,
        user: null,
        isLoading: false
      });
    }
  }
}));
