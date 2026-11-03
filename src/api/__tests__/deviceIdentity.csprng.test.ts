/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/__tests__/deviceIdentity.csprng.test.ts
// M7 (deferred lane): the CSPRNG→UUID v4 mapping is pure arithmetic — pinned
// directly — plus the async generator's native-present and native-absent
// arms. (The sibling deviceIdentity.test.ts covers the AsyncStorage
// persistence laws unchanged: with no PhlixRandom module under Jest it
// exercises exactly the documented Math.random fallback.)
import { NativeModules } from 'react-native';
import { uuidFromCsprngHex, generateUuidV4Async } from '../deviceIdentity';
import { nativeRandomHex } from '../../native/PhlixRandom';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('uuidFromCsprngHex (pure RFC-4122 mapping)', () => {
  it('maps a full-entropy hex block onto the v4 template', () => {
    const uuid = uuidFromCsprngHex('0123456789abcdef0123456789abcdef');
    // Layout, spelled out (input '0123456789abcdef' x2 — index 13..15 = 'def'):
    //  bytes 0-3  -> time_low          '01234567'
    //  bytes 4-5  -> time_mid          '89ab'
    //  byte  6    -> '4' + hex[13..16) -> '4def' (hex[12] 'c' is replaced)
    //  byte  7    -> variant ((0x0 & 3) | 8) = '8' + hex[17..20) '123'
    //  bytes 8-15 -> node              hex[20..32) = '456789abcdef'
    expect(uuid).toBe('01234567-89ab-4def-8123-456789abcdef');
    expect(uuid).toMatch(UUID_V4);
  });

  it('forces variant bits 10xx for every possible clock-seq byte', () => {
    for (const nibble of ['0', '4', '8', 'c', 'f', 'a']) {
      const hex = nibble.repeat(32);
      const uuid = uuidFromCsprngHex(hex);
      expect(uuid).not.toBeNull();
      expect(uuid!.split('-')[3][0]).toMatch(/^[89ab]$/);
    }
  });

  it('rejects malformed input with null (parse boundary)', () => {
    expect(uuidFromCsprngHex('')).toBeNull();
    expect(uuidFromCsprngHex('deadbeef')).toBeNull();
    expect(uuidFromCsprngHex('g'.repeat(32))).toBeNull(); // non-hex
    expect(uuidFromCsprngHex('0'.repeat(33))).toBeNull();
  });
});

describe('generateUuidV4Async', () => {
  afterEach(() => {
    delete (NativeModules as Record<string, unknown>).PhlixRandom;
    jest.restoreAllMocks();
  });

  it('uses native CSPRNG bytes when the module is present', async () => {
    const randomHex = jest.fn().mockResolvedValue('ffffffffffffffffffffffffffffffff');
    (NativeModules as Record<string, unknown>).PhlixRandom = { randomHex };
    const uuid = await generateUuidV4Async();
    expect(randomHex).toHaveBeenCalledWith(16);
    expect(uuid).toMatch(UUID_V4);
    // all-f input: version nibble forced to 4, variant to b.
    expect(uuid).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('falls back to the Math.random template when the native call rejects', async () => {
    (NativeModules as Record<string, unknown>).PhlixRandom = {
      randomHex: jest.fn().mockRejectedValue(new Error('E_RANDOM_NATIVE')),
    };
    const uuid = await generateUuidV4Async();
    expect(uuid).toMatch(UUID_V4);
  });

  it('falls back when the native module is absent (Jest posture)', async () => {
    const uuid = await generateUuidV4Async();
    expect(uuid).toMatch(UUID_V4);
  });

  it('treats a malformed native return as unavailable', async () => {
    (NativeModules as Record<string, unknown>).PhlixRandom = {
      randomHex: jest.fn().mockResolvedValue('nope'),
    };
    await expect(nativeRandomHex(16)).resolves.toBeNull();
    const uuid = await generateUuidV4Async();
    expect(uuid).toMatch(UUID_V4);
  });
});
