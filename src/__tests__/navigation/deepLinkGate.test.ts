/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/navigation/deepLinkGate.test.ts
//
// M-MOBILE-67 (review mobile__gameux Major 9): park-and-replay for deep links
// that arrive while the app is signed out. The gate is dependency-injected
// (source / resolver / dispatcher) precisely so this suite needs no react-native
// Linking mock and no live container.

import {
  createGatedLinking,
  parkPendingDeepLink,
  peekPendingDeepLink,
  takePendingDeepLink,
  replayDeepLinkUrl,
  type DeepLinkSource,
} from '../../navigation/deepLinkGate';
import { PHLIX_LINKING, PHLIX_LINKING_CONFIG } from '../../navigation/linking';

function makeFakeSource() {
  let initial: string | null = null;
  const listeners: Array<(url: string) => void> = [];
  const source: DeepLinkSource = {
    getInitialURL: async () => initial,
    addURLListener: (onUrl) => {
      listeners.push(onUrl);
      return () => {
        const i = listeners.indexOf(onUrl);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
  };
  return {
    source,
    setInitial: (url: string | null) => {
      initial = url;
    },
    emit: (url: string) => listeners.forEach((l) => l(url)),
    listenerCount: () => listeners.length,
  };
}

beforeEach(() => {
  // Drain any parked URL between tests (take is the only destructive seam).
  takePendingDeepLink();
});

describe('park slot — latest wins, drain once', () => {
  it('parks, peeks without draining, and drains exactly once', () => {
    parkPendingDeepLink('phlix://media/1');
    expect(peekPendingDeepLink()).toBe('phlix://media/1');
    expect(takePendingDeepLink()).toBe('phlix://media/1');
    expect(takePendingDeepLink()).toBeNull();
  });

  it('a newer link supersedes the parked one', () => {
    parkPendingDeepLink('phlix://media/1');
    parkPendingDeepLink('phlix://settings');
    expect(takePendingDeepLink()).toBe('phlix://settings');
  });
});

describe('createGatedLinking — closed gate parks, open gate forwards', () => {
  it('keeps the registered prefixes and config object identity', () => {
    const fake = makeFakeSource();
    const linking = createGatedLinking(fake.source, () => false);
    expect(linking.prefixes).toEqual(PHLIX_LINKING.prefixes);
    expect(linking.config).toBe(PHLIX_LINKING_CONFIG);
  });

  it('a warm URL while signed out is PARKED and never reaches the container', () => {
    const fake = makeFakeSource();
    const linking = createGatedLinking(fake.source, () => false);
    const received: Array<string | undefined> = [];
    linking.subscribe!((url) => received.push(url));
    fake.emit('phlix://media/42');
    expect(received).toEqual([]);
    expect(peekPendingDeepLink()).toBe('phlix://media/42');
  });

  it('the same URL with the gate open goes straight through', () => {
    const fake = makeFakeSource();
    const linking = createGatedLinking(fake.source, () => true);
    const received: Array<string | undefined> = [];
    linking.subscribe!((url) => received.push(url));
    fake.emit('phlix://media/42');
    expect(received).toEqual(['phlix://media/42']);
    expect(peekPendingDeepLink()).toBeNull();
  });

  it('isReady is consulted per-event, not captured at build', async () => {
    const fake = makeFakeSource();
    let authed = false;
    const linking = createGatedLinking(fake.source, () => authed);
    const received: Array<string | undefined> = [];
    linking.subscribe!((url) => received.push(url));

    fake.emit('phlix://media/1'); // signed out → parked
    expect(received).toEqual([]);

    authed = true; // sign-in happens
    fake.emit('phlix://media/2'); // now forwarded live
    expect(received).toEqual(['phlix://media/2']);
    // …and the earlier link is still parked for the drain effect:
    expect(peekPendingDeepLink()).toBe('phlix://media/1');
  });

  it('getInitialURL while signed out yields null and parks the URL', async () => {
    const fake = makeFakeSource();
    fake.setInitial('phlix://play/7');
    const linking = createGatedLinking(fake.source, () => false);
    const url = await linking.getInitialURL!();
    expect(url).toBeNull();
    expect(peekPendingDeepLink()).toBe('phlix://play/7');
  });

  it('getInitialURL with the gate open passes the URL through untouched', async () => {
    const fake = makeFakeSource();
    fake.setInitial('phlix://play/7');
    const linking = createGatedLinking(fake.source, () => true);
    const url = await linking.getInitialURL!();
    expect(url).toBe('phlix://play/7');
    expect(peekPendingDeepLink()).toBeNull();
  });

  it('getInitialURL with no URL at all neither parks nor throws', async () => {
    const fake = makeFakeSource();
    fake.setInitial(null);
    const linking = createGatedLinking(fake.source, () => false);
    await expect(linking.getInitialURL!()).resolves.toBeNull();
    expect(peekPendingDeepLink()).toBeNull();
  });

  it('unsubscribe detaches the listener', () => {
    const fake = makeFakeSource();
    const linking = createGatedLinking(fake.source, () => true);
    const unsub = linking.subscribe!(() => {});
    expect(fake.listenerCount()).toBe(1);
    unsub?.();
    expect(fake.listenerCount()).toBe(0);
  });
});

describe('replayDeepLinkUrl — production pipeline, injected seams', () => {
  const fakeState = { index: 0, routes: [{ name: 'Main', key: 'Main' }] };
  const resolveHit = () => fakeState;
  const resolveMiss = () => undefined;

  it('a mapped URL dispatches a reset with the resolved state', () => {
    const dispatched: any[] = [];
    const ok = replayDeepLinkUrl(
      'phlix://media/9',
      (action) => dispatched.push(action),
      resolveHit
    );
    expect(ok).toBe(true);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe('RESET');
    expect(dispatched[0].payload).toBe(fakeState);
  });

  it('a foreign scheme resolves nothing and dispatches nothing', () => {
    const dispatched: any[] = [];
    const ok = replayDeepLinkUrl(
      'https://example.com/media/9',
      (action) => dispatched.push(action),
      resolveHit
    );
    expect(ok).toBe(false);
    expect(dispatched).toEqual([]);
  });

  it('an unmapped phlix path is dropped, per THE LAW (no phantom routes)', () => {
    const dispatched: any[] = [];
    const ok = replayDeepLinkUrl(
      'phlix://totally-made-up',
      (action) => dispatched.push(action),
      resolveMiss
    );
    expect(ok).toBe(false);
    expect(dispatched).toEqual([]);
  });
});
