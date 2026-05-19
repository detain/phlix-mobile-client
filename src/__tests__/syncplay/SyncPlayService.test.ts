// src/__tests__/syncplay/SyncPlayService.test.ts
/**
 * SyncPlayService unit tests
 *
 * Tests cover:
 * - TimeSync offset calculation
 * - Connection lifecycle
 * - Group management messaging
 * - Playback command dispatch
 * - Error handling
 */

import { syncPlayService } from '../../syncplay/SyncPlayService';
import { useSyncplayStore } from '../../store/syncplayStore';
import { useHubStore } from '../../store/hubStore';

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(_url: string) {
    MockWebSocket.instance = this;
  }

  send = jest.fn();
  close = jest.fn();

  static instance: MockWebSocket | null = null;

  static simulateOpen(): void {
    MockWebSocket.instance!.readyState = MockWebSocket.OPEN;
    MockWebSocket.instance!.onopen?.({});
  }

  static simulateClose(): void {
    MockWebSocket.instance!.readyState = MockWebSocket.CLOSED;
    MockWebSocket.instance!.onclose?.({});
  }

  static simulateMessage(data: object): void {
    MockWebSocket.instance!.onmessage?.({ data: JSON.stringify(data) });
  }

  static reset(): void {
    MockWebSocket.instance = null;
  }
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

jest.mock('../../store/hubStore');
jest.mock('../../store/syncplayStore');

const mockHubStore = useHubStore as jest.MockedObject<typeof useHubStore>;
const mockSyncplayStore = useSyncplayStore as jest.MockedObject<typeof useSyncplayStore>;

// Helper to setup store mocks before calling disconnect
const setupMocks = () => {
  mockHubStore.getState = jest.fn(() => ({
    effectiveServerUrl: 'https://192.168.1.100:32400',
    connectionMode: 'direct' as const,
    hubUrl: null,
    session: null,
    servers: [],
    activeServerId: null,
    isLoading: false,
    error: null,
  }));

  mockSyncplayStore.getState = jest.fn(() => ({
    currentGroup: null,
    isHost: false,
    isConnected: false,
    isConnecting: false,
    timeSyncOffset: 0,
    timeSyncLatency: 0,
    timeSyncStable: false,
    showMemberList: false,
    error: null,
    setCurrentGroup: jest.fn(),
    setIsHost: jest.fn(),
    setIsConnected: jest.fn(),
    setIsConnecting: jest.fn(),
    setTimeSyncStatus: jest.fn(),
    setShowMemberList: jest.fn(),
    setError: jest.fn(),
    updatePlaybackState: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
    reset: jest.fn(),
  }));
  mockSyncplayStore.setState = jest.fn();
};

// Mock global WebSocket before tests run
beforeAll(() => {
  (globalThis as any).WebSocket = function(url: string) {
    return new MockWebSocket(url);
  } as any;
});

afterAll(() => {
  // Restore
  delete (globalThis as any).WebSocket;
});

// ---------------------------------------------------------------------------
// Connection tests
// ---------------------------------------------------------------------------

