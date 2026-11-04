/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/useSettingsStore.test.ts
import fs from 'fs';
import path from 'path';
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

    it('the wifi-only setter EXISTS — M3 landed it back as a real gate (M-MOBILE-01 superseded)', () => {
      // The M-MOBILE-01 cure deleted the SETTER because nothing could read
      // network type. M3 (deferred lane) added netinfo and a live consumer,
      // so the setter is required again — its absence would be regression.
      expect(typeof useSettingsStore.getState().setDownloadOverWifiOnly).toBe('function');
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

    // M-MOBILE-31 — a tampered blob must not be able to poison the types the
    // API client relies on: `getServerRoot()` calls `.trim()` on serverUrl for
    // EVERY request, so a non-string surviving the restore took the whole
    // client down. Wrong-typed/unknown values fall back to defaults instead.
    it('drops wrong-typed and unknown fields on restore (M-MOBILE-31)', async () => {
      await AsyncStorage.setItem(
        'phlix_settings',
        JSON.stringify({
          serverUrl: { evil: true },
          autoplay: 'yes-please',
          maxConcurrentDownloads: 'many',
          theme: 'hot-pink',
          inventedKey: 'whatever',
          defaultQuality: '1080p',
        })
      );

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.serverUrl).toBe('');
      expect(state.autoplay).toBe(true);
      expect(state.maxConcurrentDownloads).toBe(2);
      expect(state.theme).toBe('dark');
      expect((state as unknown as Record<string, unknown>).inventedKey).toBeUndefined();
      expect(state.defaultQuality).toBe('1080p'); // the one valid field survives
    });

    it('tolerates a non-object top-level blob (M-MOBILE-31)', async () => {
      await AsyncStorage.setItem('phlix_settings', JSON.stringify(['pwned']));

      await expect(useSettingsStore.getState().loadSettings()).resolves.toBeUndefined();
      expect(useSettingsStore.getState().serverUrl).toBe('');
    });

    // M-MOBILE-15: the autoPlayNextEpisode key is no longer inert (PlayerScreen
    // now reads it). Pin the persisted round-trip so a saved OFF survives a
    // reload, and confirm the load merge tolerates keys the store does not
    // know (forward-compat / other lanes' additions must never crash it).
    it('round-trips autoPlayNextEpisode=false through storage', async () => {
      await AsyncStorage.setItem('phlix_settings', JSON.stringify({ autoPlayNextEpisode: false }));

      await useSettingsStore.getState().loadSettings();

      expect(useSettingsStore.getState().autoPlayNextEpisode).toBe(false);
    });

    it('tolerates unknown persisted keys without throwing or losing defaults', async () => {
      await AsyncStorage.setItem(
        'phlix_settings',
        JSON.stringify({ some_future_key: 42, theme: 'dark' as const }),
      );

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.theme).toBe('dark'); // the known key applied
      expect(state.autoplay).toBe(true); // an untouched default still present
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

  // Review mobile__casualgamer #1 (MAJORS queue, M-MOBILE-01): five toggles
  // were settings theater. autoplay / autoPlayNextEpisode / biometric were
  // since genuinely consumed (cures under other rows — see fixlog); the
  // wifi-only toggle had ZERO consumers in the download lane and no network
  // type API exists in bare RN (no @react-native-community/netinfo in the
  // lock) — the honest minimal cure is to remove the lying toggle until a
  // real native connectivity gate ships. Push-label honesty: no FCM/APNs
  // registration exists anywhere; the toggle gates LOCAL notifications only
  // (real consumer landed with review mobile__crossfe M3 / M-MOBILE-06).
  describe('wifi-only toggle — M-MOBILE-01 theater, CURED REAL by M3 (deferred lane)', () => {
    it('a pre-M3 persisted blob carrying the key hydrates it (known boolean now)', async () => {
      // M-MOBILE-01 made this key UNKNOWN (dropped by sanitize). M3 re-added
      // it to defaultSettings, so an old blob's explicit boolean now passes
      // the type gate and is honored verbatim — including the OFF that was
      // theater when written. Key is not poison; it is law again.
      await AsyncStorage.setItem(
        'phlix_settings',
        JSON.stringify({ downloadOverWifiOnly: false, autoplay: false, theme: 'dark' })
      );
      await useSettingsStore.getState().loadSettings();
      const state = useSettingsStore.getState();
      expect(state.autoplay).toBe(false);
      expect(state.downloadOverWifiOnly).toBe(false);
    });

    it('the toggle is REAL: key + setter in the store, row in the UI, reader in the gate', () => {
      // Inverted M-MOBILE-01 permanent pin. The theater law ("an unwired
      // toggle must stay OUT") still holds as a principle — it just now
      // enforces the OPPOSITE direction: a wired toggle must stay IN.
      const screen = fs.readFileSync(
        path.resolve(__dirname, '../../screens/SettingsScreen.tsx'),
        'utf8'
      );
      const store = fs.readFileSync(
        path.resolve(__dirname, '../useSettingsStore.ts'),
        'utf8'
      );
      const downloader = fs.readFileSync(
        path.resolve(__dirname, '../../services/DownloadService.ts'),
        'utf8'
      );
      expect(screen).toContain('downloadOverWifiOnly');
      expect(store).toContain('downloadOverWifiOnly: true');
      // Anti-theater proof: the consumer exists and reads BOTH the setting
      // and the network probe — a switch nobody consumes is banned by law.
      expect(downloader).toContain('downloadOverWifiOnly');
      expect(downloader).toContain('isCellularNow');
    });

    it('the notifications row is honestly labeled — local notifee only, no push backend', () => {
      const screen = fs.readFileSync(
        path.resolve(__dirname, '../../screens/SettingsScreen.tsx'),
        'utf8'
      );
      // No push transport exists in this app (grep: no FCM/APNs registration)
      // — calling it "Push" lied. The row must stay, gating the real local
      // notifications lane wired by M-MOBILE-06.
      expect(screen).not.toContain('Push notifications');
      expect(screen).toContain("'Notifications',");
      expect(screen).toContain('value={enableNotifications}');
    });

    it('the OFF arm cancels the ongoing playback notification (review Minor 3)', () => {
      const screen = fs.readFileSync(
        path.resolve(__dirname, '../../screens/SettingsScreen.tsx'),
        'utf8'
      );
      // Pre-cure, flipping Notifications OFF mid-play left the pinned
      // "Now Playing" banner up: the player's update path early-returns on
      // the setting, so its dismiss arms never ran. The OFF intent itself
      // must cancel it. Window = the switch's onValueChange body.
      const arm = screen.slice(
        screen.indexOf('setEnableNotifications(next);'),
        screen.indexOf('trackColor', screen.indexOf('setEnableNotifications(next);')),
      );
      expect(arm).toContain('} else {');
      expect(arm).toContain('notificationService.cancelPlaybackNotification()');
    });
  });
});
