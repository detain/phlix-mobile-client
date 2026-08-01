/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/useSettingsStore.test.ts
import { useSettingsStore } from '../useSettingsStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('useSettingsStore', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    useSettingsStore.setState({
      defaultQuality: 'auto',
      autoplay: true,
      autoPlayNextEpisode: true,
      defaultSubtitleLanguage: 'en',
      defaultAudioLanguage: 'en',
      downloadQuality: 'high',
      downloadOverWifiOnly: true,
      maxConcurrentDownloads: 2,
      downloadPath: '',
      theme: 'dark',
      showAdultContent: false,
      enableNotifications: true,
      enableBiometricAuth: false,
      serverUrl: '',
      serverName: '',
    });
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useSettingsStore.getState();
      expect(state.defaultQuality).toBe('auto');
      expect(state.autoplay).toBe(true);
      expect(state.autoPlayNextEpisode).toBe(true);
      expect(state.defaultSubtitleLanguage).toBe('en');
      expect(state.defaultAudioLanguage).toBe('en');
      expect(state.downloadQuality).toBe('high');
      expect(state.downloadOverWifiOnly).toBe(true);
      expect(state.maxConcurrentDownloads).toBe(2);
      expect(state.downloadPath).toBe('');
      expect(state.theme).toBe('dark');
      expect(state.showAdultContent).toBe(false);
      expect(state.enableNotifications).toBe(true);
      expect(state.enableBiometricAuth).toBe(false);
      expect(state.serverUrl).toBe('');
      expect(state.serverName).toBe('');
    });
  });

  describe('playback setting setters (autosave)', () => {
    it('setDefaultQuality triggers saveSettings', async () => {
      const saveSpy = jest.spyOn(useSettingsStore.getState(), 'saveSettings');
      useSettingsStore.getState().setDefaultQuality('1080p');
      expect(saveSpy).toHaveBeenCalled();
    });

    it('setAutoplay triggers saveSettings', async () => {
      const saveSpy = jest.spyOn(useSettingsStore.getState(), 'saveSettings');
      useSettingsStore.getState().setAutoplay(false);
      expect(saveSpy).toHaveBeenCalled();
    });

    it('setAutoPlayNextEpisode triggers saveSettings', async () => {
      const saveSpy = jest.spyOn(useSettingsStore.getState(), 'saveSettings');
      useSettingsStore.getState().setAutoPlayNextEpisode(false);
      expect(saveSpy).toHaveBeenCalled();
    });

    it('setDefaultSubtitleLanguage triggers saveSettings', async () => {
      const saveSpy = jest.spyOn(useSettingsStore.getState(), 'saveSettings');
      useSettingsStore.getState().setDefaultSubtitleLanguage('es');
      expect(saveSpy).toHaveBeenCalled();
    });

    it('setDefaultAudioLanguage triggers saveSettings', async () => {
      const saveSpy = jest.spyOn(useSettingsStore.getState(), 'saveSettings');
      useSettingsStore.getState().setDefaultAudioLanguage('es');
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  describe('download setting setters (autosave)', () => {
    it('setDownloadQuality triggers saveSettings', async () => {
      const saveSpy = jest.spyOn(useSettingsStore.getState(), 'saveSettings');
      useSettingsStore.getState().setDownloadQuality('low');
      expect(saveSpy).toHaveBeenCalled();
    });

    it('setDownloadOverWifiOnly triggers saveSettings', async () => {
      const saveSpy = jest.spyOn(useSettingsStore.getState(), 'saveSettings');
      useSettingsStore.getState().setDownloadOverWifiOnly(false);
      expect(saveSpy).toHaveBeenCalled();
    });

    it('setMaxConcurrentDownloads triggers saveSettings', async () => {
      const saveSpy = jest.spyOn(useSettingsStore.getState(), 'saveSettings');
      useSettingsStore.getState().setMaxConcurrentDownloads(5);
      expect(saveSpy).toHaveBeenCalled();
    });

    it('setDownloadPath triggers saveSettings', async () => {
      const saveSpy = jest.spyOn(useSettingsStore.getState(), 'saveSettings');
      useSettingsStore.getState().setDownloadPath('/custom/path');
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  describe('app setting setters (autosave)', () => {
    it('setTheme triggers saveSettings', async () => {
      const saveSpy = jest.spyOn(useSettingsStore.getState(), 'saveSettings');
      useSettingsStore.getState().setTheme('light');
      expect(saveSpy).toHaveBeenCalled();
    });

    it('setShowAdultContent triggers saveSettings', async () => {
      const saveSpy = jest.spyOn(useSettingsStore.getState(), 'saveSettings');
      useSettingsStore.getState().setShowAdultContent(true);
      expect(saveSpy).toHaveBeenCalled();
    });

    it('setEnableNotifications triggers saveSettings', async () => {
      const saveSpy = jest.spyOn(useSettingsStore.getState(), 'saveSettings');
      useSettingsStore.getState().setEnableNotifications(false);
      expect(saveSpy).toHaveBeenCalled();
    });

    it('setEnableBiometricAuth triggers saveSettings', async () => {
      const saveSpy = jest.spyOn(useSettingsStore.getState(), 'saveSettings');
      useSettingsStore.getState().setEnableBiometricAuth(true);
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  describe('server setting setters (autosave)', () => {
    it('setServerUrl triggers saveSettings', async () => {
      const saveSpy = jest.spyOn(useSettingsStore.getState(), 'saveSettings');
      useSettingsStore.getState().setServerUrl('https://example.com');
      expect(saveSpy).toHaveBeenCalled();
    });

    it('setServerName triggers saveSettings', async () => {
      const saveSpy = jest.spyOn(useSettingsStore.getState(), 'saveSettings');
      useSettingsStore.getState().setServerName('My Server');
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  describe('loadSettings', () => {
    it('loads settings from AsyncStorage', async () => {
      const savedSettings = {
        defaultQuality: '1080p',
        autoplay: false,
        theme: 'light' as const,
        serverUrl: 'https://myserver.com',
      };
      await AsyncStorage.setItem('phlix_settings', JSON.stringify(savedSettings));

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.defaultQuality).toBe('1080p');
      expect(state.autoplay).toBe(false);
      expect(state.theme).toBe('light');
      expect(state.serverUrl).toBe('https://myserver.com');
    });

    it('merges with defaults for missing keys', async () => {
      await AsyncStorage.setItem('phlix_settings', JSON.stringify({ theme: 'system' as const }));

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.theme).toBe('system');
      expect(state.defaultQuality).toBe('auto'); // default
      expect(state.autoplay).toBe(true); // default
    });

    it('handles missing stored data gracefully', async () => {
      // Ensure no data
      await AsyncStorage.removeItem('phlix_settings');

      // Should not throw
      await useSettingsStore.getState().loadSettings();

      // Should keep defaults
      const state = useSettingsStore.getState();
      expect(state.defaultQuality).toBe('auto');
    });

    it('handles corrupted JSON gracefully', async () => {
      await AsyncStorage.setItem('phlix_settings', 'not valid json {{{');

      // Should not throw
      await useSettingsStore.getState().loadSettings();

      // Should keep defaults
      expect(useSettingsStore.getState().defaultQuality).toBe('auto');
    });
  });

  describe('saveSettings', () => {
    it('persists current state to AsyncStorage', async () => {
      useSettingsStore.setState({
        defaultQuality: '4k',
        autoplay: false,
        theme: 'system',
      });

      await useSettingsStore.getState().saveSettings();

      const stored = await AsyncStorage.getItem('phlix_settings');
      const parsed = JSON.parse(stored!);
      expect(parsed.defaultQuality).toBe('4k');
      expect(parsed.autoplay).toBe(false);
      expect(parsed.theme).toBe('system');
    });

    it('handles AsyncStorage errors gracefully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('storage full'));

      // Should not throw
      await useSettingsStore.getState().saveSettings();
    });
  });

  describe('resetSettings', () => {
    it('resets to defaults and clears storage', async () => {
      useSettingsStore.setState({
        defaultQuality: '4k',
        theme: 'light',
        serverUrl: 'https://evil.com',
      });

      useSettingsStore.getState().resetSettings();

      const state = useSettingsStore.getState();
      expect(state.defaultQuality).toBe('auto');
      expect(state.theme).toBe('dark');
      expect(state.serverUrl).toBe('');

      const stored = await AsyncStorage.getItem('phlix_settings');
      expect(stored).toBeNull();
    });
  });
});