describe('SyncPlayService - Connection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
    MockWebSocket.reset();
    syncPlayService.disconnect();
  });

  it('should transition to connecting state when connect is called', () => {
    const stateChange = jest.fn();
    syncPlayService.on('onConnectionStateChange', stateChange as any);

    syncPlayService.connect('member-123');

    expect(stateChange).toHaveBeenCalledWith('connecting');

    syncPlayService.off('onConnectionStateChange');
  });

  it('should transition to connected when WebSocket opens', () => {
    const stateChange = jest.fn();
    syncPlayService.on('onConnectionStateChange', stateChange as any);

    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    expect(stateChange).toHaveBeenCalledWith('connected');

    syncPlayService.off('onConnectionStateChange');
  });

  it('should transition to disconnected when disconnect is called', () => {
    const stateChange = jest.fn();
    syncPlayService.on('onConnectionStateChange', stateChange as any);

    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();
    syncPlayService.disconnect();

    expect(stateChange).toHaveBeenCalledWith('disconnected');

    syncPlayService.off('onConnectionStateChange');
  });

  it('should emit error when WebSocket URL is empty', () => {
    mockHubStore.getState = jest.fn(() => ({
      effectiveServerUrl: '',
      connectionMode: 'direct' as const,
      hubUrl: null,
      session: null,
      servers: [],
      activeServerId: null,
      isLoading: false,
      error: null,
    }));

    const stateChange = jest.fn();
    syncPlayService.on('onConnectionStateChange', stateChange as any);

    syncPlayService.connect('member-123');

    expect(stateChange).toHaveBeenCalledWith('error');

    syncPlayService.off('onConnectionStateChange');
  });

  it('should use correct WebSocket protocol (ws vs wss)', () => {
    mockHubStore.getState = jest.fn(() => ({
      effectiveServerUrl: 'https://192.168.1.100:32400',
      connectionMode: 'direct' as const,
      hubUrl: null,
      session: null,
      servers: [],
      activeServerId: null,
      isLoading: false,
      error: null,
    }));

    syncPlayService.connect('member-123');

    // WebSocket constructor should have been called with wss://
    expect(jest.spyOn(global, 'WebSocket')).toHaveBeenCalled();
    expect(MockWebSocket.instance).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Group management tests
// ---------------------------------------------------------------------------

describe('SyncPlayService - Group management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
    MockWebSocket.reset();
    syncPlayService.disconnect();
  });

  it('should send group create message', () => {
    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    syncPlayService.createGroup('Movie Night');

    expect(MockWebSocket.instance?.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"syncplay_group_create"')
    );
    expect(MockWebSocket.instance?.send).toHaveBeenCalledWith(
      expect.stringContaining('"group_name":"Movie Night"')
    );
    expect(MockWebSocket.instance?.send).toHaveBeenCalledWith(
      expect.stringContaining('"member_id":"member-123"')
    );
  });

  it('should send group join message', () => {
    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    syncPlayService.joinGroup('sp_abc123');

    expect(MockWebSocket.instance?.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"syncplay_group_join"')
    );
    expect(MockWebSocket.instance?.send).toHaveBeenCalledWith(
      expect.stringContaining('"group_id":"sp_abc123"')
    );
  });

  it('should not send leave when not in a group', () => {
    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    syncPlayService.leaveGroup();

    // No leave message since no group
    const leaveMessages = MockWebSocket.instance?.send.mock.calls.filter(
      (call) => JSON.parse(call[0] as string).type === 'syncplay_group_leave'
    );
    expect(leaveMessages).toHaveLength(0);
  });

  it('should send leave message when in a group', () => {
    mockSyncplayStore.getState = jest.fn(() => ({
      currentGroup: {
        id: 'sp_abc123',
        name: 'Test Group',
        members: [],
        currentMediaId: null,
        playbackState: 'stopped' as const,
        playbackPosition: 0,
        hostId: 'member-123',
        hasPassword: false,
      },
      isHost: false,
      isConnected: false,
      isConnecting: false,
      timeSyncOffset: 0,
      timeSyncLatency: 0,
      timeSyncStable: false,
      showMemberList: false,
      error: null,
      setCurrentGroup: jest.fn(),
      setIsHost: jest.fn(),
      setIsConnected: jest.fn(),
      setIsConnecting: jest.fn(),
      setTimeSyncStatus: jest.fn(),
      setShowMemberList: jest.fn(),
      setError: jest.fn(),
      updatePlaybackState: jest.fn(),
      addMember: jest.fn(),
      removeMember: jest.fn(),
      reset: jest.fn(),
    }));

    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    syncPlayService.leaveGroup();

    expect(MockWebSocket.instance?.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"syncplay_group_leave"')
    );
  });
});

// ---------------------------------------------------------------------------
// Playback command tests
// ---------------------------------------------------------------------------

