/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/syncplay/SyncPlayService.test.ts
/**
 * SyncPlayService unit tests
 *
 * Tests cover:
 * - Connection lifecycle over the REAL transport law (direct `:8097` +
 *   `?token=`; relay `:8804` + bearer subprotocol) — endpoint resolution is
 *   async (token vault), so assertions pump microtasks before inspecting the
 *   constructed socket.
 * - Group-state parsing with HONEST wire shapes: `members` as a DICTIONARY
 *   keyed by member id, `group_id`/`group_name`, `your_id` identity (H2/H3/H4).
 * - Frame-TYPE dispatch for joins (top-level INFO fields) and departures
 *   (snapshot diff) — no prose sniffing (H3).
 * - `playback_sync` inbound re-anchor + outbound report shape.
 * - NTP math (t3 = t2 law, rtt < 0 rejection), reconnect ladder (capped,
 *   jittered, self-terminating), send() fail-loud, password_hash gate.
 */

import { createHash } from 'crypto';
import { syncPlayService } from '../../syncplay/SyncPlayService';
import { useSyncplayStore } from '../../store/syncplayStore';
import { useHubStore } from '../../store/hubStore';
import { secureStorage } from '../../services/SecureStorage';
import { __resetRelayTokenProvidersForTests } from '../../syncplay/wsEndpoint';

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

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols ?? null;
    MockWebSocket.builds += 1;
    MockWebSocket.instance = this;
    MockWebSocket.lastUrl = url;
    MockWebSocket.lastProtocols = protocols ?? null;
  }

  url: string;
  protocols: string | string[] | null;

  send = jest.fn();
  close = jest.fn();

  static instance: MockWebSocket | null = null;
  static lastUrl: string | null = null;
  static lastProtocols: string | string[] | null = null;
  /** Count of constructed sockets — the ladder test pins REDIALS by number. */
  static builds = 0;

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
    MockWebSocket.lastUrl = null;
    MockWebSocket.lastProtocols = null;
    MockWebSocket.builds = 0;
  }
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../store/hubStore');
jest.mock('../../store/syncplayStore');
jest.mock('../../services/SecureStorage', () => ({
  __esModule: true,
  default: { getAccessToken: jest.fn(), getRefreshToken: jest.fn() },
  secureStorage: { getAccessToken: jest.fn(), getRefreshToken: jest.fn() },
}));
// The relay-token MINT (hub REST round-trip) is another module's contract;
// this suite only pins that the endpoint builder USES it behind the bearer
// subprotocol.
jest.mock('../../hub/RelayTokenProvider', () => ({
  __esModule: true,
  createHubRelayTokenProvider: jest.fn(() => jest.fn(async () => 'relay-token-1')),
}));

const mockHubStore = useHubStore as jest.MockedObject<typeof useHubStore>;
const mockSyncplayStore = useSyncplayStore as jest.MockedObject<typeof useSyncplayStore>;
const mockSecureStorage = secureStorage as jest.MockedObject<typeof secureStorage>;

const DIRECT_JWT = 'jwt-direct-token';

const hubState = (overrides: Record<string, unknown> = {}) => ({
  effectiveServerUrl: 'https://192.168.1.100:32400',
  connectionMode: 'direct' as const,
  hubUrl: null,
  session: null,
  servers: [],
  activeServerId: null,
  isLoading: false,
  error: null,
  ...overrides,
});

const storeState = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

// Helper to setup store mocks before calling disconnect
const setupMocks = (
  hubOverrides: Record<string, unknown> = {},
  syncplayOverrides: Record<string, unknown> = {}
) => {
  mockHubStore.getState = jest.fn(() =>
    hubState(hubOverrides)) as unknown as typeof mockHubStore.getState;

  mockSyncplayStore.getState = jest.fn(() =>
    storeState(syncplayOverrides)) as unknown as typeof mockSyncplayStore.getState;
  mockSyncplayStore.setState = jest.fn();
  mockSecureStorage.getAccessToken.mockResolvedValue(DIRECT_JWT);
};

// The endpoint resolve is Promise-based (token vault read on every lane);
// pump enough microtasks for `openSocket` to construct the socket.
const pump = async (): Promise<void> => {
  for (let i = 0; i < 16; i += 1) {
    await Promise.resolve();
  }
};

