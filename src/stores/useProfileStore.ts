/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/useProfileStore.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { profileManager } from '../api/ProfileManager';
import type { Profile, CreateProfileInput, UpdateProfileInput } from '../types/profile';

interface ProfileState {
  profiles: Profile[];
  activeProfile: Profile | null;
  /** Persisted id of the last-selected profile; rehydrated on `loadProfiles`. */
  activeProfileId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadProfiles: (userId: string) => Promise<void>;
  createProfile: (userId: string, input: CreateProfileInput) => Promise<void>;
  updateProfile: (id: string, input: UpdateProfileInput) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  setPin: (id: string, pin: string) => Promise<void>;
  clearPin: (id: string) => Promise<void>;
  selectProfile: (profile: Profile) => void;
  clearActiveProfile: () => void;
  /**
   * Drop the loaded profiles and the active selection (M-MOBILE-18): profile
   * rows AND their ids are minted by the CURRENT server, so a hub server
   * switch invalidates this whole view. The persisted `phlix_active_profile_id`
   * stays on disk — it is the user's remembered choice; `loadProfiles`
   * rehydrates it only when a NEW-server profile actually carries that id
   * (`.find() ?? null`), so a foreign id can never activate anything.
   */
  reset: () => void;
}

const ACTIVE_PROFILE_KEY = 'phlix_active_profile_id';

/** Persist (or clear) the active profile id. Fire-and-forget — never throws. */
const persistActiveProfileId = (id: string | null): void => {
  if (id) {
    AsyncStorage.setItem(ACTIVE_PROFILE_KEY, id).catch((err) =>
      console.error('Failed to persist active profile id:', err)
    );
  } else {
    AsyncStorage.removeItem(ACTIVE_PROFILE_KEY).catch((err) =>
      console.error('Failed to clear active profile id:', err)
    );
  }
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  activeProfile: null,
  activeProfileId: null,
  isLoading: false,
  error: null,

  loadProfiles: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const profiles = await profileManager.listProfiles(userId);

      // Rehydrate the active profile from the persisted id if not already set.
      const persistedId = get().activeProfileId ?? (await AsyncStorage.getItem(ACTIVE_PROFILE_KEY));
      const activeProfile =
        get().activeProfile ??
        (persistedId ? profiles.find((p) => p.id === persistedId) ?? null : null);

      set({
        profiles,
        activeProfile,
        activeProfileId: activeProfile?.id ?? persistedId ?? null,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load profiles',
        isLoading: false,
      });
    }
  },

  createProfile: async (userId: string, input: CreateProfileInput) => {
    set({ isLoading: true, error: null });
    try {
      await profileManager.createProfile(userId, input);
      // Re-fetch so the new profile (with its server-assigned id/settings) appears.
      await get().loadProfiles(userId);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create profile',
        isLoading: false,
      });
      throw error;
    }
  },

  updateProfile: async (id: string, input: UpdateProfileInput) => {
    set({ isLoading: true, error: null });
    try {
      await profileManager.updateProfile(id, input);
      const refreshed = await profileManager.getProfile(id);
      set((state) => ({
        profiles: state.profiles.map((p) => (p.id === id ? refreshed : p)),
        activeProfile: state.activeProfile?.id === id ? refreshed : state.activeProfile,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update profile',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteProfile: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await profileManager.deleteProfile(id);
      const isActive = get().activeProfile?.id === id;
      if (isActive) {
        persistActiveProfileId(null);
      }
      set((state) => ({
        profiles: state.profiles.filter((p) => p.id !== id),
        activeProfile: isActive ? null : state.activeProfile,
        activeProfileId: isActive ? null : state.activeProfileId,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete profile',
        isLoading: false,
      });
      throw error;
    }
  },

  setPin: async (id: string, pin: string) => {
    set({ error: null });
    try {
      await profileManager.setPin(id, pin);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to set PIN' });
      throw error;
    }
  },

  clearPin: async (id: string) => {
    set({ error: null });
    try {
      await profileManager.clearPin(id);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to clear PIN' });
      throw error;
    }
  },

  selectProfile: (profile: Profile) => {
    persistActiveProfileId(profile.id);
    set({ activeProfile: profile, activeProfileId: profile.id });
  },

  clearActiveProfile: () => {
    persistActiveProfileId(null);
    set({ activeProfile: null, activeProfileId: null });
  },

  reset: () => {
    // In-memory eviction only — see the action contract in ProfileState.
    // The stale id itself lives on in the AsyncStorage pin (by design, for
    // the never-matching `.find() ?? null` rehydration); clearing the
    // in-memory copy just keeps it from resurrecting across a switch where
    // the persisted read would fall to the same dead value anyway.
    set({
      profiles: [],
      activeProfile: null,
      activeProfileId: null,
      isLoading: false,
      error: null,
    });
  },
}));
