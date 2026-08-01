/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/native/__tests__/PhlixWebAuthn.test.ts
import { NativeModules } from 'react-native';
import {
  isSupported,
  register,
  authenticate,
  PASSKEYS_UNAVAILABLE_MESSAGE,
} from '../PhlixWebAuthn';

// We test the JS wrapper in isolation by controlling what NativeModules reports.
const OriginalNativeModules = { ...NativeModules };

// Helper to simulate native module being absent
const removeNativeModule = () => {
  (NativeModules as Record<string, unknown>).PhlixWebAuthn = undefined;
};

// Helper to simulate native module being present with controllable behavior
const mockNativeModule = (overrides: Partial<{
  isSupported: jest.Mock;
  register: jest.Mock;
  authenticate: jest.Mock;
}> = {}) => {
  const mock = {
    isSupported: jest.fn().mockResolvedValue(true),
    register: jest.fn().mockResolvedValue('{"id":"cred","type":"public-key"}'),
    authenticate: jest.fn().mockResolvedValue('{"id":"assert","type":"public-key"}'),
    ...overrides,
  };
  (NativeModules as Record<string, unknown>).PhlixWebAuthn = mock;
  return mock;
};

describe('PhlixWebAuthn', () => {
  beforeEach(() => {
    // Restore original state (no native module by default)
    (NativeModules as Record<string, unknown>).PhlixWebAuthn = undefined;
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore original NativeModules
    Object.assign(NativeModules, OriginalNativeModules);
  });

  describe('PASSKEYS_UNAVAILABLE_MESSAGE', () => {
    it('is a non-empty string describing unavailability', () => {
      expect(typeof PASSKEYS_UNAVAILABLE_MESSAGE).toBe('string');
      expect(PASSKEYS_UNAVAILABLE_MESSAGE.length).toBeGreaterThan(0);
    });
  });

  describe('isSupported', () => {
    it('returns false when native module is absent (never throws)', async () => {
      removeNativeModule();
      await expect(isSupported()).resolves.toBe(false);
    });

    it('returns false when native module isPresent but isSupported throws', async () => {
      mockNativeModule({
        isSupported: jest.fn().mockRejectedValue(new Error('platform error')),
      });
      await expect(isSupported()).resolves.toBe(false);
    });

    it('returns true when native module isSupported resolves true', async () => {
      mockNativeModule({
        isSupported: jest.fn().mockResolvedValue(true),
      });
      await expect(isSupported()).resolves.toBe(true);
    });

    it('returns false when native module isSupported resolves false', async () => {
      mockNativeModule({
        isSupported: jest.fn().mockResolvedValue(false),
      });
      await expect(isSupported()).resolves.toBe(false);
    });

    it('delegates to native.isSupported with correct call context', async () => {
      const native = mockNativeModule({
        isSupported: jest.fn().mockResolvedValue(true),
      });
      await isSupported();
      expect(native.isSupported).toHaveBeenCalledTimes(1);
    });
  });

  describe('register', () => {
    it('throws PASSKEYS_UNAVAILABLE_MESSAGE when native module is absent', async () => {
      removeNativeModule();
      await expect(register('{"challenge":"test"}')).rejects.toThrow(
        PASSKEYS_UNAVAILABLE_MESSAGE
      );
    });

    it('passes optionsJson to native.register and returns result', async () => {
      const optionsJson = '{"challenge":"CHALLENGE","rp":{"id":"phlix.app"}}';
      const credentialJson = '{"id":"new-cred","type":"public-key"}';
      const native = mockNativeModule({
        register: jest.fn().mockResolvedValue(credentialJson),
      });

      const result = await register(optionsJson);

      expect(native.register).toHaveBeenCalledWith(optionsJson);
      expect(result).toBe(credentialJson);
    });

    it('forwards native.register rejection as-is', async () => {
      const error = new Error('User cancelled');
      mockNativeModule({
        register: jest.fn().mockRejectedValue(error),
      });

      await expect(register('{}')).rejects.toThrow('User cancelled');
    });
  });

  describe('authenticate', () => {
    it('throws PASSKEYS_UNAVAILABLE_MESSAGE when native module is absent', async () => {
      removeNativeModule();
      await expect(authenticate('{"challenge":"test"}')).rejects.toThrow(
        PASSKEYS_UNAVAILABLE_MESSAGE
      );
    });

    it('passes optionsJson to native.authenticate and returns result', async () => {
      const optionsJson = '{"challenge":"AUTH_CHALLENGE","rpId":"phlix.app"}';
      const assertionJson = '{"id":"assertion","type":"public-key"}';
      const native = mockNativeModule({
        authenticate: jest.fn().mockResolvedValue(assertionJson),
      });

      const result = await authenticate(optionsJson);

      expect(native.authenticate).toHaveBeenCalledWith(optionsJson);
      expect(result).toBe(assertionJson);
    });

    it('forwards native.authenticate rejection as-is', async () => {
      const error = new Error('Biometric failed');
      mockNativeModule({
        authenticate: jest.fn().mockRejectedValue(error),
      });

      await expect(authenticate('{}')).rejects.toThrow('Biometric failed');
    });
  });
});