// Find the first sent WS message matching `type`. NOTE: handleOpen() calls
// startSyncInterval() which fires a `syncplay_time_ping` immediately on open, so
// callers MUST NOT assume the playback command is `send.mock.calls[0]` — search
// by type instead.
const findSentMessage = (type: string): Record<string, unknown> | undefined =>
  MockWebSocket.instance?.send.mock.calls
    .map((call) => JSON.parse(call[0] as string) as Record<string, unknown>)
    .find((msg) => msg.type === type);

// Mock global WebSocket before tests run.
//
// SyncPlayService.send() gates on `this.ws?.readyState === WebSocket.OPEN`, so
// the global shim MUST carry the same readyState constants as MockWebSocket
// (OPEN === 1). Without them `WebSocket.OPEN` is undefined and send() never
// fires even after simulateOpen(). We point the global straight at MockWebSocket
// (a real class with the static constants), and `new WebSocket(url)` then both
// constructs the instance and assigns `MockWebSocket.instance`.
beforeAll(() => {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
});

afterAll(() => {
  // Restore
  delete (globalThis as unknown as { WebSocket?: unknown }).WebSocket;
});

beforeEach(() => {
  __resetRelayTokenProvidersForTests();
});

// ---------------------------------------------------------------------------
// Connection tests — transport law (audit H1/M7)
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

  it('dials the dedicated :8097 listener with the JWT query token (H1)', async () => {
    syncPlayService.connect('member-123');
    await pump();

    expect(MockWebSocket.instance).not.toBeNull();
    expect(MockWebSocket.lastUrl).toBe(
      `wss://192.168.1.100:8097/api/v1/syncplay/ws?token=${DIRECT_JWT}`
    );
    // Direct lane = query carrier (current :8097 law), NOT the bearer
    // subprotocol — that belongs to the hub relay only.
    expect(MockWebSocket.lastProtocols).toBeNull();
  });

  it('relay mode dials hub :8804 /syncplay/{server_id} with the bearer subprotocol (M7)', async () => {
    setupMocks({
      connectionMode: 'relay',
      hubUrl: 'https://hub.example.com',
      activeServerId: 'srv-9',
      session: { accessToken: 'hub-jwt', refreshToken: 'r', expiresAt: 0, userId: 'u' },
    });

    syncPlayService.connect('member-123');
    await pump();

    expect(MockWebSocket.lastUrl).toBe('wss://hub.example.com:8804/syncplay/srv-9');
    expect(MockWebSocket.lastProtocols).toEqual(['bearer', 'relay-token-1']);
    // S237: the relay refuses query tokens — none may leak into the URL.
    expect(MockWebSocket.lastUrl).not.toContain('token=');
  });

  it('does NOT open a tokenless socket when the vault is empty', async () => {
    mockSecureStorage.getAccessToken.mockResolvedValueOnce(null);

    const stateChange = jest.fn();
    syncPlayService.on('onConnectionStateChange', stateChange as any);

    syncPlayService.connect('member-123');
    await pump();

    expect(MockWebSocket.instance).toBeNull();
    expect(stateChange).toHaveBeenCalledWith('error');

    syncPlayService.off('onConnectionStateChange');
  });

  it('should transition to connected when WebSocket opens', async () => {
    const stateChange = jest.fn();
    syncPlayService.on('onConnectionStateChange', stateChange as any);

    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    expect(stateChange).toHaveBeenCalledWith('connected');

    syncPlayService.off('onConnectionStateChange');
  });

  it('should transition to disconnected when disconnect is called', async () => {
    const stateChange = jest.fn();
    syncPlayService.on('onConnectionStateChange', stateChange as any);

    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();
    syncPlayService.disconnect();

    expect(stateChange).toHaveBeenCalledWith('disconnected');

    syncPlayService.off('onConnectionStateChange');
  });

  it('should emit error when no server root is configured', async () => {
    setupMocks({ effectiveServerUrl: '' });

    const stateChange = jest.fn();
    syncPlayService.on('onConnectionStateChange', stateChange as any);

    syncPlayService.connect('member-123');
    await pump();

    expect(stateChange).toHaveBeenCalledWith('error');

    syncPlayService.off('onConnectionStateChange');
  });

  it('connectWithRoom joins the room on open — no caller-supplied URL', async () => {
    syncPlayService.connectWithRoom('sp_room7', 'member-123');
    await pump();
    expect(MockWebSocket.lastUrl).toBe(
      `wss://192.168.1.100:8097/api/v1/syncplay/ws?token=${DIRECT_JWT}`
    );

    MockWebSocket.simulateOpen();

    const join = findSentMessage('syncplay_group_join');
    expect(join).toBeDefined();
    expect(join?.group_id).toBe('sp_room7');
  });
});

