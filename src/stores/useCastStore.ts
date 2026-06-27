// src/stores/useCastStore.ts
import { create } from 'zustand';
import { castManager, type CastMediaInput } from '../api/CastManager';
import type { CastDevice, CastSession, CastStatus } from '../types/cast';

/**
 * Cast store (slice E7). Holds the discovered device list + discovery state and
 * the active cast session (device + last transport status). Convention
 * (matches useAdminStore):
 *   - LOADERS (discover, refreshStatus) swallow errors into a *Error field.
 *   - MUTATORS (castTo, pause/resume/stop/seek) set transportError AND rethrow
 *     so the screen can surface an Alert.
 *
 * `disconnect()` clears the active session WITHOUT stopping the device — the
 * remote keeps playing (mirrors the console "Esc leaves it playing"). Only
 * `stop()` / `stopAndDisconnect()` actually halt the device. The status poll
 * interval is owned by the screen (see CastScreen), not this store.
 */
interface CastState {
  // Discovery
  devices: CastDevice[];
  isDiscovering: boolean;
  discoverError: string | null;

  // Active session
  activeDevice: CastDevice | null;
  activeSession: CastSession | null;
  transport: CastStatus | null;
  transportError: string | null;

  // Actions
  discover: () => Promise<void>;
  castTo: (device: CastDevice, media: CastMediaInput) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  refreshStatus: () => Promise<void>;
  disconnect: () => void;
  stopAndDisconnect: () => Promise<void>;
}

const errMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const useCastStore = create<CastState>((set, get) => ({
  devices: [],
  isDiscovering: false,
  discoverError: null,

  activeDevice: null,
  activeSession: null,
  transport: null,
  transportError: null,

  // ── Discovery (loader: swallow → discoverError) ──
  discover: async () => {
    set({ isDiscovering: true, discoverError: null });
    try {
      const devices = await castManager.discover();
      set({ devices, isDiscovering: false });
    } catch (error) {
      set({
        discoverError: errMessage(error, 'Failed to discover cast devices'),
        isDiscovering: false,
      });
    }
  },

  // ── Send (mutator: set transportError + rethrow) ──
  castTo: async (device: CastDevice, media: CastMediaInput) => {
    set({ transportError: null });
    try {
      const session = await castManager.castTo(device, media);
      set({ activeDevice: device, activeSession: session, transport: null });
    } catch (error) {
      set({ transportError: errMessage(error, 'Failed to cast to device') });
      throw error;
    }
  },

  // ── Transport (mutators: capability gates enforced inside the manager) ──
  pause: async () => {
    const device = get().activeDevice;
    if (!device) {
      return;
    }
    set({ transportError: null });
    try {
      await castManager.pause(device);
    } catch (error) {
      set({ transportError: errMessage(error, 'Failed to pause') });
      throw error;
    }
  },

  resume: async () => {
    const device = get().activeDevice;
    if (!device) {
      return;
    }
    set({ transportError: null });
    try {
      await castManager.resume(device);
    } catch (error) {
      set({ transportError: errMessage(error, 'Failed to resume') });
      throw error;
    }
  },

  stop: async () => {
    const device = get().activeDevice;
    if (!device) {
      return;
    }
    set({ transportError: null });
    try {
      await castManager.stop(device);
    } catch (error) {
      set({ transportError: errMessage(error, 'Failed to stop') });
      throw error;
    }
  },

  seek: async (positionMs: number) => {
    const device = get().activeDevice;
    if (!device) {
      return;
    }
    set({ transportError: null });
    try {
      await castManager.seek(device, positionMs);
    } catch (error) {
      set({ transportError: errMessage(error, 'Failed to seek') });
      throw error;
    }
  },

  // ── Status (loader: swallow → transportError) ──
  refreshStatus: async () => {
    const device = get().activeDevice;
    if (!device) {
      return;
    }
    try {
      const transport = await castManager.status(device);
      set({ transport });
    } catch (error) {
      set({ transportError: errMessage(error, 'Failed to read status') });
    }
  },

  // ── Session teardown ──
  // Leaves the device playing — fire-and-forget UX (console Esc behavior).
  disconnect: () => {
    set({
      activeDevice: null,
      activeSession: null,
      transport: null,
      transportError: null,
    });
  },

  // Stops the device (capability-gated) THEN clears the session.
  stopAndDisconnect: async () => {
    await get().stop();
    get().disconnect();
  },
}));