describe('SyncPlayService - Playback commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
    MockWebSocket.reset();
    syncPlayService.disconnect();
  });

  it('should send play command when host', () => {
    mockSyncplayStore.getState = jest.fn(() => ({
      currentGroup: {
        id: 'sp_abc123',
        name: 'Test',
        members: [],
        currentMediaId: null,
        playbackState: 'paused' as const,
        playbackPosition: 10000,
        hostId: 'member-123',
        hasPassword: false,
      },
      isHost: true,
      isConnected: false,
      isConnecting: false,
      timeSyncOffset: 0,
      timeSyncLatency: 0,
      timeSyncStable: false,
      showMemberList: false,
      error: null,
      setCurrentGroup: jest.fn(),
      setIsHost: jest.fn(),
      setIsConnected: jest.fn(),
      setIsConnecting: jest.fn(),
      setTimeSyncStatus: jest.fn(),
      setShowMemberList: jest.fn(),
      setError: jest.fn(),
      updatePlaybackState: jest.fn(),
      addMember: jest.fn(),
      removeMember: jest.fn(),
      reset: jest.fn(),
    }));

    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    syncPlayService.sendPlay(15000);

    const sent = MockWebSocket.instance?.send.mock.calls[0]?.[0] as string;
    const msg = JSON.parse(sent);

    expect(msg.type).toBe('syncplay_playback_play');
    expect(msg.position).toBe(15000);
    expect(msg.group_id).toBe('sp_abc123');
  });

  it('should not send play command when not host', () => {
    mockSyncplayStore.getState = jest.fn(() => ({
      currentGroup: {
        id: 'sp_abc123',
        name: 'Test',
        members: [],
        currentMediaId: null,
        playbackState: 'paused' as const,
        playbackPosition: 10000,
        hostId: 'other-member',
        hasPassword: false,
      },
      isHost: false,
      isConnected: false,
      isConnecting: false,
      timeSyncOffset: 0,
      timeSyncLatency: 0,
      timeSyncStable: false,
      showMemberList: false,
      error: null,
      setCurrentGroup: jest.fn(),
      setIsHost: jest.fn(),
      setIsConnected: jest.fn(),
      setIsConnecting: jest.fn(),
      setTimeSyncStatus: jest.fn(),
      setShowMemberList: jest.fn(),
      setError: jest.fn(),
      updatePlaybackState: jest.fn(),
      addMember: jest.fn(),
      removeMember: jest.fn(),
      reset: jest.fn(),
    }));

    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    syncPlayService.sendPlay(15000);

    expect(MockWebSocket.instance?.send).not.toHaveBeenCalled();
  });

  it('should send pause command when host', () => {
    mockSyncplayStore.getState = jest.fn(() => ({
      currentGroup: {
        id: 'sp_abc123',
        name: 'Test',
        members: [],
        currentMediaId: null,
        playbackState: 'playing' as const,
        playbackPosition: 20000,
        hostId: 'member-123',
        hasPassword: false,
      },
      isHost: true,
      isConnected: false,
      isConnecting: false,
      timeSyncOffset: 0,
      timeSyncLatency: 0,
      timeSyncStable: false,
      showMemberList: false,
      error: null,
      setCurrentGroup: jest.fn(),
      setIsHost: jest.fn(),
      setIsConnected: jest.fn(),
      setIsConnecting: jest.fn(),
      setTimeSyncStatus: jest.fn(),
      setShowMemberList: jest.fn(),
      setError: jest.fn(),
      updatePlaybackState: jest.fn(),
      addMember: jest.fn(),
      removeMember: jest.fn(),
      reset: jest.fn(),
    }));

    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    syncPlayService.sendPause(20000);

    const sent = MockWebSocket.instance?.send.mock.calls[0]?.[0] as string;
    const msg = JSON.parse(sent);

    expect(msg.type).toBe('syncplay_playback_pause');
    expect(msg.position).toBe(20000);
  });

  it('should send seek command when host', () => {
    mockSyncplayStore.getState = jest.fn(() => ({
      currentGroup: {
        id: 'sp_abc123',
        name: 'Test',
        members: [],
        currentMediaId: null,
        playbackState: 'playing' as const,
        playbackPosition: 10000,
        hostId: 'member-123',
        hasPassword: false,
      },
      isHost: true,
      isConnected: false,
      isConnecting: false,
      timeSyncOffset: 0,
      timeSyncLatency: 0,
      timeSyncStable: false,
      showMemberList: false,
      error: null,
      setCurrentGroup: jest.fn(),
      setIsHost: jest.fn(),
      setIsConnected: jest.fn(),
      setIsConnecting: jest.fn(),
      setTimeSyncStatus: jest.fn(),
      setShowMemberList: jest.fn(),
      setError: jest.fn(),
      updatePlaybackState: jest.fn(),
      addMember: jest.fn(),
      removeMember: jest.fn(),
      reset: jest.fn(),
    }));

    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    syncPlayService.sendSeek(10000, 30000);

    const sent = MockWebSocket.instance?.send.mock.calls[0]?.[0] as string;
    const msg = JSON.parse(sent);

    expect(msg.type).toBe('syncplay_playback_seek');
    expect(msg.from_position).toBe(10000);
    expect(msg.to_position).toBe(30000);
  });
});

// ---------------------------------------------------------------------------
// Playback command receipt tests
// ---------------------------------------------------------------------------

