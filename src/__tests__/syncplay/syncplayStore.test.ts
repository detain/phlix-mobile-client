// src/__tests__/syncplay/syncplayStore.test.ts
import { useSyncplayStore } from '../../store/syncplayStore';
import type { SyncPlayGroup, SyncPlayMember } from '../../syncplay/SyncPlayService';

describe('useSyncplayStore', () => {
  const mockMember: SyncPlayMember = {
    id: 'member-1',
    name: 'Alice',
    isHost: true,
    joinedAt: Date.now(),
  };

  const mockGroup: SyncPlayGroup = {
    id: 'sp_abc123',
    name: 'Movie Night',
    members: [mockMember],
    currentMediaId: 'media-456',
    playbackState: 'paused',
    playbackPosition: 12000,
    hostId: 'member-1',
    hasPassword: false,
  };

  beforeEach(() => {
    useSyncplayStore.setState({
      currentGroup: null,
      isHost: false,
      isConnected: false,
      isConnecting: false,
      timeSyncOffset: 0,
      timeSyncLatency: 0,
      timeSyncStable: false,
      showMemberList: false,
      error: null,
    });
  });

  describe('setCurrentGroup', () => {
    it('should set the current group', () => {
      useSyncplayStore.getState().setCurrentGroup(mockGroup);

      const state = useSyncplayStore.getState();
      expect(state.currentGroup).toEqual(mockGroup);
      expect(state.currentGroup?.id).toBe('sp_abc123');
    });

    it('should clear the current group when set to null', () => {
      useSyncplayStore.getState().setCurrentGroup(mockGroup);
      useSyncplayStore.getState().setCurrentGroup(null);

      expect(useSyncplayStore.getState().currentGroup).toBeNull();
    });
  });

  describe('setIsHost', () => {
    it('should set isHost to true', () => {
      useSyncplayStore.getState().setIsHost(true);
      expect(useSyncplayStore.getState().isHost).toBe(true);
    });

    it('should set isHost to false', () => {
      useSyncplayStore.getState().setCurrentGroup(mockGroup);
      useSyncplayStore.getState().setIsHost(false);
      expect(useSyncplayStore.getState().isHost).toBe(false);
    });
  });

  describe('setIsConnected / setIsConnecting', () => {
    it('should update isConnecting flag', () => {
      useSyncplayStore.getState().setIsConnecting(true);
      expect(useSyncplayStore.getState().isConnecting).toBe(true);

      useSyncplayStore.getState().setIsConnecting(false);
      expect(useSyncplayStore.getState().isConnecting).toBe(false);
    });

    it('should update isConnected flag', () => {
      useSyncplayStore.getState().setIsConnected(true);
      expect(useSyncplayStore.getState().isConnected).toBe(true);

      useSyncplayStore.getState().setIsConnected(false);
      expect(useSyncplayStore.getState().isConnected).toBe(false);
    });
  });

  describe('setTimeSyncStatus', () => {
    it('should update time sync fields', () => {
      useSyncplayStore.getState().setTimeSyncStatus({
        offset: 42,
        latency: 15,
        isStable: true,
      });

      const state = useSyncplayStore.getState();
      expect(state.timeSyncOffset).toBe(42);
      expect(state.timeSyncLatency).toBe(15);
      expect(state.timeSyncStable).toBe(true);
    });

    it('should handle unstable sync', () => {
      useSyncplayStore.getState().setTimeSyncStatus({
        offset: -5,
        latency: 80,
        isStable: false,
      });

      const state = useSyncplayStore.getState();
      expect(state.timeSyncStable).toBe(false);
    });
  });

  describe('setShowMemberList', () => {
    it('should toggle member list visibility', () => {
      expect(useSyncplayStore.getState().showMemberList).toBe(false);

      useSyncplayStore.getState().setShowMemberList(true);
      expect(useSyncplayStore.getState().showMemberList).toBe(true);

      useSyncplayStore.getState().setShowMemberList(false);
      expect(useSyncplayStore.getState().showMemberList).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set an error message', () => {
      useSyncplayStore.getState().setError('Connection failed');

      expect(useSyncplayStore.getState().error).toBe('Connection failed');
    });

    it('should clear error when set to null', () => {
      useSyncplayStore.getState().setError('Some error');
      useSyncplayStore.getState().setError(null);

      expect(useSyncplayStore.getState().error).toBeNull();
    });
  });

  describe('updatePlaybackState', () => {
    it('should update playback state and position', () => {
      useSyncplayStore.getState().setCurrentGroup(mockGroup);

      useSyncplayStore.getState().updatePlaybackState('playing', 30000);

      const state = useSyncplayStore.getState();
      expect(state.currentGroup?.playbackState).toBe('playing');
      expect(state.currentGroup?.playbackPosition).toBe(30000);
    });

    it('should not throw when currentGroup is null', () => {
      expect(() => {
        useSyncplayStore.getState().updatePlaybackState('playing', 1000);
      }).not.toThrow();
    });

    it('should handle pause state', () => {
      useSyncplayStore.getState().setCurrentGroup(mockGroup);

      useSyncplayStore.getState().updatePlaybackState('paused', 5000);

      const state = useSyncplayStore.getState();
      expect(state.currentGroup?.playbackState).toBe('paused');
      expect(state.currentGroup?.playbackPosition).toBe(5000);
    });
  });

  describe('addMember', () => {
    it('should add a new member to the group', () => {
      useSyncplayStore.getState().setCurrentGroup(mockGroup);

      const newMember: SyncPlayMember = {
        id: 'member-2',
        name: 'Bob',
        isHost: false,
        joinedAt: Date.now(),
      };

      useSyncplayStore.getState().addMember(newMember);

      const state = useSyncplayStore.getState();
      expect(state.currentGroup?.members).toHaveLength(2);
      expect(state.currentGroup?.members[1].name).toBe('Bob');
    });

    it('should not add duplicate member', () => {
      useSyncplayStore.getState().setCurrentGroup(mockGroup);

      useSyncplayStore.getState().addMember(mockMember);

      const state = useSyncplayStore.getState();
      expect(state.currentGroup?.members).toHaveLength(1);
    });

    it('should not throw when currentGroup is null', () => {
      expect(() => {
        useSyncplayStore.getState().addMember(mockMember);
      }).not.toThrow();
    });
  });

  describe('removeMember', () => {
    it('should remove a member from the group', () => {
      useSyncplayStore.getState().setCurrentGroup(mockGroup);

      const member2: SyncPlayMember = {
        id: 'member-2',
        name: 'Bob',
        isHost: false,
        joinedAt: Date.now(),
      };

      useSyncplayStore.getState().addMember(member2);
      useSyncplayStore.getState().removeMember('member-2');

      const state = useSyncplayStore.getState();
      expect(state.currentGroup?.members).toHaveLength(1);
      expect(state.currentGroup?.members[0].id).toBe('member-1');
    });

    it('should not throw when currentGroup is null', () => {
      expect(() => {
        useSyncplayStore.getState().removeMember('member-x');
      }).not.toThrow();
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      useSyncplayStore.getState().setCurrentGroup(mockGroup);
      useSyncplayStore.getState().setIsHost(true);
      useSyncplayStore.getState().setIsConnected(true);
      useSyncplayStore.getState().setTimeSyncStatus({
        offset: 100,
        latency: 50,
        isStable: true,
      });
      useSyncplayStore.getState().setShowMemberList(true);
      useSyncplayStore.getState().setError('Some error');

      useSyncplayStore.getState().reset();

      const state = useSyncplayStore.getState();
      expect(state.currentGroup).toBeNull();
      expect(state.isHost).toBe(false);
      expect(state.isConnected).toBe(false);
      expect(state.isConnecting).toBe(false);
      expect(state.timeSyncOffset).toBe(0);
      expect(state.timeSyncLatency).toBe(0);
      expect(state.timeSyncStable).toBe(false);
      expect(state.showMemberList).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
