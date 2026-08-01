/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/__tests__/storage.test.ts
import { storage } from '../storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('storage', () => {
  beforeEach(async () => {
    await storage.clear();
  });

  describe('set and get', () => {
    it('stores and retrieves a string value', async () => {
      await storage.set('key1', 'value1');
      const result = await storage.get<string>('key1');
      expect(result).toBe('value1');
    });

    it('stores and retrieves a number value', async () => {
      await storage.set('numKey', 42);
      const result = await storage.get<number>('numKey');
      expect(result).toBe(42);
    });

    it('stores and retrieves an object value', async () => {
      const obj = { name: 'test', count: 5 };
      await storage.set('objKey', obj);
      const result = await storage.get<typeof obj>('objKey');
      expect(result).toEqual(obj);
    });

    it('stores and retrieves an array value', async () => {
      const arr = [1, 2, 3];
      await storage.set('arrKey', arr);
      const result = await storage.get<typeof arr>('arrKey');
      expect(result).toEqual(arr);
    });

    it('returns null for non-existent key', async () => {
      const result = await storage.get<string>('nonexistent');
      expect(result).toBeNull();
    });

    it('overwrites existing value with new one', async () => {
      await storage.set('key1', 'first');
      await storage.set('key1', 'second');
      const result = await storage.get<string>('key1');
      expect(result).toBe('second');
    });
  });

  describe('remove', () => {
    it('removes a stored value', async () => {
      await storage.set('key1', 'value1');
      await storage.remove('key1');
      const result = await storage.get<string>('key1');
      expect(result).toBeNull();
    });

    it('does not throw when removing non-existent key', async () => {
      await expect(storage.remove('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('has', () => {
    it('returns true for existing key', async () => {
      await storage.set('key1', 'value1');
      const result = await storage.has('key1');
      expect(result).toBe(true);
    });

    it('returns false for non-existent key', async () => {
      const result = await storage.has('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all stored values', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      await storage.clear();
      const result1 = await storage.get<string>('key1');
      const result2 = await storage.get<string>('key2');
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('keys', () => {
    it('returns all stored keys', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      const keys = await storage.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('returns empty array when storage is empty', async () => {
      const keys = await storage.keys();
      expect(Array.isArray(keys)).toBe(true);
    });
  });

  describe('multiSet', () => {
    it('stores multiple key-value pairs at once', async () => {
      const items: Array<[string, string]> = [
        ['multi1', 'value1'],
        ['multi2', 'value2'],
      ];
      await storage.multiSet(items);
      const result1 = await storage.get<string>('multi1');
      const result2 = await storage.get<string>('multi2');
      expect(result1).toBe('value1');
      expect(result2).toBe('value2');
    });

    it('handles mixed value types in multiSet', async () => {
      const items: Array<[string, unknown]> = [
        ['strKey', 'hello'],
        ['numKey', 123],
        ['objKey', { nested: true }],
      ];
      await storage.multiSet(items);
      expect(await storage.get<string>('strKey')).toBe('hello');
      expect(await storage.get<number>('numKey')).toBe(123);
      expect(await storage.get<{ nested: boolean }>('objKey')).toEqual({ nested: true });
    });
  });

  describe('multiGet', () => {
    it('retrieves multiple keys at once', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      const result = await storage.multiGet<string>(['key1', 'key2']);
      expect(result).toContainEqual(['key1', 'value1']);
      expect(result).toContainEqual(['key2', 'value2']);
    });

    it('returns null for non-existent keys in multiGet', async () => {
      const result = await storage.multiGet<string>(['nonexistent1', 'nonexistent2']);
      expect(result).toContainEqual(['nonexistent1', null]);
      expect(result).toContainEqual(['nonexistent2', null]);
    });
  });

  describe('multiRemove', () => {
    it('removes multiple keys at once', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      await storage.set('key3', 'value3');
      await storage.multiRemove(['key1', 'key2']);
      expect(await storage.get<string>('key1')).toBeNull();
      expect(await storage.get<string>('key2')).toBeNull();
      expect(await storage.get<string>('key3')).toBe('value3');
    });
  });

  describe('error handling', () => {
    it('get returns null on parse error', async () => {
      // Manually set a non-JSON value to test error handling
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem('badjson', 'not valid json{{{');
      const result = await storage.get('badjson');
      expect(result).toBeNull();
    });
  });
});