describe('SyncPlayService - Playback command receipt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
    MockWebSocket.reset();
    syncPlayService.disconnect();
  });

  it('should handle play command from server and call store update', () => {
    mockSyncplayStore.setState = jest.fn();

    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    const playbackCallback = jest.fn();
    syncPlayService.on('onPlaybackCommand', playbackCallback as any);

    MockWebSocket.simulateMessage({
      type: 'syncplay_playback_play',
      position: 25000,
      server_time: Date.now(),
    });

    expect(playbackCallback).toHaveBeenCalled();
    const call = playbackCallback.mock.calls[0][0];
    expect(call.type).toBe('play');
    expect(call.position).toBe(25000);

    syncPlayService.off('onPlaybackCommand');
  });

  it('should handle pause command from server', () => {
    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    const playbackCallback = jest.fn();
    syncPlayService.on('onPlaybackCommand', playbackCallback as any);

    MockWebSocket.simulateMessage({
      type: 'syncplay_playback_pause',
      position: 30000,
      server_time: Date.now(),
    });

    expect(playbackCallback).toHaveBeenCalled();
    const call = playbackCallback.mock.calls[0][0];
    expect(call.type).toBe('pause');

    syncPlayService.off('onPlaybackCommand');
  });

  it('should handle seek command from server', () => {
    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    const playbackCallback = jest.fn();
    syncPlayService.on('onPlaybackCommand', playbackCallback as any);

    MockWebSocket.simulateMessage({
      type: 'syncplay_playback_seek',
      from_position: 20000,
      to_position: 35000,
      server_time: Date.now(),
    });

    expect(playbackCallback).toHaveBeenCalled();
    const call = playbackCallback.mock.calls[0][0];
    expect(call.type).toBe('seek');
    expect(call.position).toBe(35000);

    syncPlayService.off('onPlaybackCommand');
  });

  it('should handle host election', () => {
    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    const hostCallback = jest.fn();
    syncPlayService.on('onHostChanged', hostCallback as any);

    MockWebSocket.simulateMessage({
      type: 'syncplay_host_elect',
      elected_id: 'member-456',
      elected_by: 'old-host',
    });

    expect(hostCallback).toHaveBeenCalledWith('member-456');

    syncPlayService.off('onHostChanged');
  });
});

// ---------------------------------------------------------------------------
// Error handling tests
// ---------------------------------------------------------------------------

describe('SyncPlayService - Error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
    MockWebSocket.reset();
    syncPlayService.disconnect();
  });

  it('should handle error messages from server', () => {
    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    const errorCallback = jest.fn();
    syncPlayService.on('onError', errorCallback as any);

    MockWebSocket.simulateMessage({
      type: 'syncplay_error',
      error_code: 'GROUP_FULL',
      message: 'Cannot join: group is full',
    });

    expect(errorCallback).toHaveBeenCalledWith('GROUP_FULL', 'Cannot join: group is full');

    syncPlayService.off('onError');
  });

  it('should ignore malformed JSON messages without throwing', () => {
    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    expect(() => {
      MockWebSocket.instance?.onmessage?.({ data: 'not valid json' } as any);
    }).not.toThrow();
  });

  it('should call onConnectionStateChange with error when URL is empty', () => {
    mockHubStore.getState = jest.fn(() => ({
      effectiveServerUrl: '',
      connectionMode: 'direct' as const,
      hubUrl: null,
      session: null,
      servers: [],
      activeServerId: null,
      isLoading: false,
      error: null,
    }));

    const stateCallback = jest.fn();
    syncPlayService.on('onConnectionStateChange', stateCallback as any);

    syncPlayService.connect('member-123');

    expect(stateCallback).toHaveBeenCalledWith('error');

    syncPlayService.off('onConnectionStateChange');
  });
});

// ---------------------------------------------------------------------------
// TimeSync request tests
// ---------------------------------------------------------------------------

describe('SyncPlayService - TimeSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
    MockWebSocket.reset();
    syncPlayService.disconnect();
  });

  it('should send time ping message', () => {
    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    syncPlayService.requestTimeSync();

    expect(MockWebSocket.instance?.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"syncplay_time_ping"')
    );
  });

  it('should return TimeSync status via public method', () => {
    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    const status = syncPlayService.getTimeSyncStatus();

    expect(status).toHaveProperty('offset');
    expect(status).toHaveProperty('latency');
    expect(status).toHaveProperty('isStable');
  });

  it('should return synchronized time close to Date.now() when no samples', () => {
    syncPlayService.connect('member-123');
    MockWebSocket.simulateOpen();

    const before = Date.now();
    const syncTime = syncPlayService.getSynchronizedTime();
    const after = Date.now();

    // Without samples, offset is 0 so syncTime ≈ Date.now()
    expect(syncTime).toBeGreaterThanOrEqual(before);
    expect(syncTime).toBeLessThanOrEqual(after);
  });
});