// ---------------------------------------------------------------------------
// Reconnect ladder (audit M5) — capped exponential with jitter, terminating
// ---------------------------------------------------------------------------

describe('SyncPlayService - Reconnect ladder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
    MockWebSocket.reset();
    syncPlayService.disconnect();
    jest.useFakeTimers();
  });

  afterEach(() => {
    syncPlayService.disconnect();
    jest.useRealTimers();
  });

  it('reconnects with a bounded, jittered delay and stops after the budget', async () => {
    const stateChange = jest.fn();
    syncPlayService.on('onConnectionStateChange', stateChange as any);
    // Deterministic jitter: 0.5 → delay = ceiling·¾ exactly.
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

    syncPlayService.connect('member-123');
    await pump();
    expect(MockWebSocket.builds).toBe(1);

    // Drop #1 → attempt 1 ceiling 1000 ms · ¾ = 750 ms (NOT the old fixed 5 s).
    MockWebSocket.simulateClose();
    jest.advanceTimersByTime(749);
    expect(MockWebSocket.builds).toBe(1); // no premature redial
    jest.advanceTimersByTime(1);
    await pump();
    expect(MockWebSocket.builds).toBe(2);

    // Drop #2 → attempt 2 ceiling 2000 ms · ¾ = 1500 ms.
    MockWebSocket.simulateClose();
    jest.advanceTimersByTime(1499);
    await pump();
    expect(MockWebSocket.builds).toBe(2);
    jest.advanceTimersByTime(1);
    await pump();
    expect(MockWebSocket.builds).toBe(3);

    // Drops #3/#4/#5 burn the remaining budget (4 s / 8 s / 16 s ceilings,
    // all under the 30 s cap): builds 4, 5, 6.
    for (const wait of [3000, 6000, 12000]) {
      MockWebSocket.simulateClose();
      jest.advanceTimersByTime(wait);
      await pump();
    }
    expect(MockWebSocket.builds).toBe(6);

    // Budget spent (5 attempts) → the next close terminates in 'error' and NO
    // further socket is ever constructed (the old ladder ran forever).
    MockWebSocket.simulateClose();
    jest.advanceTimersByTime(120_000);
    await pump();
    expect(stateChange).toHaveBeenLastCalledWith('error');
    expect(MockWebSocket.builds).toBe(6);

    randomSpy.mockRestore();
    syncPlayService.off('onConnectionStateChange');
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

  it('should send group create message', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    syncPlayService.createGroup('Movie Night');

    expect(MockWebSocket.instance?.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"syncplay_group_create"')
    );
    expect(MockWebSocket.instance?.send).toHaveBeenCalledWith(
      expect.stringContaining('"group_name":"Movie Night"')
    );
  });

  it('carries the group gate as SHA-256 password_hash, never plaintext (SPEC §4)', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    syncPlayService.joinGroup('sp_abc123', 'secret123');

    const join = findSentMessage('syncplay_group_join');
    expect(join).toBeDefined();
    // Pinned against Node's crypto (independent implementation of FIPS 180-4).
    expect(join?.password_hash).toBe(
      createHash('sha256').update('secret123', 'utf8').digest('hex')
    );
    expect(join).not.toHaveProperty('password');
  });

  it('sends no gate field at all when no password was given', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    syncPlayService.joinGroup('sp_abc123');

    const join = findSentMessage('syncplay_group_join');
    expect(join).toBeDefined();
    expect(join).not.toHaveProperty('password_hash');
    expect(join).not.toHaveProperty('password');
  });

  it('should not send leave when not in a group', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    syncPlayService.leaveGroup();

    // No leave message since no group
    const leaveMessages = MockWebSocket.instance?.send.mock.calls.filter(
      (call) => JSON.parse(call[0] as string).type === 'syncplay_group_leave'
    );
    expect(leaveMessages).toHaveLength(0);
  });

  it('should send leave message when in a group', async () => {
    setupMocks({}, {
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
    });

    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    syncPlayService.leaveGroup();

    expect(MockWebSocket.instance?.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"syncplay_group_leave"')
    );
  });
});

