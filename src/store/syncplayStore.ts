/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/store/syncplayStore.ts
import { create } from 'zustand';
import type { SyncPlayGroup, SyncPlayMember } from '../syncplay/SyncPlayService';
import type { PendingPlayMediaCommand } from '../syncplay/hubRelay';

interface SyncplayState {
  // Current group
  currentGroup: SyncPlayGroup | null;
  isHost: boolean;

  // Connection
  isConnected: boolean;
  isConnecting: boolean;

  // Time sync
  timeSyncOffset: number;
  timeSyncLatency: number;
  timeSyncStable: boolean;

  // S298: a hub-relay `pending_command` / `play_media` frame awaiting the
  // player's load-a-new-title path. Cleared by consumePendingPlayMedia.
  pendingPlayMedia: PendingPlayMediaCommand | null;

  // UI state
  showMemberList: boolean;
  error: string | null;

  // Actions
  setCurrentGroup: (group: SyncPlayGroup | null) => void;
  setIsHost: (isHost: boolean) => void;
  setIsConnected: (connected: boolean) => void;
  setIsConnecting: (connecting: boolean) => void;
  setTimeSyncStatus: (status: { offset: number; latency: number; isStable: boolean }) => void;
  setShowMemberList: (show: boolean) => void;
  setError: (error: string | null) => void;
  updatePlaybackState: (state: SyncPlayGroup['playbackState'], position: number) => void;
  setCurrentMediaId: (mediaId: string) => void;
  addMember: (member: SyncPlayMember) => void;
  removeMember: (memberId: string) => void;
  applyPendingPlayMedia: (command: PendingPlayMediaCommand) => void;
  consumePendingPlayMedia: () => void;
  reset: () => void;
}

const initialState = {
  currentGroup: null,
  isHost: false,
  isConnected: false,
  isConnecting: false,
  timeSyncOffset: 0,
  timeSyncLatency: 0,
  timeSyncStable: false,
  pendingPlayMedia: null,
  showMemberList: false,
  error: null,
};

export const useSyncplayStore = create<SyncplayState>((set, get) => ({
  ...initialState,

  setCurrentGroup: (group) => set({ currentGroup: group }),

  setIsHost: (isHost) => set({ isHost }),

  setIsConnected: (isConnected) => set({ isConnected }),

  setIsConnecting: (isConnecting) => set({ isConnecting }),

  setTimeSyncStatus: (status) =>
    set({
      timeSyncOffset: status.offset,
      timeSyncLatency: status.latency,
      timeSyncStable: status.isStable,
    }),

  setShowMemberList: (showMemberList) => set({ showMemberList }),

  setError: (error) => set({ error }),

  updatePlaybackState: (playbackState, playbackPosition) => {
    const { currentGroup } = get();
    if (!currentGroup) {
      return;
    }

    set({
      currentGroup: {
        ...currentGroup,
        playbackState,
        playbackPosition,
      },
    });
  },

  setCurrentMediaId: (mediaId) => {
    const { currentGroup } = get();
    if (!currentGroup) {
      return;
    }

    set({
      currentGroup: {
        ...currentGroup,
        currentMediaId: mediaId,
      },
    });
  },

  /**
   * Adopt a hub-relay `pending_command` / `play_media` frame (S298).
   *
   * The hub's SyncPlay relay delivers "Alexa, play X" to the app's open
   * `:8804` socket (see `src/syncplay/hubRelay.ts`) REGARDLESS of SyncPlay
   * room membership — the primary case has no room at all. This action is the
   * store-side consumer:
   *
   * - `pendingPlayMedia` holds the command for the player's load-a-new-title
   *   path (the ONLY place that can start playback from a bare media id).
   * - When a group exists, `currentMediaId` is written into it — the paired
   *   caller for the `current_media_id` carry-through in
   *   `SyncPlayService.handleGroupState()` (`?? null` at the wire boundary,
   *   produced here by the hub consumer), so the field is not dead wiring.
   */
  applyPendingPlayMedia: (command) => {
    set({ pendingPlayMedia: command });
    const { currentGroup } = get();
    if (currentGroup) {
      set({
        currentGroup: {
          ...currentGroup,
          currentMediaId: command.mediaId,
        },
      });
    }
  },

  /**
   * Mark the pending play-media command as handled (the player's load path
   * took it over). Clears the store slot so a later session update cannot
   * re-trigger the load.
   */
  consumePendingPlayMedia: () => {
    set({ pendingPlayMedia: null });
  },

  addMember: (member) => {
    const { currentGroup } = get();
    if (!currentGroup) {
      return;
    }

    // Avoid duplicates
    const existing = currentGroup.members.some((m) => m.id === member.id);
    if (existing) {
      return;
    }

    set({
      currentGroup: {
        ...currentGroup,
        members: [...currentGroup.members, member],
      },
    });
  },

  removeMember: (memberId) => {
    const { currentGroup } = get();
    if (!currentGroup) {
      return;
    }

    set({
      currentGroup: {
        ...currentGroup,
        members: currentGroup.members.filter((m) => m.id !== memberId),
      },
    });
  },

  reset: () => set(initialState),
}));

export default useSyncplayStore;
