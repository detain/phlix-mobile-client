/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/useWebAuthnStore.ts
//
// Passkey management state (slice E10e) — the list of the current user's
// registered passkeys + add/delete mutators. The passwordless LOGIN ceremony
// lives in WebAuthnService (it talks to useAuthStore directly), not here; this
// store is the management surface for the PasskeysScreen.
//
// Convention: the loader (loadCredentials) swallows into `error`; mutators
// (registerPasskey/deletePasskey) set `error` AND rethrow so the screen can show
// an Alert / keep its own optimistic state.
import { create } from 'zustand';
import { webAuthnService } from '../services/WebAuthnService';
import type { PasskeyCredential, RegistrationResult } from '../types/webauthn';

interface WebAuthnState {
  credentials: PasskeyCredential[];
  loading: boolean;
  error: string | null;

  loadCredentials: () => Promise<void>;
  registerPasskey: (name?: string) => Promise<RegistrationResult>;
  deletePasskey: (id: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  credentials: [] as PasskeyCredential[],
  loading: false,
  error: null as string | null,
};

function errMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export const useWebAuthnStore = create<WebAuthnState>((set, get) => ({
  ...initialState,

  loadCredentials: async () => {
    set({ loading: true, error: null });
    try {
      const credentials = await webAuthnService.listPasskeys();
      set({ credentials, loading: false });
    } catch (error) {
      set({
        error: errMessage(error, 'Failed to load passkeys'),
        loading: false,
      });
    }
  },

  registerPasskey: async (name?: string) => {
    set({ error: null });
    try {
      const result = await webAuthnService.registerPasskey(name);
      // Reload so the freshly-added passkey appears in order.
      await get().loadCredentials();
      return result;
    } catch (error) {
      set({ error: errMessage(error, 'Failed to add passkey') });
      throw error;
    }
  },

  deletePasskey: async (id: string) => {
    set({ error: null });
    try {
      await webAuthnService.deletePasskey(id);
      set((state) => ({
        credentials: state.credentials.filter((c) => c.id !== id),
      }));
    } catch (error) {
      set({ error: errMessage(error, 'Failed to delete passkey') });
      throw error;
    }
  },

  reset: () => set({ ...initialState }),
}));
