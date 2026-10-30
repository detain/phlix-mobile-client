/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/utils/exitGuard.test.ts
//
// M-MOBILE-35 (review mobile__gameux m1): hardware back at a dead root used
// to quit the app with zero signal. The guard's DECISION is a pure factory
// (repo doctrine: no renderer in test deps) — these tests pin the three
// shapes of the law, and a source pin keeps the RootNavigator wiring honest.

import * as fs from 'fs';
import * as path from 'path';

import {
  createExitGuardHandler,
  EXIT_CONFIRM,
} from '../../utils/exitGuard';

describe('createExitGuardHandler (M-MOBILE-35)', () => {
  test('declines (false) whenever the navigator can still pop — pops are untouched law', () => {
    const confirmExit = jest.fn();
    const exitApp = jest.fn();
    const handler = createExitGuardHandler({
      canGoBack: () => true,
      confirmExit,
      exitApp,
    });

    expect(handler()).toBe(false);
    expect(confirmExit).not.toHaveBeenCalled();
    expect(exitApp).not.toHaveBeenCalled();
  });

  test('at a dead root: swallows the default exit (true) and raises the confirm', () => {
    const confirmExit = jest.fn();
    const exitApp = jest.fn();
    const handler = createExitGuardHandler({
      canGoBack: () => false,
      confirmExit,
      exitApp,
    });

    expect(handler()).toBe(true);
    expect(confirmExit).toHaveBeenCalledTimes(1);
    // A raised confirm has NOT exited anything — only the affirmative does.
    expect(exitApp).not.toHaveBeenCalled();
  });

  test('only the confirm\'s affirmative path leaves the app', () => {
    const exitApp = jest.fn();
    const handler = createExitGuardHandler({
      canGoBack: () => false,
      confirmExit: (onConfirm) => onConfirm(),
      exitApp,
    });

    handler();
    expect(exitApp).toHaveBeenCalledTimes(1);
  });

  test('confirm copy is stable (no silent drift of the visible strings)', () => {
    expect(EXIT_CONFIRM.title).toBe('Exit Phlix?');
    expect(EXIT_CONFIRM.cancel).toBe('Stay');
    expect(EXIT_CONFIRM.confirm).toBe('Exit');
  });
});

describe('RootNavigator wiring (M-MOBILE-35, fs source pin)', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../navigation/RootNavigator.tsx'),
    'utf8'
  );

  test('the guard rides BackHandler with the LIVE navigationRef verdict', () => {
    expect(source).toMatch(/createExitGuardHandler/);
    expect(source).toMatch(/BackHandler\.addEventListener\(\s*'hardwareBackPress'/);
    expect(source).toMatch(/navigationRef\.isReady\(\) && navigationRef\.canGoBack\(\)/);
  });

  test('iOS registers nothing (no hardware back to guard)', () => {
    expect(source).toMatch(/Platform\.OS !== 'android'/);
  });
});