// ---------------------------------------------------------------------------
// Inbound parsing — honest wire shapes (audit H2/H3/H4)
// ---------------------------------------------------------------------------

describe('SyncPlayService - Group state parsing (wire law)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
    MockWebSocket.reset();
    syncPlayService.disconnect();
  });

  /** Wire truth (phlix-server GroupState::getState): members is a DICTIONARY
   * keyed by member id, group fields are group_id/group_name. */
  const wireGroup = (members: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    group_id: 'sp_real1',
    group_name: 'Real Group',
    member_count: Object.keys(members).length,
    members,
    host_id: 'user-1',
    current_media_id: 'media-9',
    current_media_duration: 5400,
    playback_position: 60_000,
    playback_state: 'playing',
    queue: [],
    created_at: 1_700_000_000,
    last_activity_at: 1_700_000_500,
    ...extra,
  });

  it('parses dictionary-keyed members without throwing (H2)', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    const stateUpdate = jest.fn();
    syncPlayService.on('onGroupStateUpdate', stateUpdate as any);

    // The pre-fix `for...of rawMembers` threw here (dict is not iterable) and
    // the handler error was swallowed — live state NEVER landed.
    MockWebSocket.simulateMessage({
      type: 'syncplay_group_state',
      your_id: 'user-2',
      group: wireGroup({
        'user-1': { id: 'user-1', name: 'Alice', is_host: true, joined_at: 1_700_000_000 },
        'user-2': { id: 'user-2', name: 'Bob', is_host: false, joined_at: 1_700_000_100 },
      }),
    });

    expect(stateUpdate).toHaveBeenCalledTimes(1);
    const group = stateUpdate.mock.calls[0][0];
    expect(group.id).toBe('sp_real1'); // group_id (H3)
    expect(group.name).toBe('Real Group'); // group_name (H3)
    expect(group.members).toEqual([
      { id: 'user-1', name: 'Alice', isHost: true, joinedAt: 1_700_000_000_000 },
      { id: 'user-2', name: 'Bob', isHost: false, joinedAt: 1_700_000_100_000 },
    ]);
    expect(group.playbackPosition).toBe(60);

    syncPlayService.off('onGroupStateUpdate');
  });

  it('isHost follows the server-issued your_id, not the client claim (H4)', async () => {
    const setIsHost = jest.fn();
    setupMocks({}, { setCurrentGroup: jest.fn(), setIsHost });

    syncPlayService.connect('fabricated-mobile-id');
    await pump();
    MockWebSocket.simulateOpen();
    setIsHost.mockClear();

    MockWebSocket.simulateMessage({
      type: 'syncplay_group_state',
      your_id: 'user-2',
      group: wireGroup({ 'user-2': { id: 'user-2', name: 'Bob', is_host: true } }, { host_id: 'user-2' }),
    });

    expect(setIsHost).toHaveBeenLastCalledWith(true); // JWT-subject identity wins

    MockWebSocket.simulateMessage({
      type: 'syncplay_group_state',
      your_id: 'user-2',
      group: wireGroup({ 'user-1': { id: 'user-1', name: 'Alice', is_host: true } }, { host_id: 'user-1' }),
    });

    expect(setIsHost).toHaveBeenLastCalledWith(false);
  });

  it('emits member-left from the snapshot DIFF — no INFO prose sniffing (H3)', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    const left = jest.fn();
    const joined = jest.fn();
    syncPlayService.on('onMemberLeft', left as any);
    syncPlayService.on('onMemberJoined', joined as any);

    MockWebSocket.simulateMessage({
      type: 'syncplay_group_state',
      your_id: 'user-1',
      group: wireGroup({
        'user-1': { id: 'user-1', name: 'Alice', is_host: true },
        'user-2': { id: 'user-2', name: 'Bob', is_host: false },
      }),
    });
    expect(left).not.toHaveBeenCalled();

    // Bob vanishes from the next snapshot → that's the departure signal
    // (SPEC §6: there is NO member_left frame type).
    MockWebSocket.simulateMessage({
      type: 'syncplay_group_state',
      your_id: 'user-1',
      group: wireGroup({ 'user-1': { id: 'user-1', name: 'Alice', is_host: true } }),
    });
    expect(left).toHaveBeenCalledTimes(1);
    expect(left).toHaveBeenCalledWith('user-2');

    // The old prose sniff used to fire on message text — an unrelated INFO
    // whose sentence merely contains "left" must stay silent now.
    MockWebSocket.simulateMessage({
      type: 'syncplay_info',
      message: 'Alice left the room — wait, this is a decoy about someone else',
    });
    expect(left).toHaveBeenCalledTimes(1);

    syncPlayService.off('onMemberLeft');
    syncPlayService.off('onMemberJoined');
  });

  it('reads TOP-LEVEL member_id/member_name on INFO join frames (H3)', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    const joined = jest.fn();
    syncPlayService.on('onMemberJoined', joined as any);

    // Exactly what SyncPlayManager broadcasts on JOIN (top level, NOT data.*).
    MockWebSocket.simulateMessage({
      type: 'syncplay_info',
      message: 'Carol joined the group',
      member_id: 'user-3',
      member_name: 'Carol',
    });

    expect(joined).toHaveBeenCalledTimes(1);
    expect(joined.mock.calls[0][0]).toEqual(
      expect.objectContaining({ id: 'user-3', name: 'Carol' })
    );

    syncPlayService.off('onMemberJoined');
  });

  it('logs (fails loud at the boundary) when a handler throws or a frame is nonsense', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      syncPlayService.connect('member-123');
      await pump();
      MockWebSocket.simulateOpen();

      // group_state without the `group` payload — dropped with a log, never
      // silently swallowed (H2's swallow was the root of the outage).
      MockWebSocket.simulateMessage({ type: 'syncplay_group_state' });
      expect(errorSpy).toHaveBeenCalledWith(
        'SyncPlay: group_state frame without a group payload'
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// playback_sync — SPEC §4 outbound shape + §9.1 inbound re-anchor
// ---------------------------------------------------------------------------

describe('SyncPlayService - playback_sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks({}, {
      currentGroup: {
        id: 'sp_abc123',
        name: 'Test',
        members: [],
        currentMediaId: null,
        playbackState: 'playing' as const,
        playbackPosition: 10,
        hostId: 'member-123',
        hasPassword: false,
      },
      isHost: false,
    });
    MockWebSocket.reset();
    syncPlayService.disconnect();
  });

  it('reportPosition sends a SPEC §4 playback_sync frame (ms + is_playing)', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    syncPlayService.reportPosition(42_500);

    const frame = findSentMessage('syncplay_playback_sync');
    expect(frame).toBeDefined();
    expect(frame?.group_id).toBe('sp_abc123');
    expect(frame?.position).toBe(42_500);
    expect(frame?.is_playing).toBe(true);
    expect(frame?.server_time).toBeGreaterThan(0);
  });

  it('consumes the host-stamped rebroadcast as a re-anchor command (S291/§9.1)', async () => {
    const updatePlaybackState = jest.fn();
    setupMocks({}, {
      currentGroup: {
        id: 'sp_abc123',
        name: 'Test',
        members: [],
        currentMediaId: null,
        playbackState: 'paused' as const,
        playbackPosition: 0,
        hostId: 'host-1',
        hasPassword: false,
      },
      isHost: false,
      updatePlaybackState,
    });

    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();
    updatePlaybackState.mockClear();

    const command = jest.fn();
    syncPlayService.on('onPlaybackCommand', command as any);

    // Server rebroadcast shape: member_id = HOST, position in wire MS.
    MockWebSocket.simulateMessage({
      type: 'syncplay_playback_sync',
      member_id: 'host-1',
      group_id: 'sp_abc123',
      current_media_id: 'media-9',
      position: 33_000,
      is_playing: true,
      server_time: 1_700_000_000,
    });

    expect(updatePlaybackState).toHaveBeenCalledWith('playing', 33);
    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'play', position: 33 })
    );

    syncPlayService.off('onPlaybackCommand');
  });
});

