/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/syncplay/HubRelayConsumer.test.ts
/**
 * S298 — hub-relay pending-command consumer (mobile half): app-level wiring.
 *
 * `startHubRelayConsumer` is the "open-whenever" boot: with hub auth present it
 * opens the `:8804` relay socket (fake WebSocket swapped into the global) and
 * routes delivered `pending_command` frames into the player via the injected
 * `navigateToPlayer` — the load-a-new-title path. The token mint itself is
 * mocked here (covered by RelayTokenProvider.test.ts).
 */
import {
  startHubRelayConsumer,
  stopHubRelayConsumer,
} from '../../syncplay/HubRelayConsumer';
import { useHubStore } from '../../store/hubStore';
import { useSyncplayStore } from '../../store/syncplayStore';
import { getHubRelaySocket } from '../../syncplay/hubRelay';
import type { HubSession } from '../../hub/HubAuthService';

jest.mock('../../hub/RelayTokenProvider', () => ({
  createHubRelayTokenProvider: () => () => 'relay-token-1',
}));

// ── fake WebSocket swapped into the global ────────────────────────────────────

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readonly protocols: string[] | null;
  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event?: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string, protocols?: string | string[] | null) {
    this.url = url;
    this.protocols = protocols ? (Array.isArray(protocols) ? protocols : [protocols]) : null;
    FakeWebSocket.instances.push(this);
  }

  send(_data: string): void {}

  close(): void {
    this.closed = true;
    this.readyState = FakeWebSocket.CLOSED;
  }

  deliver(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

const realWebSocket = globalThis.WebSocket;

const SESSION: HubSession = {
  accessToken: 'hub-session-jwt',
  refreshToken: 'refresh-jwt',
  expiresAt: 4_000_000_000,
  userId: 'user-1',
};

const HUB_STATE = {
  hubUrl: 'http://127.0.0.1:8800',
  session: SESSION,
  activeServerId: 'srv-1',
};

// NOTE: these are the WIRE keys (`server_id`, `media_id`, `issued_at`) — the
// hub's `PendingCommandDispatcher` frame shape, NOT the client-side camelCase
// `PendingPlayMediaCommand` (the parse boundary converts).
const hubCommand = (over: Partial<{ media_id: string; title: string; issued_at: number }> = {}) => ({
  type: 'pending_command' as const,
  command: 'play_media' as const,
  server_id: 'srv-1',
  media_id: 'media-9',
  title: 'Inception',
  issued_at: 1_700_000_000,
  source: 'alexa',
  ...over,
});

const socket = (): FakeWebSocket => FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!;

beforeEach(() => {
  FakeWebSocket.instances = [];
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  useHubStore.setState({
    hubUrl: null,
    session: null,
    servers: [],
    activeServerId: null,
    connectionMode: 'direct',
    effectiveServerUrl: '',
  });
  useSyncplayStore.setState({ pendingPlayMedia: null, currentGroup: null });
});

afterEach(() => {
  stopHubRelayConsumer();
  globalThis.WebSocket = realWebSocket;
});

describe('startHubRelayConsumer — socket lifecycle', () => {
  it('opens the relay socket with the :8804 /syncplay/{server_id} URL and bearer subprotocol when hub auth exists', () => {
    useHubStore.setState(HUB_STATE);
    const navigateToPlayer = jest.fn();
    startHubRelayConsumer({ navigateToPlayer });

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(socket().url).toBe('ws://127.0.0.1:8804/syncplay/srv-1');
    // S237/S355 carrier: token in the SUBPROTOCOL, never the query string.
    expect(socket().url).not.toContain('token');
    expect(socket().protocols).toEqual(['bearer', 'relay-token-1']);
  });

  it('keeps the socket closed when there is no hub auth', () => {
    startHubRelayConsumer({ navigateToPlayer: jest.fn() });
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(getHubRelaySocket()).toBeNull();
  });

  it('opens the socket when hub auth arrives after boot', () => {
    startHubRelayConsumer({ navigateToPlayer: jest.fn() });
    expect(FakeWebSocket.instances).toHaveLength(0);

    useHubStore.setState(HUB_STATE);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(socket().url).toBe('ws://127.0.0.1:8804/syncplay/srv-1');
  });

  it('closes the socket when the hub session is signed out', () => {
    useHubStore.setState(HUB_STATE);
    startHubRelayConsumer({ navigateToPlayer: jest.fn() });
    expect(FakeWebSocket.instances).toHaveLength(1);

    useHubStore.setState({ session: null });
    expect(socket().closed).toBe(true);
    expect(getHubRelaySocket()).toBeNull();
  });

  it('re-binds to the new server when the active server switches', () => {
    useHubStore.setState(HUB_STATE);
    startHubRelayConsumer({ navigateToPlayer: jest.fn() });
    const first = socket();

    useHubStore.setState({ activeServerId: 'srv-2' });
    expect(first.closed).toBe(true);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(socket().url).toBe('ws://127.0.0.1:8804/syncplay/srv-2');
  });

  it('stopHubRelayConsumer closes the socket and stops further opens', () => {
    useHubStore.setState(HUB_STATE);
    startHubRelayConsumer({ navigateToPlayer: jest.fn() });
    const ws = socket();

    stopHubRelayConsumer();
    expect(ws.closed).toBe(true);
    expect(getHubRelaySocket()).toBeNull();

    // A later hub-store change must not re-open (subscriptions are torn down).
    useHubStore.setState({ activeServerId: 'srv-3' });
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});

describe('startHubRelayConsumer — command router (load-a-new-title path)', () => {
  it('routes a delivered frame into the player and consumes the store slot', () => {
    useHubStore.setState(HUB_STATE);
    const navigateToPlayer = jest.fn();
    startHubRelayConsumer({ navigateToPlayer });

    socket().deliver(hubCommand({ media_id: 'media-9', title: 'Inception' }));
    expect(navigateToPlayer).toHaveBeenCalledTimes(1);
    expect(navigateToPlayer).toHaveBeenCalledWith('media-9');
    // The slot is consumed so a later session update cannot re-trigger the load.
    expect(useSyncplayStore.getState().pendingPlayMedia).toBeNull();
  });

  it('the same frame delivered twice is consumed but routed only once', () => {
    useHubStore.setState(HUB_STATE);
    const navigateToPlayer = jest.fn();
    startHubRelayConsumer({ navigateToPlayer });

    socket().deliver(hubCommand({ media_id: 'media-9', issued_at: 1_700_000_000 }));
    socket().deliver(hubCommand({ media_id: 'media-9', issued_at: 1_700_000_000 }));
    expect(navigateToPlayer).toHaveBeenCalledTimes(1);
    expect(useSyncplayStore.getState().pendingPlayMedia).toBeNull();
  });

  it('a NEW frame (different media id) is routed again', () => {
    useHubStore.setState(HUB_STATE);
    const navigateToPlayer = jest.fn();
    startHubRelayConsumer({ navigateToPlayer });

    socket().deliver(hubCommand({ media_id: 'media-9' }));
    socket().deliver(hubCommand({ media_id: 'media-10', title: 'Dune', issued_at: 1_700_000_001 }));
    expect(navigateToPlayer).toHaveBeenCalledTimes(2);
    expect(navigateToPlayer.mock.calls.map((c) => c[0])).toEqual(['media-9', 'media-10']);
  });

  it('writes currentMediaId into the live group — the paired caller for the carry-through', () => {
    useHubStore.setState(HUB_STATE);
    useSyncplayStore.getState().setCurrentGroup({
      id: 'sp_abc123',
      name: 'Movie Night',
      members: [],
      currentMediaId: null,
      playbackState: 'paused',
      playbackPosition: 0,
      hostId: 'member-1',
      hasPassword: false,
    });
    startHubRelayConsumer({ navigateToPlayer: jest.fn() });

    socket().deliver(hubCommand({ media_id: 'media-9' }));
    expect(useSyncplayStore.getState().currentGroup?.currentMediaId).toBe('media-9');
  });

  it('routes even with NO group — the primary "Alexa, play X" case has no room', () => {
    useHubStore.setState(HUB_STATE);
    const navigateToPlayer = jest.fn();
    startHubRelayConsumer({ navigateToPlayer });

    socket().deliver(hubCommand({ media_id: 'media-9' }));
    expect(navigateToPlayer).toHaveBeenCalledWith('media-9');
    expect(useSyncplayStore.getState().currentGroup).toBeNull();
  });

  it('does not route non-play_media frames', () => {
    useHubStore.setState(HUB_STATE);
    const navigateToPlayer = jest.fn();
    startHubRelayConsumer({ navigateToPlayer });

    socket().deliver({ type: 'room_state', room: 'x' });
    socket().deliver({ type: 'pending_command', command: 'queue' });
    expect(navigateToPlayer).not.toHaveBeenCalled();
  });
});