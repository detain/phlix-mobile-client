/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/syncplay/hubRelay.test.ts
/**
 * S298 — hub-relay pending_command consumer (mobile half): unit surface.
 *
 * Covers the parse boundary (parse-don't-validate), the URL builder, and the
 * open-whenever socket lifecycle with the REAL carrier shape (subprotocol
 * `['bearer', <token>]` — the S355-proven carrier) against a fake WebSocket
 * swapped into the global, mirroring how the S298 ui suite proves the same
 * module. The REAL hub handshake is proven separately (sandbox boot, see the
 * lane report): this suite locks the client-side contract.
 */
import {
  parsePendingCommandFrame,
  buildHubRelayUrl,
  openHubRelayConnection,
  closeHubRelayConnection,
  getHubRelaySocket,
  HUB_SYNC_PLAY_PORT,
} from '../../syncplay/hubRelay';
import type { PendingPlayMediaCommand } from '../../syncplay/hubRelay';

// ── fake WebSocket swapped into the global (mirrors the ui S298 suite) ────────

type FakeWsHandler = ((event?: unknown) => void) | null;

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readonly protocols: string[] | null;
  readyState = FakeWebSocket.OPEN;
  onopen: FakeWsHandler = null;
  onmessage: FakeWsHandler = null;
  onclose: FakeWsHandler = null;
  onerror: FakeWsHandler = null;
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

  /** Test helper: simulate a delivered server frame. */
  deliver(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  /** Test helper: simulate the server accepting the handshake. */
  open(): void {
    this.onopen?.();
  }

  /** Test helper: simulate the socket dropping. */
  drop(): void {
    this.onclose?.({ code: 1006, reason: 'dropped' });
  }
}

const realWebSocket = globalThis.WebSocket;

beforeEach(() => {
  FakeWebSocket.instances = [];
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  closeHubRelayConnection();
});

afterEach(() => {
  closeHubRelayConnection();
  globalThis.WebSocket = realWebSocket;
});

const socket = (): FakeWebSocket => FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!;

// ── parse boundary ────────────────────────────────────────────────────────────

describe('parsePendingCommandFrame', () => {
  it('parses the hub dispatcher frame shape into a typed command', () => {
    const raw = {
      type: 'pending_command',
      command: 'play_media',
      server_id: 'srv-1',
      media_id: 'media-9',
      title: 'Inception',
      issued_at: 1_700_000_000,
      source: 'alexa',
    };
    const parsed = parsePendingCommandFrame(raw);
    expect(parsed).toEqual({
      type: 'pending_command',
      command: 'play_media',
      serverId: 'srv-1',
      mediaId: 'media-9',
      title: 'Inception',
      issuedAt: 1_700_000_000,
      source: 'alexa',
    } satisfies PendingPlayMediaCommand);
  });

  it('falls back to now for a missing/non-finite issued_at', () => {
    const before = Math.floor(Date.now() / 1000);
    const parsed = parsePendingCommandFrame({
      type: 'pending_command',
      command: 'play_media',
      server_id: 'srv-1',
      media_id: 'media-9',
      title: 'Inception',
    });
    expect(parsed?.issuedAt).toBeGreaterThanOrEqual(before);
  });

  it('returns null for non-objects and garbage', () => {
    expect(parsePendingCommandFrame(null)).toBeNull();
    expect(parsePendingCommandFrame('pending_command')).toBeNull();
    expect(parsePendingCommandFrame(42)).toBeNull();
    expect(parsePendingCommandFrame([])).toBeNull();
  });

  it('returns null for unknown frame types (room vocabulary is ignored)', () => {
    expect(
      parsePendingCommandFrame({ type: 'room_state', room: 'x' })
    ).toBeNull();
    expect(
      parsePendingCommandFrame({ type: 'playback_play', position: 0 })
    ).toBeNull();
  });

  it('returns null for a pending_command with a non-play_media command', () => {
    expect(
      parsePendingCommandFrame({ type: 'pending_command', command: 'queue' })
    ).toBeNull();
  });

  it('returns null when any required field is missing or empty', () => {
    const base = {
      type: 'pending_command',
      command: 'play_media',
      server_id: 'srv-1',
      media_id: 'media-9',
      title: 'Inception',
    };
    expect(parsePendingCommandFrame({ ...base, server_id: '' })).toBeNull();
    expect(parsePendingCommandFrame({ ...base, media_id: '' })).toBeNull();
    expect(parsePendingCommandFrame({ ...base, title: '' })).toBeNull();
    expect(parsePendingCommandFrame({ ...base, server_id: 7 })).toBeNull();
    expect(parsePendingCommandFrame({ ...base, media_id: null })).toBeNull();
  });

  it('defaults a missing source to unknown', () => {
    const parsed = parsePendingCommandFrame({
      type: 'pending_command',
      command: 'play_media',
      server_id: 'srv-1',
      media_id: 'media-9',
      title: 'Inception',
      issued_at: 1,
    });
    expect(parsed?.source).toBe('unknown');
  });
});