// ---------------------------------------------------------------------------
// Playback command tests
// ---------------------------------------------------------------------------

describe('SyncPlayService - Playback commands', () => {
  const hostGroup = {
    id: 'sp_abc123',
    name: 'Test',
    members: [],
    currentMediaId: null,
    playbackState: 'paused' as const,
    playbackPosition: 10000,
    hostId: 'member-123',
    hasPassword: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MockWebSocket.reset();
    syncPlayService.disconnect();
  });

  it('should send play command when host', async () => {
    setupMocks({}, { currentGroup: hostGroup, isHost: true });
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    syncPlayService.sendPlay(15000);

    const msg = findSentMessage('syncplay_playback_play');

    expect(msg).toBeDefined();
    expect(msg?.position).toBe(15000);
    expect(msg?.group_id).toBe('sp_abc123');
  });

  it('should not send play command when not host', async () => {
    setupMocks({}, {
      currentGroup: { ...hostGroup, hostId: 'other-member' },
      isHost: false,
    });
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    syncPlayService.sendPlay(15000);

    // A time_ping fires on open, so send() IS called — assert specifically that
    // no PLAY command was emitted (non-host must not drive playback).
    expect(findSentMessage('syncplay_playback_play')).toBeUndefined();
  });

  it('should send pause command when host', async () => {
    setupMocks({}, {
      currentGroup: { ...hostGroup, playbackState: 'playing' as const, playbackPosition: 20000 },
      isHost: true,
    });
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    syncPlayService.sendPause(20000);

    const msg = findSentMessage('syncplay_playback_pause');

    expect(msg).toBeDefined();
    expect(msg?.position).toBe(20000);
  });

  it('should send seek command when host', async () => {
    setupMocks({}, {
      currentGroup: { ...hostGroup, playbackState: 'playing' as const },
      isHost: true,
    });
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    syncPlayService.sendSeek(10000, 30000);

    const msg = findSentMessage('syncplay_playback_seek');

    expect(msg).toBeDefined();
    expect(msg?.from_position).toBe(10000);
    expect(msg?.to_position).toBe(30000);
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

  it('should handle play command from server and call store update', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    const playbackCallback = jest.fn();
    syncPlayService.on('onPlaybackCommand', playbackCallback as any);

    // S441 — WIRE frame in MILLISECONDS; the event (and everything below it)
    // speaks SECONDS. 25 000 ms must land as 25 s: raw passthrough (25 000) or
    // a double decode (0.025) both go red.
    MockWebSocket.simulateMessage({
      type: 'syncplay_playback_play',
      position: 25_000,
      server_time: Date.now(),
    });

    expect(playbackCallback).toHaveBeenCalled();
    const call = playbackCallback.mock.calls[0][0];
    expect(call.type).toBe('play');
    expect(call.position).toBe(25);

    syncPlayService.off('onPlaybackCommand');
  });

  it('should handle pause command from server', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    const playbackCallback = jest.fn();
    syncPlayService.on('onPlaybackCommand', playbackCallback as any);

    // S441 — 30 000 ms on the wire, 30 s out of the boundary.
    MockWebSocket.simulateMessage({
      type: 'syncplay_playback_pause',
      position: 30_000,
      server_time: Date.now(),
    });

    expect(playbackCallback).toHaveBeenCalled();
    const call = playbackCallback.mock.calls[0][0];
    expect(call.type).toBe('pause');
    expect(call.position).toBe(30);

    syncPlayService.off('onPlaybackCommand');
  });

  it('should handle seek command from server', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    const playbackCallback = jest.fn();
    syncPlayService.on('onPlaybackCommand', playbackCallback as any);

    // S441 — `to_position` 35 000 ms on the wire becomes a 35 s command.
    MockWebSocket.simulateMessage({
      type: 'syncplay_playback_seek',
      from_position: 20_000,
      to_position: 35_000,
      server_time: Date.now(),
    });

    expect(playbackCallback).toHaveBeenCalled();
    const call = playbackCallback.mock.calls[0][0];
    expect(call.type).toBe('seek');
    expect(call.position).toBe(35);

    syncPlayService.off('onPlaybackCommand');
  });

  /**
   * S441 — the whole inbound scale contract in one frame-per-leg test.
   * Each leg is fed a 1000×-sensitive WIRE value and must surface SECONDS
   * both on the event the screens listen to AND on the store write the
   * overlay reads: a missing decode lands the raw ms (1000× too far), a
   * double decode lands 0.0425 — both go red on every assertion below.
   */
  it('S441 — ms→s is decoded exactly once at the service boundary (S441MSBOUNDARYX7J3)', async () => {
    const updatePlaybackState = jest.fn();
    const setCurrentGroup = jest.fn();
    setupMocks({}, {
      currentGroup: {
        id: 'sp_abc123',
        name: 'Test',
        members: [],
        currentMediaId: null,
        playbackState: 'playing' as const,
        playbackPosition: 0,
        hostId: 'member-123',
        hasPassword: false,
      },
      isHost: true,
      setCurrentGroup,
      updatePlaybackState,
    });

    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    const playbackCallback = jest.fn();
    syncPlayService.on('onPlaybackCommand', playbackCallback as any);

    updatePlaybackState.mockClear();

    MockWebSocket.simulateMessage({ type: 'syncplay_playback_play', position: 42_500, server_time: Date.now() });
    expect(playbackCallback.mock.calls[0][0].position).toBe(42.5);
    expect(updatePlaybackState).toHaveBeenLastCalledWith('playing', 42.5);

    MockWebSocket.simulateMessage({ type: 'syncplay_playback_pause', position: 120_000, server_time: Date.now() });
    expect(playbackCallback.mock.calls[1][0].position).toBe(120);
    expect(updatePlaybackState).toHaveBeenLastCalledWith('paused', 120);

    MockWebSocket.simulateMessage({ type: 'syncplay_playback_seek', from_position: 1, to_position: 90_000, server_time: Date.now() });
    expect(playbackCallback.mock.calls[2][0].position).toBe(90);
    expect(updatePlaybackState).toHaveBeenLastCalledWith('playing', 90);

    // The group-state snapshot leg: 60 000 ms of anchor → a 60 s group.
    const groupCallback = jest.fn();
    syncPlayService.on('onGroupStateUpdate', groupCallback as any);
    MockWebSocket.simulateMessage({
      type: 'syncplay_group_state',
      your_id: 'member-123',
      group: {
        group_id: 'sp_abc123',
        group_name: 'Test',
        // HONEST wire shape (H2): members is a dict keyed by member id —
        // the array fixture here is what MASKED the for...of crash in prod.
        members: {
          'member-123': { id: 'member-123', name: 'You', is_host: true, joined_at: 1_700_000_000 },
        },
        host_id: 'member-123',
        current_media_id: null,
        playback_state: 'playing',
        playback_position: 60_000,
      },
    });
    expect(setCurrentGroup).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'sp_abc123', name: 'Test', playbackPosition: 60 })
    );
    expect(groupCallback).toHaveBeenLastCalledWith(
      expect.objectContaining({ playbackPosition: 60 })
    );
    syncPlayService.off('onGroupStateUpdate');

    syncPlayService.off('onPlaybackCommand');
  });

  it('should handle host election', async () => {
    syncPlayService.connect('member-123');
    await pump();
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

  it('should handle error messages from server', async () => {
    syncPlayService.connect('member-123');
    await pump();
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

  // W5 — SPEC read order: `error_code` (Messages::error) first, then the
  // legacy `code` (SyncPlayManager::sendError), then the 'UNKNOWN' sentinel.
  it('reads error_code ahead of a present legacy code field', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    const errorCallback = jest.fn();
    syncPlayService.on('onError', errorCallback as any);

    MockWebSocket.simulateMessage({
      type: 'syncplay_error',
      error_code: 'syncplay.group_full',
      code: 'JOIN_FAILED',
      message: 'Group is full',
    });

    expect(errorCallback).toHaveBeenCalledWith('syncplay.group_full', 'Group is full');

    syncPlayService.off('onError');
  });

  it('falls back to the legacy code field when error_code is absent', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    const errorCallback = jest.fn();
    syncPlayService.on('onError', errorCallback as any);

    MockWebSocket.simulateMessage({
      type: 'syncplay_error',
      code: 'NOT_HOST',
      message: 'Only the host can control playback',
    });

    expect(errorCallback).toHaveBeenCalledWith('NOT_HOST', 'Only the host can control playback');

    syncPlayService.off('onError');
  });

  it("uses the 'UNKNOWN' sentinel when neither code field carries a string", async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    const errorCallback = jest.fn();
    syncPlayService.on('onError', errorCallback as any);

    // Non-string junk must not poison the (code: string) event signature —
    // the boundary parses, it does not cast.
    MockWebSocket.simulateMessage({
      type: 'syncplay_error',
      error_code: 422,
      code: { nested: true },
      message: 'transport hiccup',
    });

    expect(errorCallback).toHaveBeenCalledWith('UNKNOWN', 'transport hiccup');

    syncPlayService.off('onError');
  });

  it('should ignore malformed JSON messages without throwing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      syncPlayService.connect('member-123');
      await pump();
      MockWebSocket.simulateOpen();

      expect(() => {
        MockWebSocket.instance?.onmessage?.({ data: 'not valid json' } as any);
      }).not.toThrow();
      // H2 doctrine: the drop must be LOGGED, not silently swallowed.
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('reports SEND_FAILED instead of silently dropping frames while closed', async () => {
    const errorCallback = jest.fn();
    syncPlayService.on('onError', errorCallback as any);

    syncPlayService.connect('member-123');
    await pump();
    syncPlayService.disconnect(); // socket gone

    syncPlayService.requestTimeSync();

    expect(errorCallback).toHaveBeenCalledWith(
      'SEND_FAILED',
      expect.stringContaining('syncplay_time_ping')
    );

    syncPlayService.off('onError');
  });
});

