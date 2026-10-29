/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/useCastStore.test.ts
import { useCastStore } from '../useCastStore';
import { castManager } from '../../api/CastManager';
import type { CastDevice } from '../../types/cast';

jest.mock('../../api/CastManager', () => ({
  castManager: {
    discover: jest.fn(),
    castTo: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    stop: jest.fn(),
    seek: jest.fn(),
    status: jest.fn(),
  },
}));

const mocked = castManager as jest.Mocked<typeof castManager>;

const chromecast: CastDevice = { backend: 'chromecast', id: 'cc1', name: 'TV' };
const dlna: CastDevice = { backend: 'dlna', id: 'udn-1', name: 'Den' };

const resetStore = () => {
  useCastStore.setState({
    devices: [],
    isDiscovering: false,
    discoverError: null,
    activeDevice: null,
    activeSession: null,
    activeMedia: null,
    transport: null,
    transportError: null,
    screenVisible: false,
  });
};

describe('useCastStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  // ── discover ──

  it('discover populates devices and clears discoverError', async () => {
    mocked.discover.mockResolvedValue([chromecast, dlna]);

    await useCastStore.getState().discover();

    const state = useCastStore.getState();
    expect(state.devices).toHaveLength(2);
    expect(state.isDiscovering).toBe(false);
    expect(state.discoverError).toBeNull();
  });

  it('discover swallows error into discoverError (loader does not throw)', async () => {
    mocked.discover.mockRejectedValue(new Error('network down'));

    await expect(useCastStore.getState().discover()).resolves.toBeUndefined();

    const state = useCastStore.getState();
    expect(state.discoverError).toBe('network down');
    expect(state.isDiscovering).toBe(false);
  });

  // ── castTo ──

  it('castTo sets activeDevice + activeSession + activeMedia', async () => {
    mocked.castTo.mockResolvedValue({ sessionId: 's1', deviceId: 'cc1', state: 'playing' });

    await useCastStore.getState().castTo(chromecast, { mediaItemId: 'm1', mediaUrl: 'u' });

    const state = useCastStore.getState();
    expect(mocked.castTo).toHaveBeenCalledWith(chromecast, { mediaItemId: 'm1', mediaUrl: 'u' });
    expect(state.activeDevice).toEqual(chromecast);
    expect(state.activeSession?.sessionId).toBe('s1');
    // M-MOBILE-16: the pill re-opens the controller from STORED media, so the
    // successful send must retain what was cast (device id alone is the
    // transport handle; the media is the re-entry contract).
    expect(state.activeMedia).toEqual({ mediaItemId: 'm1', mediaUrl: 'u' });
  });

  it('castTo sets transportError and rethrows (mutator)', async () => {
    mocked.castTo.mockRejectedValue(new Error('cast refused'));

    await expect(
      useCastStore.getState().castTo(chromecast, { mediaItemId: 'm1', mediaUrl: 'u' })
    ).rejects.toThrow('cast refused');

    expect(useCastStore.getState().transportError).toBe('cast refused');
    expect(useCastStore.getState().activeDevice).toBeNull();
  });

  // ── transport delegates to the active device ──

  it('pause/resume/seek delegate to the manager with the active device', async () => {
    useCastStore.setState({ activeDevice: chromecast });
    mocked.pause.mockResolvedValue(undefined);
    mocked.resume.mockResolvedValue(undefined);
    mocked.seek.mockResolvedValue(undefined);

    await useCastStore.getState().pause();
    await useCastStore.getState().resume();
    await useCastStore.getState().seek(30000);

    expect(mocked.pause).toHaveBeenCalledWith(chromecast);
    expect(mocked.resume).toHaveBeenCalledWith(chromecast);
    expect(mocked.seek).toHaveBeenCalledWith(chromecast, 30000);
  });

  it('transport actions no-op when there is no active device', async () => {
    await useCastStore.getState().pause();
    await useCastStore.getState().resume();
    await useCastStore.getState().seek(1000);

    expect(mocked.pause).not.toHaveBeenCalled();
    expect(mocked.resume).not.toHaveBeenCalled();
    expect(mocked.seek).not.toHaveBeenCalled();
  });

  it('pause rethrows and records transportError on failure', async () => {
    useCastStore.setState({ activeDevice: chromecast });
    mocked.pause.mockRejectedValue(new Error('boom'));

    await expect(useCastStore.getState().pause()).rejects.toThrow('boom');
    expect(useCastStore.getState().transportError).toBe('boom');
  });

  // ── refreshStatus ──

  it('refreshStatus stores the normalized transport', async () => {
    useCastStore.setState({ activeDevice: chromecast });
    mocked.status.mockResolvedValue({ active: true, state: 'playing', sessionId: 's1' });

    await useCastStore.getState().refreshStatus();

    expect(mocked.status).toHaveBeenCalledWith(chromecast);
    expect(useCastStore.getState().transport).toEqual({ active: true, state: 'playing', sessionId: 's1' });
  });

  it('refreshStatus swallows error into transportError (loader)', async () => {
    useCastStore.setState({ activeDevice: chromecast });
    mocked.status.mockRejectedValue(new Error('status timeout'));

    await expect(useCastStore.getState().refreshStatus()).resolves.toBeUndefined();
    expect(useCastStore.getState().transportError).toBe('status timeout');
  });

  it('refreshStatus no-ops without an active device', async () => {
    await useCastStore.getState().refreshStatus();
    expect(mocked.status).not.toHaveBeenCalled();
  });

  // ── disconnect vs stop ──

  it('disconnect clears the session WITHOUT stopping the device', () => {
    useCastStore.setState({
      activeDevice: chromecast,
      activeSession: { sessionId: 's1' },
      transport: { active: true },
    });

    useCastStore.getState().disconnect();

    expect(mocked.stop).not.toHaveBeenCalled();
    const state = useCastStore.getState();
    expect(state.activeDevice).toBeNull();
    expect(state.activeSession).toBeNull();
    expect(state.transport).toBeNull();
  });

  it('stopAndDisconnect stops the device THEN clears the session', async () => {
    useCastStore.setState({ activeDevice: chromecast, activeSession: { sessionId: 's1' } });
    mocked.stop.mockResolvedValue(undefined);

    await useCastStore.getState().stopAndDisconnect();

    expect(mocked.stop).toHaveBeenCalledWith(chromecast);
    expect(useCastStore.getState().activeDevice).toBeNull();
  });

  it('stopAndDisconnect on a Roku no-ops the stop call but still disconnects', async () => {
    const roku: CastDevice = { backend: 'roku', id: 'rk1', name: 'Roku' };
    useCastStore.setState({ activeDevice: roku });
    // The manager itself no-ops the Roku stop; here it simply resolves.
    mocked.stop.mockResolvedValue(undefined);

    await useCastStore.getState().stopAndDisconnect();

    expect(useCastStore.getState().activeDevice).toBeNull();
  });
});

