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
  handleHubRelayBackground,
  handleHubRelayForeground,
  HUB_SYNC_PLAY_PORT,
  hubRelayPort,
  PENDING_COMMAND_MAX_AGE_SECONDS,
  PENDING_COMMAND_MAX_FUTURE_SKEW_SECONDS,
  RELAY_PING_INTERVAL_MS,
  RELAY_PONG_TIMEOUT_MS,
} from '../../syncplay/hubRelay';
import type { PendingPlayMediaCommand } from '../../syncplay/hubRelay';
import { MAX_INBOUND_FRAME_BYTES } from '../../syncplay/frameLimits';
import Config from 'react-native-config';

// ── fake WebSocket swapped into the global (mirrors the ui S298 suite) ────────

type FakeWsHandler = ((event?: unknown) => void) | null;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readonly protocols: string[] | null;
  /** Every string handed to send() — the MW-122 watchdog pins read it. */
  readonly sent: string[] = [];
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

  send(data: string): void {
    this.sent.push(data);
  }

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
    // Clock injected seconds-fresh over the stamp (M-MOBILE-55 window).
    const parsed = parsePendingCommandFrame(raw, 1_700_000_005);
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

  // M-MOBILE-55 clause b (review mobile__secnet m7) — LAW FLIP: this test
  // used to PIN the Date.now()-minting fallback ("falls back to now for a
  // missing/non-finite issued_at"), which was the defect itself: every
  // replay of a stamp-less frame got a fresh dedupe key. Missing/non-finite
  // is now malformed and dropped, exactly like the other shape failures.
  it('drops a frame with a missing or non-finite issued_at (no phone-clock minting)', () => {
    const frame = {
      type: 'pending_command',
      command: 'play_media',
      server_id: 'srv-1',
      media_id: 'media-9',
      title: 'Inception',
    };
    expect(parsePendingCommandFrame({ ...frame })).toBeNull();
    expect(
      parsePendingCommandFrame({ ...frame, issued_at: Number.NaN })
    ).toBeNull();
    expect(
      parsePendingCommandFrame({ ...frame, issued_at: Number.POSITIVE_INFINITY })
    ).toBeNull();
    expect(
      parsePendingCommandFrame({ ...frame, issued_at: '1700000000' })
    ).toBeNull();
    expect(parsePendingCommandFrame({ ...frame, issued_at: null })).toBeNull();
  });

  it('enforces the replay window: seconds-fresh passes, stale and far-future drop', () => {
    const NOW = 1_700_000_000;
    const frame = (issuedAt: number) => ({
      type: 'pending_command',
      command: 'play_media',
      server_id: 'srv-1',
      media_id: 'media-9',
      title: 'Inception',
      issued_at: issuedAt,
    });
    // Live delivery is seconds-fresh (the hub pushes to an OPEN app).
    expect(parsePendingCommandFrame(frame(NOW - 3), NOW)).not.toBeNull();
    // Exactly at the ceiling passes, one second past drops (boundary pin).
    expect(
      parsePendingCommandFrame(frame(NOW - PENDING_COMMAND_MAX_AGE_SECONDS), NOW)
    ).not.toBeNull();
    expect(
      parsePendingCommandFrame(
        frame(NOW - PENDING_COMMAND_MAX_AGE_SECONDS - 1),
        NOW
      )
    ).toBeNull();
    // Future stamp within skew tolerance passes; beyond it drops.
    expect(
      parsePendingCommandFrame(
        frame(NOW + PENDING_COMMAND_MAX_FUTURE_SKEW_SECONDS),
        NOW
      )
    ).not.toBeNull();
    expect(
      parsePendingCommandFrame(
        frame(NOW + PENDING_COMMAND_MAX_FUTURE_SKEW_SECONDS + 1),
        NOW
      )
    ).toBeNull();
    // The default clock path is the phone's own wall time (mutation: a
    // hardcoded epoch default reddens this).
    const fresh = frame(Math.floor(Date.now() / 1000));
    expect(parsePendingCommandFrame(fresh)).not.toBeNull();
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
      issued_at: 1_700_000_000,
    }, 1_700_000_010);
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

  it('honours PHLIX_HUB_RELAY_PORT and rejects malformed overrides', () => {
    const config = Config as { PHLIX_HUB_RELAY_PORT?: string | number };
    try {
      config.PHLIX_HUB_RELAY_PORT = '9904';
      expect(hubRelayPort()).toBe(9904);
      expect(buildHubRelayUrl('https://h', 'srv-1')).toBe('wss://h:9904/syncplay/srv-1');
      config.PHLIX_HUB_RELAY_PORT = 'nope';
      expect(hubRelayPort()).toBe(8804);
      config.PHLIX_HUB_RELAY_PORT = 70000;
      expect(hubRelayPort()).toBe(8804);
      config.PHLIX_HUB_RELAY_PORT = 0;
      expect(hubRelayPort()).toBe(8804);
    } finally {
      delete config.PHLIX_HUB_RELAY_PORT;
    }
    expect(hubRelayPort()).toBe(8804);
  });

  // M-MOBILE-50 — the shared STRICT predicate: a look-alike that merely
  // starts with the letters `https` is NOT TLS on either lane now.
  it('treats only the exact https:// prefix as secure (strict predicate)', () => {
    expect(buildHubRelayUrl('httpsfoo://h', 'srv-1')).toBe(
      'ws://h:8804/syncplay/srv-1'
    );
    expect(buildHubRelayUrl('https://h', 'srv-1')).toBe(
      'wss://h:8804/syncplay/srv-1'
    );
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
    openHubRelayConnection(
      config({ tokenProvider: () => 's298fmCarrierProof9f' })
    );
    const ws = socket();
    expect(ws.url).toBe('ws://127.0.0.1:8804/syncplay/srv-1');
    // S237/S355 carrier: the token travels in the SUBPROTOCOL, never the query
    // string (query-string tokens are refused by design).
    expect(ws.url).not.toContain('token');
    expect(ws.protocols).toEqual(['bearer', 's298fmCarrierProof9f']);
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
      // Seconds-fresh under the M-MOBILE-55 replay window (real parse runs
      // against the phone clock on this path).
      issued_at: Math.floor(Date.now() / 1000),
      source: 'alexa',
    });
    expect(onPendingCommand).toHaveBeenCalledTimes(1);
    const command = onPendingCommand.mock.calls[0]![0] as PendingPlayMediaCommand;
    expect(command.mediaId).toBe('media-9');
    expect(command.title).toBe('Inception');
  });

  // M-MOBILE-29 — the socket is bound to ONE server (path + token scope);
  // a frame naming a DIFFERENT server_id must never drive navigation on
  // this device, even though the frame itself is well-formed.
  it('drops a pending_command whose server_id contradicts the bound socket', () => {
    const onPendingCommand = jest.fn();
    openHubRelayConnection(config({ serverId: 'srv-1', onPendingCommand }));
    socket().deliver({
      type: 'pending_command',
      command: 'play_media',
      server_id: 'srv-OTHER',
      media_id: 'media-9',
      title: 'Inception',
      // M-MOBILE-55: seconds-fresh stamp so the frame clears the parse
      // window — the drop here must be attributable to the server_id
      // contradiction check, not to the replay window (mutation teeth).
      issued_at: Math.floor(Date.now() / 1000),
    });
    expect(onPendingCommand).not.toHaveBeenCalled();
  });

  // M-MOBILE-28 — admission is size-capped BEFORE the parse: an oversize
  // frame is dropped loud (never fed to JSON.parse), and the socket keeps
  // running — good frames after it still deliver.
  it('drops an oversize frame before parsing, socket stays usable', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const onPendingCommand = jest.fn();
    try {
      openHubRelayConnection(config({ onPendingCommand }));
      socket().onmessage?.({ data: 'x'.repeat(MAX_INBOUND_FRAME_BYTES + 10) });
      expect(onPendingCommand).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('oversize'));
      socket().deliver({
        type: 'pending_command',
        command: 'play_media',
        server_id: 'srv-1',
        media_id: 'media-after-oversize',
        title: 'Still Working',
        issued_at: Math.floor(Date.now() / 1000),
      });
      expect(onPendingCommand).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
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
        issued_at: Math.floor(Date.now() / 1000),
      })
    ).not.toThrow();
    // A second frame still reaches the consumer.
    socket().deliver({
      type: 'pending_command',
      command: 'play_media',
      server_id: 'srv-1',
      media_id: 'media-10',
      title: 'Dune',
      issued_at: Math.floor(Date.now() / 1000),
    });
    expect(onPendingCommand).toHaveBeenCalledTimes(2);
  });

  it('runs a capped, jittered reconnect ladder, then parks at low frequency', () => {
    jest.useFakeTimers();
    try {
      openHubRelayConnection(config());
      socket().drop();
      // 1st reconnect after 1s (equal jitter ∈ [500,1000) still lands inside)
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
      // Budget spent (5 attempts). NEW LAW (review mobile__asphp: the old
      // dead-end left a sign-in-era hub outage permanently deaf): a PARK
      // re-arm keeps one probe per 60 s, and the parked probe restarts the
      // fast ladder. This replaced the "no 6th reconnect, ever" assertion.
      socket().drop();
      expect(getHubRelaySocket()).toBeNull();
      jest.advanceTimersByTime(59_999);
      expect(FakeWebSocket.instances).toHaveLength(6); // park not yet due
      jest.advanceTimersByTime(1);
      expect(FakeWebSocket.instances).toHaveLength(7); // parked dial fired
      // The parked dial reset the attempt budget: next drop redials fast.
      socket().drop();
      jest.advanceTimersByTime(1000);
      expect(FakeWebSocket.instances).toHaveLength(8);
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
describe('openHubRelayConnection — rebinding identity (review mobile__secnet m6)', () => {
  const config = (over: Partial<Parameters<typeof openHubRelayConnection>[0]> = {}) => ({
    serverId: 'srv-1',
    hubBaseUrl: 'http://127.0.0.1:8800',
    tokenProvider: () => 'relay-token-1',
    onPendingCommand: jest.fn(),
    ...over,
  });
  afterEach(() => {
    closeHubRelayConnection();
  });

  it('the SAME serverId pointed at a different hub URL re-dials (old early-return kept the dead socket)', () => {
    openHubRelayConnection(config());
    expect(FakeWebSocket.instances).toHaveLength(1);

    // Hub re-login elsewhere / hubUrl edit: the open socket belongs to the
    // OLD hub. Keying only on serverId (the defect) returned it verbatim.
    openHubRelayConnection(config({ hubBaseUrl: 'http://hub.example:8800' }));
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(FakeWebSocket.instances[1].url).toContain('hub.example');
    // The superseded socket was retired, not leaked:
    expect(FakeWebSocket.instances[0].onclose).toBeNull(); // detached before close
    expect(FakeWebSocket.instances[0].closed).toBe(true);
  });

  it('identical config on an open socket stays idempotent (no extra dial)', () => {
    openHubRelayConnection(config());
    openHubRelayConnection(config());
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});

// ── MW-122 (review mobile__crossfe #3): liveness watchdog + OS lifecycle ──────
// The relay lane adopted the SyncPlay lane's reconnect ladder and park, but
// never its two liveness halves: nothing noticed a zombie socket whose
// readyState stays OPEN after a silent peer death (the hub keeps counting the
// phone as an open app and burns each pending_command into a dead TCP lane),
// and nothing closed/re-dialed the socket across background/foreground.
// Wire law the watchdog stands on: hub `SyncPlayRelayWorker::handleCanonicalTimePing`
// answers `syncplay_time_ping` with `syncplay_time_pong` with NO room guard,
// and the same worker's header states "`pending_command` is dialect-
// agnostic" — latching the connection canonical costs the delivered commands
// nothing.
describe('MW-122 — relay liveness watchdog', () => {
  const config = (over: Partial<Parameters<typeof openHubRelayConnection>[0]> = {}) => ({
    serverId: 'srv-1',
    hubBaseUrl: 'http://127.0.0.1:8800',
    tokenProvider: () => 'relay-token-1',
    onPendingCommand: jest.fn(),
    ...over,
  });

  it('opens the ping cadence: a canonical syncplay_time_ping fires the moment the socket is open', () => {
    openHubRelayConnection(config());
    socket().open();
    expect(socket().sent).toHaveLength(1);
    const frame = JSON.parse(socket().sent[0]!) as Record<string, unknown>;
    expect(frame.type).toBe('syncplay_time_ping');
    expect(typeof frame.client_time).toBe('number');
    // Spec-shaped: every canonical frame carries protocol_version (SPEC §3).
    expect(typeof frame.protocol_version).toBe('number');
  });

  it('an answered ping keeps the socket: next tick pings again, never kills', () => {
    jest.useFakeTimers();
    try {
      openHubRelayConnection(config());
      socket().open();
      // Pong the first ping inside the timeout window.
      jest.advanceTimersByTime(5_000);
      socket().deliver({ type: 'syncplay_time_pong', client_time: Date.now(), server_time: Date.now() });
      jest.advanceTimersByTime(RELAY_PING_INTERVAL_MS);
      expect(FakeWebSocket.instances).toHaveLength(1); // no zombie verdict
      expect(socket().sent).toHaveLength(2);          // steady cadence continues
    } finally {
      jest.useRealTimers();
    }
  });

  it('an unanswered ping declares the socket dead and re-dials through the ladder', () => {
    jest.useFakeTimers();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      openHubRelayConnection(config());
      socket().open();
      // No pong ever arrives: the next tick sees the ping older than the
      // pong window and kills the zombie on OUR terms.
      jest.advanceTimersByTime(RELAY_PING_INTERVAL_MS);
      expect(socket().closed).toBe(true);
      // The warn line carries the exact window the verdict stood on — the
      // pin reads the same constant the watchdog compares against, so the
      // operator-facing number and the law can never drift apart.
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`syncplay_time_ping unanswered past ${RELAY_PONG_TIMEOUT_MS}ms`)
      );
      // The zombie close must NOT double-drive the ladder (handlers detached
      // first), and the ladder still fires: one dial after the kill.
      const instancesAfterKill = FakeWebSocket.instances.length;
      jest.advanceTimersByTime(1000);
      expect(FakeWebSocket.instances).toHaveLength(instancesAfterKill + 1);
    } finally {
      warnSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('a time_pong is never routed as a pending command', () => {
    const onPendingCommand = jest.fn();
    openHubRelayConnection(config({ onPendingCommand }));
    socket().open();
    socket().deliver({ type: 'syncplay_time_pong', client_time: 1, server_time: 2 });
    expect(onPendingCommand).not.toHaveBeenCalled();
  });

  it('close stops the watchdog: no ping leg outlives the teardown', () => {
    jest.useFakeTimers();
    try {
      openHubRelayConnection(config());
      socket().open();
      closeHubRelayConnection();
      jest.advanceTimersByTime(RELAY_PING_INTERVAL_MS * 3);
      expect(FakeWebSocket.instances).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('MW-122 — OS lifecycle on the relay lane', () => {
  const config = (over: Partial<Parameters<typeof openHubRelayConnection>[0]> = {}) => ({
    serverId: 'srv-1',
    hubBaseUrl: 'http://127.0.0.1:8800',
    tokenProvider: () => 'relay-token-1',
    onPendingCommand: jest.fn(),
    ...over,
  });

  it('background closes on our terms and reports it; foreground re-dials the kept intent', () => {
    const onStatusChange = jest.fn();
    openHubRelayConnection(config({ onStatusChange }));
    socket().open();

    handleHubRelayBackground();
    expect(socket().closed).toBe(true);
    expect(getHubRelaySocket()).toBeNull();
    // The lane reports its own death (status callback still bound — the
    // INTENT survives, only the transport goes).
    expect(onStatusChange).toHaveBeenLastCalledWith('closed');

    handleHubRelayForeground();
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(getHubRelaySocket()).not.toBeNull();
  });

  it('background tears down an armed ladder; foreground restarts from attempt 0', () => {
    jest.useFakeTimers();
    try {
      openHubRelayConnection(config());
      socket().drop(); // ladder armed
      handleHubRelayBackground();
      jest.advanceTimersByTime(120_000);
      expect(FakeWebSocket.instances).toHaveLength(1); // nothing dialed in background
      handleHubRelayForeground();
      jest.advanceTimersByTime(0);
      expect(FakeWebSocket.instances).toHaveLength(2); // immediate fast re-dial
    } finally {
      jest.useRealTimers();
    }
  });

  it('foreground VALIDATES before trusting: a silently-buried pipe is dropped and re-dialed (rec b)', () => {
    openHubRelayConnection(config());
    socket().open();
    // The OS killed the pipe WITHOUT delivering a close event to our
    // handlers (doze on a dead route): the reference survives, readyState
    // says CLOSED. Without the validation the early return would report
    // this corpse as a live lane until the watchdog's next verdict.
    const buried = socket();
    buried.readyState = FakeWebSocket.CLOSED;
    handleHubRelayForeground();
    expect(buried.closed).toBe(true); // the buried pipe was torn down...
    expect(FakeWebSocket.instances).toHaveLength(2); // ...and a fresh dial owns the lane
  });

  it('foreground leaves a CONNECTING dial in flight alone (rec b, negative leg)', () => {
    openHubRelayConnection(config());
    socket().readyState = FakeWebSocket.CONNECTING; // hand still up, not a corpse
    handleHubRelayForeground();
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(socket().closed).toBe(false);
  });

  it('backgrounding mid token-mint never materialises a socket (MW-010 mirror)', async () => {
    let release: (token: string) => void = () => undefined;
    const tokenProvider = () =>
      new Promise<string>((resolve) => {
        release = resolve;
      });
    openHubRelayConnection(config({ tokenProvider }));
    // The connect leg is parked on the token promise here.
    handleHubRelayBackground();
    release('relay-token-1');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeWebSocket.instances).toHaveLength(0);

    // Foreground owns the recovery — the intent was never cancelled. The
    // provider is a fresh mint per attempt, so release the second token too.
    handleHubRelayForeground();
    release('relay-token-1');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('foreground after a real close stays silent — close cancels the intent', () => {
    openHubRelayConnection(config());
    socket().open();
    closeHubRelayConnection();
    handleHubRelayForeground();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('lifecycle calls on an inert lane are no-ops', () => {
    expect(() => handleHubRelayBackground()).not.toThrow();
    expect(() => handleHubRelayForeground()).not.toThrow();
    expect(FakeWebSocket.instances).toHaveLength(0);
  });
});
