/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/services/__tests__/SecureStorage.test.ts
import { secureStorage } from '../SecureStorage';
import * as Keychain from 'react-native-keychain';

jest.mock('react-native-keychain');
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockKeychain = Keychain as jest.Mocked<typeof Keychain>;

describe('SecureStorage', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await secureStorage.clearTokens();
  });

  describe('storeTokens', () => {
    it('stores access token in AsyncStorage and refresh token in Keychain', async () => {
      await secureStorage.storeTokens('access123', 'refresh456');

      const AsyncStorage = require('@react-native-async-storage/async-storage');
      const accessToken = await AsyncStorage.getItem('access_token');
      expect(accessToken).toBe('access123');

      expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(
        'access_token',
        'refresh456',
        { service: 'com.phlix.mobile.refresh' }
      );
    });

    it('throws error when Keychain storage fails', async () => {
      mockKeychain.setGenericPassword.mockRejectedValueOnce(
        new Error('Keychain error')
      );
      await expect(
        secureStorage.storeTokens('access', 'refresh')
      ).rejects.toThrow('Keychain error');
    });
  });

  describe('getAccessToken', () => {
    it('returns stored access token from AsyncStorage', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem('access_token', 'stored-access-token');
      const result = await secureStorage.getAccessToken();
      expect(result).toBe('stored-access-token');
    });

    it('returns null when no access token stored', async () => {
      const result = await secureStorage.getAccessToken();
      expect(result).toBeNull();
    });
  });

  describe('getRefreshToken', () => {
    it('returns stored refresh token from Keychain', async () => {
      mockKeychain.getGenericPassword.mockResolvedValueOnce({
        password: 'stored-refresh-token',
      } as never);
      const result = await secureStorage.getRefreshToken();
      expect(result).toBe('stored-refresh-token');
    });

    it('returns null when no refresh token stored', async () => {
      mockKeychain.getGenericPassword.mockResolvedValueOnce(false as never);
      const result = await secureStorage.getRefreshToken();
      expect(result).toBeNull();
    });

    it('returns null when Keychain getGenericPassword throws', async () => {
      mockKeychain.getGenericPassword.mockRejectedValueOnce(
        new Error('Keychain error')
      );
      const result = await secureStorage.getRefreshToken();
      expect(result).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('clears both Keychain and AsyncStorage tokens', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem('access_token', 'token');
      await secureStorage.clearTokens();

      expect(mockKeychain.resetGenericPassword).toHaveBeenCalledWith({
        service: 'com.phlix.mobile.refresh',
      });
      const accessToken = await AsyncStorage.getItem('access_token');
      expect(accessToken).toBeNull();
    });
  });

  describe('enableBiometric', () => {
    it('stores biometric enabled flag in Keychain', async () => {
      mockKeychain.setGenericPassword.mockResolvedValueOnce(true as never);
      const result = await secureStorage.enableBiometric();
      expect(result).toBe(true);
      expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(
        'biometric_enabled',
        'true',
        expect.objectContaining({
          service: 'com.phlix.mobile.biometric',
          accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
        })
      );
    });

    it('returns false when Keychain enableBiometric fails', async () => {
      mockKeychain.setGenericPassword.mockRejectedValueOnce(
        new Error('Biometric error')
      );
      const result = await secureStorage.enableBiometric();
      expect(result).toBe(false);
    });
  });

  describe('isBiometricEnabled', () => {
    it('returns true when biometric credentials exist', async () => {
      mockKeychain.getGenericPassword.mockResolvedValueOnce({
        username: 'biometric_enabled',
        password: 'true',
      } as never);
      const result = await secureStorage.isBiometricEnabled();
      expect(result).toBe(true);
    });

    it('returns false when no biometric credentials exist', async () => {
      mockKeychain.getGenericPassword.mockResolvedValueOnce(false as never);
      const result = await secureStorage.isBiometricEnabled();
      expect(result).toBe(false);
    });

    it('returns false when Keychain check throws', async () => {
      mockKeychain.getGenericPassword.mockRejectedValueOnce(
        new Error('Keychain error')
      );
      const result = await secureStorage.isBiometricEnabled();
      expect(result).toBe(false);
    });
  });

  describe('authenticateWithBiometric', () => {
    it('returns true when credentials retrieved with auth prompt', async () => {
      mockKeychain.getGenericPassword.mockResolvedValueOnce({
        username: 'access_token',
        password: 'refresh-token',
      } as never);
      const result = await secureStorage.authenticateWithBiometric();
      expect(result).toBe(true);
      expect(mockKeychain.getGenericPassword).toHaveBeenCalledWith({
        service: 'com.phlix.mobile.refresh',
        authenticationPrompt: {
          title: 'Authenticate to access Phlix',
          subtitle: 'Use biometric authentication',
          cancel: 'Cancel',
        },
      });
    });

    it('returns false when no credentials found', async () => {
      mockKeychain.getGenericPassword.mockResolvedValueOnce(false as never);
      const result = await secureStorage.authenticateWithBiometric();
      expect(result).toBe(false);
    });

    it('returns false when authentication throws', async () => {
      mockKeychain.getGenericPassword.mockRejectedValueOnce(
        new Error('Auth failed')
      );
      const result = await secureStorage.authenticateWithBiometric();
      expect(result).toBe(false);
    });
  });
});
