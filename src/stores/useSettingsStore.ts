/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/useSettingsStore.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  // Playback settings
  defaultQuality: string;
  autoplay: boolean;
  autoPlayNextEpisode: boolean;
  defaultSubtitleLanguage: string;
  defaultAudioLanguage: string;

  // Download settings
  downloadQuality: string;
  maxConcurrentDownloads: number;
  downloadPath: string;

  // App settings
  theme: 'dark' | 'light' | 'system';
  showAdultContent: boolean;
  enableNotifications: boolean;
  enableBiometricAuth: boolean;

  // Server settings
  serverUrl: string;
  serverName: string;

  // Actions
  setDefaultQuality: (quality: string) => void;
  setAutoplay: (autoplay: boolean) => void;
  setAutoPlayNextEpisode: (autoplay: boolean) => void;
  setDefaultSubtitleLanguage: (language: string) => void;
  setDefaultAudioLanguage: (language: string) => void;
  setDownloadQuality: (quality: string) => void;
  setMaxConcurrentDownloads: (max: number) => void;
  setDownloadPath: (path: string) => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setShowAdultContent: (show: boolean) => void;
  setEnableNotifications: (enable: boolean) => void;
  setEnableBiometricAuth: (enable: boolean) => void;
  setServerUrl: (url: string) => void;
  setServerName: (name: string) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  resetSettings: () => void;
}

const SETTINGS_KEY = 'phlix_settings';

/** Whitelist for the typed `theme` union — the generic scalar check below is
 * not enough for it (every string is `typeof 'dark'`). M-MOBILE-31. */
const THEME_VALUES: readonly string[] = ['dark', 'light', 'system'];

/**
 * Keep only persisted keys that exist in `defaultSettings` AND carry a value
 * of the same primitive type (`theme` additionally whitelisted). Returns a
 * partial that is always safe to spread over the defaults.
 */
function sanitizeSettings(parsed: unknown): Partial<typeof defaultSettings> {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const fallback = (defaultSettings as Record<string, unknown>)[key];
    if (fallback === undefined || typeof value !== typeof fallback) {
      continue;
    }
    if (key === 'theme' && !THEME_VALUES.includes(value as string)) {
      continue;
    }
    safe[key] = value;
  }
  return safe as Partial<typeof defaultSettings>;
}

const defaultSettings = {
  defaultQuality: 'auto',
  autoplay: true,
  autoPlayNextEpisode: true,
  defaultSubtitleLanguage: 'en',
  defaultAudioLanguage: 'en',
  downloadQuality: 'high',
  // The former "Download over Wi-Fi only" key was REMOVED here (review
  // mobile__casualgamer #1, MAJORS queue M-MOBILE-01): zero consumers in the
  // download lane, and bare RN exposes no network-type API (no netinfo in
  // the lock). A gate needs a native connectivity module — separate feature
  // decision, not a lying toggle. Old persisted blobs simply lose the key at
  // sanitizeSettings (unknown-key drop, no migration).
  maxConcurrentDownloads: 2,
  downloadPath: '',
  theme: 'dark' as const,
  showAdultContent: false,
  enableNotifications: true,
  enableBiometricAuth: false,
  serverUrl: '',
  serverName: '',
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaultSettings,

  setDefaultQuality: (quality) => {
    set({ defaultQuality: quality });
    get().saveSettings();
  },
  setAutoplay: (autoplay) => {
    set({ autoplay });
    get().saveSettings();
  },
  setAutoPlayNextEpisode: (autoplay) => {
    set({ autoPlayNextEpisode: autoplay });
    get().saveSettings();
  },
  setDefaultSubtitleLanguage: (language) => {
    set({ defaultSubtitleLanguage: language });
    get().saveSettings();
  },
  setDefaultAudioLanguage: (language) => {
    set({ defaultAudioLanguage: language });
    get().saveSettings();
  },
  setDownloadQuality: (quality) => {
    set({ downloadQuality: quality });
    get().saveSettings();
  },
  setMaxConcurrentDownloads: (max) => {
    set({ maxConcurrentDownloads: max });
    get().saveSettings();
  },
  setDownloadPath: (path) => {
    set({ downloadPath: path });
    get().saveSettings();
  },
  setTheme: (theme) => {
    set({ theme });
    get().saveSettings();
  },
  setShowAdultContent: (show) => {
    set({ showAdultContent: show });
    get().saveSettings();
  },
  setEnableNotifications: (enable) => {
    set({ enableNotifications: enable });
    get().saveSettings();
  },
  setEnableBiometricAuth: (enable) => {
    set({ enableBiometricAuth: enable });
    get().saveSettings();
  },
  setServerUrl: (url) => {
    set({ serverUrl: url });
    get().saveSettings();
  },
  setServerName: (name) => {
    set({ serverName: name });
    get().saveSettings();
  },

  loadSettings: async () => {
    try {
      const data = await AsyncStorage.getItem(SETTINGS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        // M-MOBILE-31 — shape-validate every persisted field before it can
        // reach state: a tampered/corrupted blob carrying e.g. a non-string
        // `serverUrl` used to survive the blind `{...defaultSettings, ...parsed}`
        // merge and throw inside `getServerRoot()` on EVERY subsequent API call
        // (parse-not-validate at the persistence boundary, same doctrine as the
        // WS wire parsers). Unknown keys and wrong-typed values fall back to
        // their defaults.
        set({ ...defaultSettings, ...sanitizeSettings(parsed) });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  },

  saveSettings: async () => {
    try {
      const state = get();
      const settings = {
        defaultQuality: state.defaultQuality,
        autoplay: state.autoplay,
        autoPlayNextEpisode: state.autoPlayNextEpisode,
        defaultSubtitleLanguage: state.defaultSubtitleLanguage,
        defaultAudioLanguage: state.defaultAudioLanguage,
        downloadQuality: state.downloadQuality,
        maxConcurrentDownloads: state.maxConcurrentDownloads,
        downloadPath: state.downloadPath,
        theme: state.theme,
        showAdultContent: state.showAdultContent,
        enableNotifications: state.enableNotifications,
        enableBiometricAuth: state.enableBiometricAuth,
        serverUrl: state.serverUrl,
        serverName: state.serverName,
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  },

  resetSettings: () => {
    set(defaultSettings);
    AsyncStorage.removeItem(SETTINGS_KEY);
  },
}));
