/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/utils/haptics.test.ts
//
// M-MOBILE-40 (review mobile__gameux m6): zero haptic feedback app-wide.
// The wrapper must fire on Android, be an honest no-op on iOS (the venue
// law: no new native pod against the W-min57 pinned Podfile.lock), never
// throw, and the review's named event classes must carry call sites.

import * as fs from 'fs';
import * as path from 'path';
import { Platform, Vibration } from 'react-native';

import { fireHaptic, HAPTIC_PATTERNS_MS } from '../../utils/haptics';

describe('fireHaptic (M-MOBILE-40)', () => {
  const realOS = Platform.OS;
  let vibrate: jest.SpyInstance;

  beforeEach(() => {
    vibrate = jest
      .spyOn(Vibration, 'vibrate')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    vibrate.mockRestore();
    (Platform as { OS: typeof realOS }).OS = realOS;
  });

  test('Android fires the per-kind pattern', () => {
    (Platform as { OS: 'android' }).OS = 'android';
    fireHaptic('light');
    expect(vibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS_MS.light);
    fireHaptic('destructive');
    expect(vibrate).toHaveBeenLastCalledWith(HAPTIC_PATTERNS_MS.destructive);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  test('iOS is a silent, side-effect-free no-op (never pretends)', () => {
    (Platform as { OS: 'ios' }).OS = 'ios';
    fireHaptic('medium');
    expect(vibrate).not.toHaveBeenCalled();
  });

  test('a throwing vibration binding never breaks the interaction', () => {
    (Platform as { OS: 'android' }).OS = 'android';
    vibrate.mockImplementation(() => {
      throw new Error('no motor');
    });
    expect(() => fireHaptic('light')).not.toThrow();
  });
});

describe('call sites the review named (fs source pins)', () => {
  const read = (rel: string) =>
    fs.readFileSync(path.resolve(__dirname, '../../..', rel), 'utf8');

  test('tab switch — light impact on tabPress', () => {
    expect(read('src/navigation/RootNavigator.tsx')).toMatch(
      /tabPress: \(\) => fireHaptic\('light'\)/
    );
  });

  test('long-press-delete start — destructive impact ×2 screens', () => {
    expect(read('src/screens/WatchHistoryScreen.tsx')).toMatch(
      /fireHaptic\('destructive'\)/
    );
    expect(read('src/screens/CollectionsScreen.tsx')).toMatch(
      /fireHaptic\('destructive'\)/
    );
  });

  test('sync-play join — medium impact on the join success', () => {
    expect(read('src/components/syncplay/SyncPlayModal.tsx')).toMatch(
      /fireHaptic\('medium'\)/
    );
  });

  test('exit confirm — destructive impact at the app-quit moment', () => {
    expect(read('src/navigation/RootNavigator.tsx')).toMatch(
      /confirmExit: \(onConfirm\) => \{\s*fireHaptic\('destructive'\)/
    );
  });
});