// ── M-MOBILE-16: session-lifecycle law ───────────────────────────────────
// A dismissed Cast screen must NOT drop the controllable session; the slot
// clears only on explicit disconnect, stopAndDisconnect, or a SERVER-CONFIRMED
// end (`active: false`). The transport is server-mediated HTTP keyed by device
// id, so re-attachability survives the screen.
describe('useCastStore — M-MOBILE-16 lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  it('refreshStatus RETIRES the slot when the server reports an ended session', async () => {
    useCastStore.setState({
      activeDevice: chromecast,
      activeSession: { sessionId: 's1' },
      activeMedia: { mediaItemId: 'm1', mediaUrl: 'u', title: 'X' },
    });
    // DLNA/Chromecast `/status` maps an ended session to active:false.
    mocked.status.mockResolvedValue({ active: false });

    await useCastStore.getState().refreshStatus();

    const state = useCastStore.getState();
    expect(state.activeDevice).toBeNull();
    expect(state.activeMedia).toBeNull();
    // Retirement is a phone-side clear; it never halts the device.
    expect(mocked.stop).not.toHaveBeenCalled();
  });

  it('refreshStatus keeps the slot + media on a LIVE status', async () => {
    useCastStore.setState({
      activeDevice: chromecast,
      activeMedia: { mediaItemId: 'm1', mediaUrl: 'u', title: 'X' },
    });
    mocked.status.mockResolvedValue({ active: true, state: 'playing', sessionId: 's1' });

    await useCastStore.getState().refreshStatus();

    const state = useCastStore.getState();
    expect(state.activeDevice).toEqual(chromecast);
    expect(state.activeMedia?.title).toBe('X');
    expect(state.transport?.state).toBe('playing');
  });

  it('refreshStatus fail-safe: an ERROR never retires the session', async () => {
    useCastStore.setState({
      activeDevice: chromecast,
      activeMedia: { mediaItemId: 'm1', mediaUrl: 'u', title: 'X' },
    });
    mocked.status.mockRejectedValue(new Error('network blip'));

    await useCastStore.getState().refreshStatus();

    const state = useCastStore.getState();
    // A failed read is not a confirmed end — keep the controllable session.
    expect(state.activeDevice).toEqual(chromecast);
    expect(state.transportError).toBe('network blip');
  });

  it('disconnect clears the stored media too (explicit detach forgets everything)', () => {
    useCastStore.setState({
      activeDevice: chromecast,
      activeMedia: { mediaItemId: 'm1', mediaUrl: 'u', title: 'X' },
    });

    useCastStore.getState().disconnect();

    const state = useCastStore.getState();
    expect(state.activeDevice).toBeNull();
    expect(state.activeMedia).toBeNull();
    expect(mocked.stop).not.toHaveBeenCalled();
  });

  it('setScreenVisible tracks the Cast screen mount (pill stand-down signal)', () => {
    expect(useCastStore.getState().screenVisible).toBe(false);

    useCastStore.getState().setScreenVisible(true);
    expect(useCastStore.getState().screenVisible).toBe(true);

    useCastStore.getState().setScreenVisible(false);
    expect(useCastStore.getState().screenVisible).toBe(false);
  });

  it('the slot SURVIVES a Cast-screen dismiss while the session is live', async () => {
    // This is the regression the review found: dismissing set activeDevice to
    // null. Now dismissal only flips screenVisible; the store keeps the slot
    // so the pill (and re-entry) still reach it.
    useCastStore.setState({
      activeDevice: chromecast,
      activeMedia: { mediaItemId: 'm1', mediaUrl: 'u', title: 'X' },
    });
    mocked.status.mockResolvedValue({ active: true, state: 'playing', sessionId: 's1' });

    // Cast screen unmount path: screen reports hidden + a live status read.
    useCastStore.getState().setScreenVisible(false);
    await useCastStore.getState().refreshStatus();

    const state = useCastStore.getState();
    expect(state.screenVisible).toBe(false);
    expect(state.activeDevice).toEqual(chromecast);
    expect(state.activeMedia?.title).toBe('X');
  });
});