// ── URL builder ───────────────────────────────────────────────────────────────

describe('buildHubRelayUrl', () => {
  it('builds ws://host:8804/syncplay/{server_id} from an http hub', () => {
    expect(buildHubRelayUrl('http://127.0.0.1:8800', 'srv-abc')).toBe(
      'ws://127.0.0.1:8804/syncplay/srv-abc'
    );
  });

  it('builds wss:// for an https hub', () => {
    expect(buildHubRelayUrl('https://hub.example.com', 'srv-abc')).toBe(
      'wss://hub.example.com:8804/syncplay/srv-abc'
    );
  });

  it('ignores a path/port on the hub base — the relay port is always 8804', () => {
    expect(buildHubRelayUrl('https://hub.example.com:8443/base', 'srv-abc')).toBe(
      'wss://hub.example.com:8804/syncplay/srv-abc'
    );
  });

  it('URL-encodes the server id', () => {
    expect(buildHubRelayUrl('http://h', 'srv with spaces')).toBe(
      'ws://h:8804/syncplay/srv%20with%20spaces'
    );
  });

  it('exposes the relay port constant', () => {
    expect(HUB_SYNC_PLAY_PORT).toBe(8804);
  });
});

// ── open-whenever lifecycle + carrier ─────────────────────────────────────────

