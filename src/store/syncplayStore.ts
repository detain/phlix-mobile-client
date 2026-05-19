// src/store/syncplayStore.ts
import { create } from 'zustand';
import type { SyncPlayGroup, SyncPlayMember } from '../syncplay/SyncPlayService';

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
  addMember: (member: SyncPlayMember) => void;
  removeMember: (memberId: string) => void;
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