// ---------------------------------------------------------------------------
// TimeSync tests — server compute law (t3 = t2) + SPEC §5 rejection
// ---------------------------------------------------------------------------

describe('SyncPlayService - TimeSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
    MockWebSocket.reset();
    syncPlayService.disconnect();
  });

  it('should send time ping message', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    syncPlayService.requestTimeSync();

    expect(MockWebSocket.instance?.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"syncplay_time_ping"')
    );
  });

  it('computes offset per the pong law t3=t2: offset = t2 − t1 + rtt/2', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();
    // The open itself fired a ping; clear nothing — we feed ONE deterministic
    // pong whose numbers fully define the single accepted sample.
    const t1 = Date.now() - 100; // ping left 100 ms ago
    const t2 = Date.now() - 60; // server received/replied at t2 (t3 = t2)

    MockWebSocket.simulateMessage({
      type: 'syncplay_time_pong',
      client_time: t1,
      server_time: t2,
    });

    const status = syncPlayService.getTimeSyncStatus();
    // Wire law: rtt = t4 − t1 − (t3 − t2) with t3 = t2 ⇒ rtt ≈ 100 ms.
    // offset = server_time − client_time + rtt/2 = 40 + 50 = 90 ms.
    // (Pre-fix `t3 = server_time + latency` halved the term twice; the
    // pre-fix getOffset() divisor additionally crushed it to ~1 ms.)
    expect(status.offset).toBeGreaterThanOrEqual(85);
    expect(status.offset).toBeLessThanOrEqual(95);
    expect(status.latency).toBeGreaterThanOrEqual(45);
    expect(status.latency).toBeLessThanOrEqual(55);
  });

  it('rejects a negative-rtt sample (clock step) instead of averaging it in', async () => {
    setupMocks();
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    // One honest sample first.
    const t1 = Date.now() - 100;
    MockWebSocket.simulateMessage({
      type: 'syncplay_time_pong',
      client_time: t1,
      server_time: Date.now() - 60,
    });
    const before = syncPlayService.getTimeSyncStatus().offset;

    // A pong claiming a FUTURE client_time means t4 − t1 < 0 (wall clock moved
    // under us) — SPEC §5: reject, offset must not budge.
    MockWebSocket.simulateMessage({
      type: 'syncplay_time_pong',
      client_time: Date.now() + 600_000,
      server_time: Date.now(),
    });

    expect(syncPlayService.getTimeSyncStatus().offset).toBe(before);
  });

  it('resets the clock domain on every (re)open — SPEC §10.1', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    MockWebSocket.simulateMessage({
      type: 'syncplay_time_pong',
      client_time: Date.now() - 100,
      server_time: Date.now() - 60,
    });
    const dirtyOffset = syncPlayService.getTimeSyncStatus().offset;
    expect(dirtyOffset).not.toBe(0);

    // Second connection (auto-reconnect path): the ping on open must start
    // from a FRESH domain — a stale offset surviving from the dead socket
    // would skew the new one immediately.
    MockWebSocket.simulateClose();
    syncPlayService.disconnect();
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    expect(syncPlayService.getTimeSyncStatus().offset).toBe(0);
    expect(syncPlayService.getTimeSyncStatus().offset).not.toBe(dirtyOffset);
  });

  it('should return synchronized time close to Date.now() when no samples', async () => {
    syncPlayService.connect('member-123');
    await pump();
    MockWebSocket.simulateOpen();

    const before = Date.now();
    const syncTime = syncPlayService.getSynchronizedTime();
    const after = Date.now();

    // Without samples, offset is 0 so syncTime ≈ Date.now()
    expect(syncTime).toBeGreaterThanOrEqual(before);
    expect(syncTime).toBeLessThanOrEqual(after);
  });
});
