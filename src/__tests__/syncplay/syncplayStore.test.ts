/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

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

// ── S298: the hub-relay pending_command consumer pair ─────────────────────────

describe('useSyncplayStore — hub-relay pending_command consumer (S298)', () => {
  const group: SyncPlayGroup = {
    id: 'sp_abc123',
    name: 'Movie Night',
    members: [],
    currentMediaId: 'media-456',
    playbackState: 'paused',
    playbackPosition: 12000,
    hostId: 'member-1',
    hasPassword: false,
  };

  const cmd = {
    type: 'pending_command' as const,
    command: 'play_media' as const,
    serverId: 'srv-1',
    mediaId: 'media-9',
    title: 'Inception',
    issuedAt: 1_700_000_000,
    source: 'alexa',
  };

  beforeEach(() => {
    useSyncplayStore.setState({
      currentGroup: null,
      pendingPlayMedia: null,
    });
  });

  it('holds the delivered command for the player load path', () => {
    expect(useSyncplayStore.getState().pendingPlayMedia).toBeNull();
    useSyncplayStore.getState().applyPendingPlayMedia(cmd);
    expect(useSyncplayStore.getState().pendingPlayMedia).toEqual(cmd);
  });

  it('writes currentMediaId into a live group — the paired caller for the carry-through', () => {
    useSyncplayStore.getState().setCurrentGroup(group);
    expect(useSyncplayStore.getState().currentGroup?.currentMediaId).toBe('media-456');

    useSyncplayStore.getState().applyPendingPlayMedia(cmd);
    expect(useSyncplayStore.getState().currentGroup?.currentMediaId).toBe('media-9');
    expect(useSyncplayStore.getState().pendingPlayMedia).toEqual(cmd);
  });

  it('works with NO group — the primary "Alexa, play X" case has no room', () => {
    expect(useSyncplayStore.getState().currentGroup).toBeNull();
    useSyncplayStore.getState().applyPendingPlayMedia(cmd);
    expect(useSyncplayStore.getState().pendingPlayMedia).toEqual(cmd);
    // No group → nothing to mutate; the player consumes pendingPlayMedia.
    expect(useSyncplayStore.getState().currentGroup).toBeNull();
  });

  it('consumePendingPlayMedia clears the slot so a session update cannot re-trigger the load', () => {
    useSyncplayStore.getState().applyPendingPlayMedia(cmd);
    useSyncplayStore.getState().consumePendingPlayMedia();
    expect(useSyncplayStore.getState().pendingPlayMedia).toBeNull();
  });

  it('setCurrentMediaId writes the media id into a live group and is a no-op without one', () => {
    useSyncplayStore.getState().setCurrentGroup(group);
    useSyncplayStore.getState().setCurrentMediaId('media-777');
    expect(useSyncplayStore.getState().currentGroup?.currentMediaId).toBe('media-777');

    useSyncplayStore.getState().setCurrentGroup(null);
    expect(() => useSyncplayStore.getState().setCurrentMediaId('media-888')).not.toThrow();
    expect(useSyncplayStore.getState().currentGroup).toBeNull();
  });

  it('reset clears the pending command slot', () => {
    useSyncplayStore.getState().applyPendingPlayMedia(cmd);
    useSyncplayStore.getState().reset();
    expect(useSyncplayStore.getState().pendingPlayMedia).toBeNull();
  });
});

// MW-125 (review mobile__crossfe #2): the server's `syncplay_playback_queue`
// fan-out now lands on a real store rail. The pairing law: the queue belongs
// to the room — leaving (setCurrentGroup(null)) must not leave a stale list
// behind for the next session.
describe('playbackQueue rail (MW-125)', () => {
  const group: SyncPlayGroup = {
    id: 'sp_pairing',
    name: 'Pairing',
    members: [],
    currentMediaId: null,
    playbackState: 'playing',
    playbackPosition: 0,
    hostId: '',
    hasPassword: false,
  };

  beforeEach(() => {
    useSyncplayStore.setState({ currentGroup: null, playbackQueue: [] });
  });

  it('setPlaybackQueue writes typed entries', () => {
    useSyncplayStore.getState().setPlaybackQueue([
      { mediaId: 'm1', name: 'One' },
      { mediaId: 'm2', name: null },
    ]);
    expect(useSyncplayStore.getState().playbackQueue).toEqual([
      { mediaId: 'm1', name: 'One' },
      { mediaId: 'm2', name: null },
    ]);
  });

  it('setCurrentGroup(null) clears the queue — the room owns it', () => {
    useSyncplayStore.getState().setCurrentGroup(group);
    useSyncplayStore.getState().setPlaybackQueue([{ mediaId: 'm1', name: 'One' }]);
    useSyncplayStore.getState().setCurrentGroup(null);
    expect(useSyncplayStore.getState().currentGroup).toBeNull();
    expect(useSyncplayStore.getState().playbackQueue).toEqual([]);
  });

  it('a group switch REPLACES the queue wholesale (no carry-over append)', () => {
    useSyncplayStore.getState().setPlaybackQueue([{ mediaId: 'old', name: null }]);
    useSyncplayStore.getState().setPlaybackQueue([{ mediaId: 'new', name: 'N' }]);
    expect(useSyncplayStore.getState().playbackQueue).toEqual([{ mediaId: 'new', name: 'N' }]);
  });

  it('reset returns the rail to empty', () => {
    useSyncplayStore.getState().setPlaybackQueue([{ mediaId: 'm1', name: null }]);
    useSyncplayStore.getState().reset();
    expect(useSyncplayStore.getState().playbackQueue).toEqual([]);
  });
});
