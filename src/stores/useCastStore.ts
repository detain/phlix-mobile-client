/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/useCastStore.ts
import { create } from 'zustand';
import { castManager, type CastMediaInput } from '../api/CastManager';
import type { CastDevice, CastSession, CastStatus } from '../types/cast';

/**
 * Cast store (slice E7). Holds the discovered device list + discovery state and
 * the active cast session (device + media + last transport status). Convention
 * (matches useAdminStore):
 *   - LOADERS (discover, refreshStatus) swallow errors into a *Error field.
 *   - MUTATORS (castTo, pause/resume/stop/seek) set transportError AND rethrow
 *     so the screen can surface an Alert.
 *
 * Session lifecycle law (M-MOBILE-16): the cast is SERVER-MEDIATED — every
 * transport call is plain HTTP addressed by device id, so a session stays
 * re-attachable as long as we keep `activeDevice`. Dismissing the Cast screen
 * therefore does NOT touch this state: Done means "close this screen", not
 * "drop the session". The root-mounted CastSessionPill is the re-entry handle
 * while the screen is closed (`screenVisible` tells the pill to stand down
 * while the screen itself is up). The slot is cleared only by:
 *   - `disconnect()`        — explicit "Switch device" detach; the remote
 *                             KEEPS playing (mirrors console "Esc leaves it
 *                             playing");
 *   - `stopAndDisconnect()` — halt the device (capability-gated) then clear;
 *   - `refreshStatus()`     — a fresh status reading `active: false` is the
 *                             server CONFIRMING its session map has no entry
 *                             for this device anymore → the playback ended on
 *                             its own; a status ERROR never retires (fail-safe).
 * The status poll interval is owned by the consumers (CastScreen while open,
 * CastSessionPill while closed), not this store.
 */
interface CastState {
  // Discovery
  devices: CastDevice[];
  isDiscovering: boolean;
  discoverError: string | null;

  // Active session
  activeDevice: CastDevice | null;
  activeSession: CastSession | null;
  /** What was cast — the pill re-opens the controller from these, never route params. */
  activeMedia: CastMediaInput | null;
  transport: CastStatus | null;
  transportError: string | null;
  /** CastScreen is mounted; the pill hides while true (no double surface). */
  screenVisible: boolean;

  // Actions
  discover: () => Promise<void>;
  castTo: (device: CastDevice, media: CastMediaInput) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  refreshStatus: () => Promise<void>;
  setScreenVisible: (visible: boolean) => void;
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
  activeMedia: null,
  transport: null,
  transportError: null,
  screenVisible: false,

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
      set({
        activeDevice: device,
        activeSession: session,
        activeMedia: media,
        transport: null,
      });
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
      if (transport.active === false) {
        // Server-confirmed ended: its per-(device,user) session map no longer
        // holds this cast, so the phone-retained slot is stale — retire it
        // (same clear as an explicit detach; the pill disappears with it).
        get().disconnect();
        return;
      }
      set({ transport });
    } catch (error) {
      // A failed read says nothing about the session — keep the slot (fail-safe).
      set({ transportError: errMessage(error, 'Failed to read status') });
    }
  },

  setScreenVisible: (visible: boolean) => {
    set({ screenVisible: visible });
  },

  // ── Session teardown ──
  // Explicit detach: forget the session WITHOUT stopping the device — the
  // remote keeps playing (console Esc behavior). Reaching this from outside
  // the Cast screen is exactly the M-MOBILE-16 bug this law closes: Done no
  // longer calls it; only "Switch device" inside the transport view does.
  disconnect: () => {
    set({
      activeDevice: null,
      activeSession: null,
      activeMedia: null,
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