describe('openHubRelayConnection', () => {
  const config = (over: Partial<Parameters<typeof openHubRelayConnection>[0]> = {}) => ({
    serverId: 'srv-1',
    hubBaseUrl: 'http://127.0.0.1:8800',
    tokenProvider: () => 'relay-token-1',
    onPendingCommand: jest.fn(),
    ...over,
  });

  it('opens a socket with the :8804 /syncplay/{server_id} URL and the bearer subprotocol carrier', () => {
    openHubRelayConnection(config());
    const ws = socket();
    expect(ws.url).toBe('ws://127.0.0.1:8804/syncplay/srv-1');
    // S237/S355 carrier: the token travels in the SUBPROTOCOL, never the query
    // string (query-string tokens are refused by design).
    expect(ws.url).not.toContain('token');
    expect(ws.protocols).toEqual(['bearer', 'relay-token-1']);
  });

  it('is idempotent for the same server id — no second socket', () => {
    openHubRelayConnection(config());
    openHubRelayConnection(config());
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('re-binds (closes the old socket) when the server id changes', () => {
    openHubRelayConnection(config({ serverId: 'srv-1' }));
    const first = socket();
    openHubRelayConnection(config({ serverId: 'srv-2' }));
    expect(first.closed).toBe(true);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(socket().url).toBe('ws://127.0.0.1:8804/syncplay/srv-2');
  });

  it('surfaces open status and resets the ladder on a successful handshake', () => {
    const onStatusChange = jest.fn();
    openHubRelayConnection(config({ onStatusChange }));
    socket().open();
    expect(onStatusChange).toHaveBeenCalledWith('open');
  });

  it('keeps the socket closed when the token provider yields nothing', () => {
    const onStatusChange = jest.fn();
    openHubRelayConnection(config({ tokenProvider: () => null, onStatusChange }));
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(onStatusChange).toHaveBeenCalledWith('closed');
  });

  it('delivers a parsed pending_command frame to onPendingCommand', () => {
    const onPendingCommand = jest.fn();
    openHubRelayConnection(config({ onPendingCommand }));
    socket().deliver({
      type: 'pending_command',
      command: 'play_media',
      server_id: 'srv-1',
      media_id: 'media-9',
      title: 'Inception',
      issued_at: 1_700_000_000,
      source: 'alexa',
    });
    expect(onPendingCommand).toHaveBeenCalledTimes(1);
    const command = onPendingCommand.mock.calls[0]![0] as PendingPlayMediaCommand;
    expect(command.mediaId).toBe('media-9');
    expect(command.title).toBe('Inception');
  });

  it('ignores non-pending_command frames (room vocabulary) and malformed JSON', () => {
    const onPendingCommand = jest.fn();
    openHubRelayConnection(config({ onPendingCommand }));
    socket().deliver({ type: 'room_state', room: 'x' });
    socket().deliver({ type: 'playback_play', position: 0 });
    socket().onmessage?.({ data: 'not json{' });
    expect(onPendingCommand).not.toHaveBeenCalled();
  });

  it('a throwing consumer does not kill the message handler', () => {
    const onPendingCommand = jest.fn(() => {
      throw new Error('consumer boom');
    });
    openHubRelayConnection(config({ onPendingCommand }));
    expect(() =>
      socket().deliver({
        type: 'pending_command',
        command: 'play_media',
        server_id: 'srv-1',
        media_id: 'media-9',
        title: 'Inception',
      })
    ).not.toThrow();
    // A second frame still reaches the consumer.
    socket().deliver({
      type: 'pending_command',
      command: 'play_media',
      server_id: 'srv-1',
      media_id: 'media-10',
      title: 'Dune',
    });
    expect(onPendingCommand).toHaveBeenCalledTimes(2);
  });

  it('schedules a capped, exponential reconnect ladder on close', () => {
    jest.useFakeTimers();
    try {
      openHubRelayConnection(config());
      socket().drop();
      // 1st reconnect after 1s
      jest.advanceTimersByTime(1000);
      expect(FakeWebSocket.instances).toHaveLength(2);
      socket().drop();
      // 2nd after 2s
      jest.advanceTimersByTime(2000);
      expect(FakeWebSocket.instances).toHaveLength(3);
      socket().drop();
      // 3rd after 4s
      jest.advanceTimersByTime(4000);
      expect(FakeWebSocket.instances).toHaveLength(4);
      socket().drop();
      // 4th after 8s
      jest.advanceTimersByTime(8000);
      expect(FakeWebSocket.instances).toHaveLength(5);
      socket().drop();
      // 5th after 16s
      jest.advanceTimersByTime(16000);
      expect(FakeWebSocket.instances).toHaveLength(6);
      // Capped: no 6th reconnect
      socket().drop();
      jest.advanceTimersByTime(60000);
      expect(FakeWebSocket.instances).toHaveLength(6);
      expect(getHubRelaySocket()).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('re-reads the token provider on every reconnect attempt', async () => {
    jest.useFakeTimers();
    try {
      const tokens: Array<string | null> = ['relay-token-1', 'relay-token-2'];
      const tokenProvider = jest.fn(() => tokens.shift() ?? null);
      openHubRelayConnection(config({ tokenProvider }));
      socket().drop();
      await Promise.resolve();
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(tokenProvider).toHaveBeenCalledTimes(2);
      const reconnected = socket();
      expect(reconnected.protocols).toEqual(['bearer', 'relay-token-2']);
    } finally {
      jest.useRealTimers();
    }
  });
});

// ── close ─────────────────────────────────────────────────────────────────────

describe('closeHubRelayConnection', () => {
  it('closes the socket and clears the module state', () => {
    openHubRelayConnection({
      serverId: 'srv-1',
      hubBaseUrl: 'http://127.0.0.1:8800',
      tokenProvider: () => 'relay-token-1',
      onPendingCommand: jest.fn(),
    });
    const ws = socket();
    closeHubRelayConnection();
    expect(ws.closed).toBe(true);
    expect(getHubRelaySocket()).toBeNull();
  });

  it('stops the reconnect ladder', () => {
    jest.useFakeTimers();
    try {
      openHubRelayConnection({
        serverId: 'srv-1',
        hubBaseUrl: 'http://127.0.0.1:8800',
        tokenProvider: () => 'relay-token-1',
        onPendingCommand: jest.fn(),
      });
      socket().drop();
      closeHubRelayConnection();
      jest.advanceTimersByTime(60000);
      expect(FakeWebSocket.instances).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });
});