/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/syncplay/SyncPlayService.ts
/**
 * SyncPlay Service
 *
 * WebSocket-based service for synchronized group playback.
 * Implements NTP-style time synchronization and handles all SyncPlay
 * protocol messages with the server.
 *
 * ## Transport law (audit H1/M7)
 *
 * The endpoint is resolved by `syncplay/wsEndpoint.ts`: the DIRECT lane is the
 * server's dedicated `:8097` WS listener (handshake rejected pre-101 without a
 * JWT) and the RELAY lane is the hub's `:8804/syncplay/{server_id}`. Both
 * lanes carry their credential in the `Sec-WebSocket-Protocol: bearer, <jwt>`
 * subprotocol — direct per the dual-carrier TARGET law (phlix-server
 * 424c14d0, `docs/dev/WEBSOCKET_AUTH_CARRIERS.md`), relay per hub S237 — and
 * NEVER in the URL (estate policy WEBSOCKET_URL_QUERY_REFUSED). `openSocket`
 * constructs with the two-value `new WebSocket(url, protocols)` shape RN
 * supports natively (in-repo proof: hubRelay.ts dials `:8804` exactly this
 * way). Neither role plays on the HTTP API port, and nothing here
 * hand-builds those URLs a second time.
 *
 * INTERIM POSTURE (reviewer follow-up #1, 2026-09-29): the RELAY lane is
 * refused at `openSocket` before any dial — the hub relay speaks its own bare
 * room dialect, not the server's `syncplay_*` typed frames this client sends,
 * so a connected relay socket would silently no-op. See the guard there for
 * the removal law.
 *
 * ## Identity law (audit H4, SPEC §9)
 *
 * The server derives every member identity from the connection's JWT subject
 * and IGNORES client-claimed `member_id` fields (S289). The authoritative
 * "who am I in this group" answer arrives as `your_id` on the group_state
 * frame — the service keeps it (`yourId`) and compares host ids against it, so
 * host gating works no matter what string the screens pass in.
 *
 * ## TimeSync Protocol (SPEC §5, server TimeSync.php)
 *
 * 1. Client sends syncplay_time_ping with local timestamp t1
 * 2. Server replies syncplay_time_pong with `{client_time: t1, server_time: t2}`
 *    — the pong carries NO separate t3; the server's compute law treats the
 *    response time as equal to the receive time, so t3 = t2 and rtt = t4 − t1.
 * 3. Client computes: offset = t2 − t1 + rtt/2
 * 4. Rolling average of last OFFSET_SAMPLE_COUNT samples (rtt < 0 or above
 *    MAX_ACCEPTABLE_RTT is rejected, SPEC §5)
 * 5. adjustedTime = Date.now() + averageOffset
 */

import { useSyncplayStore } from '../store/syncplayStore';
import { useHubStore } from '../store/hubStore';
import { wireMsToSeconds } from './wireUnits';
import {
  resolveSyncPlayWsEndpoint,
  type SyncPlayWsEndpoint,
} from './wsEndpoint';
import { hashGroupPassword } from './sha256';
import {
  SYNCPLAY_MESSAGE_TYPES,
  PROTOCOL_VERSION,
  OFFSET_SAMPLE_COUNT,
  MAX_ACCEPTABLE_RTT,
  STABILITY_VARIANCE_THRESHOLD,
} from '@phlix/syncplay';
import type { SyncPlayMessageType } from '@phlix/syncplay';

// ---------------------------------------------------------------------------
// Message Types — canonical map + protocol version come from @phlix/syncplay.
// (mirrors src/Session/SyncPlay/Messages.php). NOTE: the package keys are
// `CHAT`/`TYPING` (mobile previously used `CHAT_MESSAGE`/`CHAT_TYPING`); the
// wire string values are identical, so only the key references change.
// ---------------------------------------------------------------------------

const MSG = SYNCPLAY_MESSAGE_TYPES;

// ---------------------------------------------------------------------------
// Reconnect ladder (audit M5) — mirrors the capped ladder of
// `src/syncplay/hubRelay.ts` and adds equal jitter so two clients that lost
// the same network do not stampede the listener in lockstep.
// ---------------------------------------------------------------------------

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30_000;

/**
 * User-facing sentence for the interim relay refusal (reviewer follow-up #1,
 * 2026-09-29). Exported so the refusal tests pin the exact copy through the
 * SAME constant the service raises — the code travels as the onError first
 * argument and the sentence rides second, which `describeSyncPlayError`
 * renders verbatim for codes outside the wire catalog (same arm SEND_FAILED
 * uses).
 */
export const RELAY_UNSUPPORTED_MESSAGE =
  'Group Watch is not yet supported over a hub relay connection — switch to a direct connection to your server to use SyncPlay.';

// ---------------------------------------------------------------------------
// TimeSync - NTP-style clock offset calculation
//
// The numeric tuning constants (OFFSET_SAMPLE_COUNT, MAX_ACCEPTABLE_RTT,
// STABILITY_VARIANCE_THRESHOLD) are imported from @phlix/syncplay so client and
// server agree. The local TimeSync class is retained (rather than swapped for
// the package's `TimeSync`) because the package class requires an injected
// `now` clock and uses second-based drift timestamps — adopting it fully would
// change observable timing behavior. See E1 worklog for the chosen path.
// ---------------------------------------------------------------------------

const SYNC_INTERVAL_MS = 30000;

interface OffsetSample {
  offset: number;
  rtt: number;
  timestamp: number;
}

class TimeSync {
  private samples: OffsetSample[] = [];

  /**
   * Get the current estimated time offset from server (ms).
   * Add this to local time to get server-synchronized time.
   */
  getOffset(): number {
    if (this.samples.length === 0) {
      return 0;
    }

    const recent = this.samples.slice(-OFFSET_SAMPLE_COUNT);
    let weightedSum = 0;
    let weightSum = 0;

    for (const sample of recent) {
      const weight = 1 / Math.max(1, sample.rtt);
      weightedSum += sample.offset * weight;
      weightSum += weight;
    }

    // Each weight is positive (1 / max(1, rtt)), so weightSum > 0 whenever a
    // sample exists. Dividing by max(1, weightSum) here silently crushed every
    // realistic sample (rtt ≈ 50-100 ms ⇒ weightSum ≈ 0.01-0.02) toward zero —
    // a single 90 ms offset read back as 1 ms. Plain weighted mean it is.
    return Math.round(weightedSum / weightSum);
  }

  /**
   * Get estimated one-way latency to server (ms).
   */
  getLatency(): number {
    if (this.samples.length === 0) {
      return 0;
    }

    const recent = this.samples.slice(-OFFSET_SAMPLE_COUNT);
    let totalLatency = 0;

    for (const sample of recent) {
      totalLatency += sample.rtt / 2;
    }

    return Math.round(totalLatency / recent.length);
  }

  /**
   * Check if time sync has collected enough stable samples.
   */
  isStable(): boolean {
    if (this.samples.length < OFFSET_SAMPLE_COUNT) {
      return false;
    }

    const recent = this.samples.slice(-OFFSET_SAMPLE_COUNT);
    const offsets = recent.map((s) => s.offset);
    const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;

    let varianceSum = 0;
    for (const offset of offsets) {
      const diff = offset - mean;
      varianceSum += diff * diff;
    }
    const variance = varianceSum / offsets.length;

    return variance < STABILITY_VARIANCE_THRESHOLD;
  }

  /**
   * Add a time sync sample from a pong response.
   *
   * @param t1 Client send time (ms)
   * @param t2 Server receive time (ms)
   * @param t3 Server response time (ms) — the server pong law makes this t2
   * @param t4 Client receive time (ms)
   */
  addSample(t1: number, t2: number, t3: number, t4: number): void {
    const rtt = t4 - t1 - (t3 - t2);

    // SPEC §5 (audit LOW): a negative rtt means the clocks moved backwards
    // mid-exchange (NTP step, suspend/resume); a sample above the ceiling is
    // transport noise. Both must be REJECTED, never averaged in.
    if (!Number.isFinite(rtt) || rtt < 0 || rtt > MAX_ACCEPTABLE_RTT) {
      return;
    }

    const latency = rtt / 2;
    // offset = server_time - client_time + latency
    const offset = Math.round(t2 - t1 + latency);

    this.samples.push({
      offset,
      rtt,
      timestamp: Date.now(),
    });

    // Keep rolling buffer
    if (this.samples.length > OFFSET_SAMPLE_COUNT * 2) {
      this.samples.shift();
    }
  }

  /**
   * Reset all time sync samples.
   */
  reset(): void {
    this.samples = [];
  }

  /**
   * Get current sync status.
   */
  getStatus(): { offset: number; latency: number; isStable: boolean; sampleCount: number } {
    return {
      offset: this.getOffset(),
      latency: this.getLatency(),
      isStable: this.isStable(),
      sampleCount: this.samples.length,
    };
  }
}

// ---------------------------------------------------------------------------
// SyncPlayService
// ---------------------------------------------------------------------------

export interface SyncPlayMember {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
}

export interface SyncPlayGroup {
  id: string;
  name: string;
  members: SyncPlayMember[];
  currentMediaId: string | null;
  playbackState: 'playing' | 'paused' | 'stopped';
  /** Playhead anchor in SECONDS — decoded from the wire's ms at this boundary (S441). */
  playbackPosition: number;
  hostId: string;
  hasPassword: boolean;
}

export type PlaybackCommand = {
  type: 'play' | 'pause' | 'seek';
  /** Playhead in SECONDS — the app-internal unit (S441: wire ms decoded once at the handlers). */
  position: number;
  serverTime: number;
};

type WsMessage = {
  /** A SyncPlay wire message type (one of @phlix/syncplay's 19), or any other
   * string the server may emit; unknown types are ignored by routeMessage. */
  type: SyncPlayMessageType | string;
  [key: string]: unknown;
};

/** Parse a wire field into a usable string at the boundary; anything else
 * (number, object, missing) becomes undefined so `??` chains fall through. */
function wireString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Parse a wire field into a finite number at the boundary (undefined for
 * strings, objects, NaN/Infinity — the same parse-not-cast doctrine). */
function wireNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface SyncPlayServiceEvents {
  onConnectionStateChange: (state: ConnectionState) => void;
  onGroupStateUpdate: (group: SyncPlayGroup) => void;
  onPlaybackCommand: (cmd: PlaybackCommand) => void;
  onMemberJoined: (member: SyncPlayMember) => void;
  onMemberLeft: (memberId: string) => void;
  onHostChanged: (newHostId: string) => void;
  onError: (code: string, message: string) => void;
  onTimeSyncUpdate: (status: { offset: number; latency: number; isStable: boolean }) => void;
}

class SyncPlayService {
  private ws: WebSocket | null = null;
  private timeSync = new TimeSync();
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private memberId: string = '';
  /**
   * The server-issued "you are this member" id (`your_id` on group_state,
   * sourced from the JWT subject). Authoritative for host comparisons —
   * `memberId` is only the pre-join placeholder claim. (audit H4)
   */
  private yourId: string = '';
  private events: Partial<SyncPlayServiceEvents> = {};
  private connectionState: ConnectionState = 'disconnected';
  /** Bumped by every explicit connect/disconnect; stale socket callbacks drop. */
  private connectionGeneration = 0;
  /** Room to join once the socket opens (connectWithRoom); null = re-join current. */
  private pendingJoinRoomId: string | null = null;
  /** Member ids seen in the last group_state — the basis of join/left diffs. */
  private lastMemberIds = new Set<string>();
  private reconnectAttempts = 0;

  /**
   * Connect to the SyncPlay WebSocket endpoint.
   * The endpoint (direct `:8097` or hub relay `:8804`, both with the bearer
   * subprotocol carrier) is resolved by `wsEndpoint.ts` from the hub store
   * state. Relay mode currently fails loud before dialing — interim refusal,
   * see `openSocket`.
   */
  connect(memberId: string): void {
    this.memberId = memberId;
    this.pendingJoinRoomId = null;
    this.reconnectAttempts = 0;
    this.startConnection();
  }

  /**
   * Connect and join a specific SyncPlay room (created/joined over REST).
   *
   * The endpoint is resolved internally — callers MUST NOT hand in a URL:
   * the transport law (port, token carrier) lives in `wsEndpoint.ts` alone
   * (audit H1 — the old signature took a `{apiHost}/api/v1/syncplay/ws` URL
   * built against the HTTP port, which no listener serves).
   */
  connectWithRoom(roomId: string, sessionId: string): void {
    this.memberId = sessionId;
    this.pendingJoinRoomId = roomId;
    this.reconnectAttempts = 0;
    this.startConnection();
  }

  /**
   * Disconnect from the SyncPlay WebSocket.
   */
  disconnect(): void {
    this.connectionGeneration++;
    this.stopSyncInterval();
    this.stopReconnect();

    this.closeSocketQuietly();

    this.setConnectionState('disconnected');
    this.timeSync.reset();
    this.yourId = '';
    this.lastMemberIds.clear();
    this.pendingJoinRoomId = null;
    this.reconnectAttempts = 0;
    useSyncplayStore.getState().reset();
  }

  /**
   * Register event handlers.
   */
  on<K extends keyof SyncPlayServiceEvents>(event: K, handler: SyncPlayServiceEvents[K]): void {
    this.events[event] = handler;
  }

  off(event: keyof SyncPlayServiceEvents): void {
    delete this.events[event];
  }

  /**
   * Create a new SyncPlay group.
   *
   * The group gate goes on the wire as SPEC §4's `password_hash` — the
   * SHA-256 hex digest — never the plaintext (audit LOW; the server keeps a
   * legacy plaintext arm, but the hash is the canonical precedence arm and
   * interoperates with either spelling).
   */
  createGroup(groupName: string, password?: string): void {
    const payload: Record<string, unknown> = {
      type: MSG.GROUP_CREATE,
      protocol_version: PROTOCOL_VERSION,
      group_name: groupName,
      member_id: this.memberId,
      member_name: this.getMemberName(),
      timestamp: Date.now(),
    };

    // Absent/empty gate = the field is OMITTED entirely: the server would read
    // a hash-of-empty-string as a SET (empty) group gate. This call site owns
    // the omission decision; `hashGroupPassword` carries the matching
    // fail-loud tripwire for any future caller that skips this guard.
    if (password !== undefined && password !== '') {
      payload.password_hash = hashGroupPassword(password);
    }

    this.send(payload);
  }

  /**
   * Join an existing SyncPlay group (see {@link createGroup} on the gate field).
   */
  joinGroup(groupId: string, password?: string): void {
    const payload: Record<string, unknown> = {
      type: MSG.GROUP_JOIN,
      protocol_version: PROTOCOL_VERSION,
      group_id: groupId,
      member_id: this.memberId,
      member_name: this.getMemberName(),
      timestamp: Date.now(),
    };

    // Same gate-omission law as createGroup (no hash-of-empty on the wire;
    // the tripwire lives in hashGroupPassword).
    if (password !== undefined && password !== '') {
      payload.password_hash = hashGroupPassword(password);
    }

    this.send(payload);
  }

  /**
   * Leave the current SyncPlay group.
   */
  leaveGroup(): void {
    const store = useSyncplayStore.getState();
    if (!store.currentGroup) {
      return;
    }

    this.send({
      type: MSG.GROUP_LEAVE,
      protocol_version: PROTOCOL_VERSION,
      group_id: store.currentGroup.id,
      member_id: this.memberId,
      timestamp: Date.now(),
    });

    useSyncplayStore.getState().setCurrentGroup(null);
    this.lastMemberIds.clear();
    this.stopSyncInterval();
  }

  /**
   * Send a playback play command (host only).
   *
   * `position` is WIRE MILLISECONDS (S293: callers convert once via
   * `toSyncPlayPositionMs`); the frame passes through untouched. The
   * optimistic store write below records the app-internal SECONDS (S441).
   */
  sendPlay(position: number): void {
    const store = useSyncplayStore.getState();
    if (!store.currentGroup || !store.isHost) {
      return;
    }

    const serverTime = this.getSynchronizedTime();

    this.send({
      type: MSG.PLAYBACK_PLAY,
      protocol_version: PROTOCOL_VERSION,
      group_id: store.currentGroup.id,
      member_id: this.memberId,
      position,
      server_time: serverTime,
      timestamp: Date.now(),
    });

    // Optimistically update local state — the store keeps SECONDS (S441).
    useSyncplayStore.getState().updatePlaybackState('playing', wireMsToSeconds(position) ?? 0);
  }

  /**
   * Send a playback pause command (host only).
   *
   * `position` is WIRE MILLISECONDS; the optimistic store write keeps SECONDS (S441).
   */
  sendPause(position: number): void {
    const store = useSyncplayStore.getState();
    if (!store.currentGroup || !store.isHost) {
      return;
    }

    const serverTime = this.getSynchronizedTime();

    this.send({
      type: MSG.PLAYBACK_PAUSE,
      protocol_version: PROTOCOL_VERSION,
      group_id: store.currentGroup.id,
      member_id: this.memberId,
      position,
      server_time: serverTime,
      timestamp: Date.now(),
    });

    // Optimistically update local state — the store keeps SECONDS (S441).
    useSyncplayStore.getState().updatePlaybackState('paused', wireMsToSeconds(position) ?? 0);
  }

  /**
   * Send a playback seek command (host only).
   *
   * Both positions are WIRE MILLISECONDS; the optimistic store write keeps SECONDS (S441).
   */
  sendSeek(fromPosition: number, toPosition: number): void {
    const store = useSyncplayStore.getState();
    if (!store.currentGroup || !store.isHost) {
      return;
    }

    const serverTime = this.getSynchronizedTime();

    this.send({
      type: MSG.PLAYBACK_SEEK,
      protocol_version: PROTOCOL_VERSION,
      group_id: store.currentGroup.id,
      member_id: this.memberId,
      from_position: fromPosition,
      to_position: toPosition,
      server_time: serverTime,
      timestamp: Date.now(),
    });

    // Optimistically update local state — the store keeps SECONDS (S441).
    useSyncplayStore.getState().updatePlaybackState(
      store.currentGroup.playbackState,
      wireMsToSeconds(toPosition) ?? 0
    );
  }

  /**
   * Report current playback position to the group (periodic, all members).
   *
   * SPEC §4/§9.1 shape: a `playback_sync` state report — `position` in WIRE
   * MILLISECONDS plus the playing flag. The server answers every playback_sync
   * with a host-stamped rebroadcast (S291), so this frame doubles as the
   * re-anchor request; the old invented `info { position_report }` payload was
   * unread by the server.
   */
  reportPosition(position: number): void {
    const store = useSyncplayStore.getState();
    if (!store.currentGroup) {
      return;
    }

    this.send({
      type: MSG.PLAYBACK_SYNC,
      protocol_version: PROTOCOL_VERSION,
      group_id: store.currentGroup.id,
      member_id: this.memberId,
      position,
      is_playing: store.currentGroup.playbackState === 'playing',
      server_time: this.getSynchronizedTime(),
      timestamp: Date.now(),
    });
  }

  /**
   * Request time synchronization with the server.
   */
  requestTimeSync(): void {
    const t1 = Date.now();

    // The pong is routed back through handleMessage → handleTimePong, which adds
    // the completed sample and fires onTimeSyncUpdate. We only send the ping here.
    this.send({
      type: MSG.TIME_PING,
      protocol_version: PROTOCOL_VERSION,
      client_time: t1,
      timestamp: t1,
    });
  }

  /**
   * Get current synchronized time (local time + offset).
   */
  getSynchronizedTime(): number {
    return Date.now() + this.timeSync.getOffset();
  }

  /**
   * Get TimeSync status.
   */
  getTimeSyncStatus(): { offset: number; latency: number; isStable: boolean } {
    return {
      offset: this.timeSync.getOffset(),
      latency: this.timeSync.getLatency(),
      isStable: this.timeSync.isStable(),
    };
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  /**
   * Begin (or restart) a connection: cancel any armed ladder, replace the
   * live socket, and open asynchronously — the endpoint resolve reads the
   * token vault, which is a Promise API on both lanes.
   */
  private startConnection(): void {
    this.connectionGeneration++;
    this.stopSyncInterval();
    this.stopReconnect();
    this.closeSocketQuietly();
    this.setConnectionState('connecting');

    const generation = this.connectionGeneration;
    this.openSocket(generation);
  }

  /**
   * Resolve the endpoint and construct the socket.
   *
   * Every await boundary re-checks `generation`: a disconnect() or a newer
   * connect() during the async resolve must drop this attempt, not open a
   * zombie socket whose callbacks would then drive the shared state machine.
   */
  private async openSocket(generation: number): Promise<void> {
    const { connectionMode, effectiveServerUrl, hubUrl, activeServerId } =
      useHubStore.getState();

    // ── INTERIM RELAY REFUSAL (reviewer follow-up #1, 2026-09-29) ──────────
    // The hub's :8804 relay understands its BARE room vocabulary (group_join,
    // playback_*, time_sync in; room_state out — phlix-hub
    // SyncPlayRelayWorker::handleTextFrame), NOT the server's `syncplay_*`
    // typed frames this client speaks. Every frame would hit the hub's default
    // arm, and nothing relays before a room attaches: the socket would connect
    // then SILENTLY no-op. Until the estate lands a dialect adapter, fail LOUD
    // at the earliest seam that knows both the mode and the syncplay intent —
    // before the relay-token mint, before any construction, and terminal (no
    // ladder behind a known-dead lane). wsEndpoint's S237-law relay builder
    // stays wired for the day hub dialect bridging lands; DELETE THIS GUARD
    // THEN.
    if (connectionMode === 'relay') {
      this.events.onError?.('RELAY_NOT_SUPPORTED', RELAY_UNSUPPORTED_MESSAGE);
      this.setConnectionState('error');
      return;
    }

    let endpoint: SyncPlayWsEndpoint | null = null;
    try {
      endpoint = await resolveSyncPlayWsEndpoint({
        connectionMode,
        effectiveServerUrl,
        hubUrl,
        activeServerId,
        getHubAccessToken: () => useHubStore.getState().session?.accessToken ?? null,
      });
    } catch (error) {
      console.error('SyncPlay: endpoint resolution failed', error);
    }
    if (generation !== this.connectionGeneration) {
      return; // superseded by disconnect()/a newer connect()
    }
    if (!endpoint) {
      // No lane without a credential — both listeners reject unauthenticated
      // upgrades, so there is nothing to "try anyway" with.
      this.setConnectionState('error');
      return;
    }

    try {
      const ws = endpoint.protocols
        ? new WebSocket(endpoint.url, endpoint.protocols)
        : new WebSocket(endpoint.url);
      ws.onopen = () => this.handleOpen(generation);
      ws.onclose = () => this.handleClose(generation);
      ws.onerror = () => this.handleError(generation);
      ws.onmessage = (event) => this.handleMessage(event);
      this.ws = ws;
    } catch {
      this.setConnectionState('error');
    }
  }

  /** Close the current socket WITHOUT touching store/timers/state. */
  private closeSocketQuietly(): void {
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
    }
  }

  private getMemberName(): string {
    // Could be extended to get from auth store
    return 'Mobile User';
  }

  /**
   * Serialize and send one frame.
   *
   * A frame that cannot go out is LOUD (audit LOW): the old silent drop let
   * hosts believe their commands had propagated while the socket sat closed.
   * `SEND_FAILED` flows through the same onError channel the UI already
   * surfaces, and the socket-not-open case is logged at the boundary.
   */
  private send(payload: Record<string, unknown>): void {
    const detail = String(payload.type ?? 'frame');
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.events.onError?.('SEND_FAILED', `Socket not open — dropped ${detail}`);
      return;
    }
    try {
      this.ws.send(JSON.stringify(payload));
    } catch (error) {
      this.events.onError?.(
        'SEND_FAILED',
        `Send of ${detail} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.events.onConnectionStateChange?.(state);
  }

  private startSyncInterval(): void {
    this.stopSyncInterval();
    this.requestTimeSync();
    this.syncInterval = setInterval(() => {
      if (this.connectionState === 'connected') {
        this.requestTimeSync();
      }
    }, SYNC_INTERVAL_MS);
  }

  private stopSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Capped exponential backoff with equal jitter (mirrors the hubRelay.ts
   * ladder, ceiling at RECONNECT_MAX_DELAY_MS, self-terminating after
   * MAX_RECONNECT_ATTEMPTS). The previous fixed 5s uncapped retry hammered the
   * listener forever behind an outage (audit M5).
   */
  private scheduleReconnect(): void {
    this.stopReconnect();
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `SyncPlay: reconnect budget exhausted after ${MAX_RECONNECT_ATTEMPTS} attempts — reopening needs an explicit connect()`
      );
      this.setConnectionState('error');
      return;
    }
    const ceiling = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_DELAY_MS
    );
    const delay = Math.round(ceiling / 2 + Math.random() * (ceiling / 2));
    this.reconnectAttempts += 1;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.openSocket(this.connectionGeneration);
    }, delay);
  }

  private stopReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private handleOpen(generation: number): void {
    if (generation !== this.connectionGeneration) {
      return;
    }
    this.setConnectionState('connected');
    this.reconnectAttempts = 0;
    // SPEC §10.1 (audit M5): every established connection — first or
    // auto-reconnect — starts in a fresh clock domain. Old offsets measured
    // against a dead process must not skew the new one.
    this.timeSync.reset();
    this.startSyncInterval();

    if (this.pendingJoinRoomId !== null) {
      const roomId = this.pendingJoinRoomId;
      this.pendingJoinRoomId = null;
      this.joinGroup(roomId);
      return;
    }

    // Re-join group if we had one
    const { currentGroup } = useSyncplayStore.getState();
    if (currentGroup) {
      this.joinGroup(currentGroup.id);
    }
  }

  private handleClose(generation: number): void {
    if (generation !== this.connectionGeneration) {
      return;
    }
    this.ws = null;
    this.setConnectionState('disconnected');
    this.stopSyncInterval();
    this.timeSync.reset();
    this.lastMemberIds.clear();
    this.scheduleReconnect();
  }

  private handleError(generation: number): void {
    if (generation !== this.connectionGeneration) {
      return;
    }
    this.setConnectionState('error');
  }

  /**
   * Parse and route one inbound frame.
   *
   * Handler errors used to vanish into a single silent catch (audit H2 — a
   * TypeError inside handleGroupState meant live state NEVER landed and nothing
   * said so). Both the JSON parse and the routed handler now fail LOUD at the
   * boundary: logged, and the socket keeps running.
   *
   * The event is typed structurally ({ data }) so the DOM MessageEvent and
   * RN's WebSocketMessageEvent shapes both satisfy the handler.
   */
  private handleMessage(event: { data?: unknown }): void {
    let msg: WsMessage;
    try {
      msg = JSON.parse(String(event.data)) as WsMessage;
    } catch (error) {
      console.error('SyncPlay: dropping malformed frame', error);
      return;
    }
    try {
      this.routeMessage(msg);
    } catch (error) {
      console.error(`SyncPlay: handler for '${String(msg.type)}' threw`, error);
    }
  }

  private routeMessage(msg: WsMessage): void {
    switch (msg.type) {
      case MSG.GROUP_STATE:
        this.handleGroupState(msg);
        break;

      case MSG.PLAYBACK_PLAY:
        this.handlePlaybackPlay(msg);
        break;

      case MSG.PLAYBACK_PAUSE:
        this.handlePlaybackPause(msg);
        break;

      case MSG.PLAYBACK_SEEK:
        this.handlePlaybackSeek(msg);
        break;

      case MSG.PLAYBACK_SYNC:
        this.handlePlaybackSync(msg);
        break;

      case MSG.HOST_ELECT:
        this.handleHostElect(msg);
        break;

      case MSG.INFO:
        this.handleInfo(msg);
        break;

      case MSG.ERROR:
        this.handleErrorMsg(msg);
        break;

      case MSG.TIME_PONG:
        this.handleTimePong(msg);
        break;

      default:
        break;
    }
  }

  /**
   * Apply one authoritative group snapshot.
   *
   * Wire law (audit H2/H3, SPEC §4): `members` rides as a DICTIONARY keyed by
   * member id (an array `for...of` threw on every real snapshot — state never
   * landed), and the group fields are `group_id`/`group_name`. Member LEFT has
   * no frame type (SPEC §6): it is diffed out of successive snapshots, so the
   * old prose sniff on the INFO message is gone.
   */
  private handleGroupState(msg: WsMessage): void {
    const groupData = msg.group as Record<string, unknown> | undefined;

    if (!groupData) {
      console.error('SyncPlay: group_state frame without a group payload');
      return;
    }

    const yourId = wireString(msg.your_id);
    if (yourId !== undefined) {
      this.yourId = yourId;
    }
    // Pre-first-snapshot fallback: the id we claimed (real user id per H4).
    const you = this.yourId !== '' ? this.yourId : this.memberId;

    const hostId = wireString(groupData.host_id) ?? '';
    const members: SyncPlayMember[] = [];
    const rawMembers = groupData.members;
    const entries: [string, Record<string, unknown>][] = Array.isArray(rawMembers)
      ? (rawMembers as Record<string, unknown>[]).map((m, index) => [
          wireString(m?.id) ?? String(index),
          m ?? {},
        ])
      : Object.entries((rawMembers as Record<string, Record<string, unknown>> | undefined) ?? {});

    for (const [key, raw] of entries) {
      const id = wireString(raw.id) ?? key;
      members.push({
        id,
        name: wireString(raw.name) ?? 'Unknown',
        isHost: id === hostId,
        // Wire joined_at is Unix SECONDS; the app model keeps epoch ms.
        joinedAt: (wireNumber(raw.joined_at) ?? Math.floor(Date.now() / 1000)) * 1000,
      });
    }

    const group: SyncPlayGroup = {
      id: wireString(groupData.group_id) ?? wireString(groupData.id) ?? '',
      name: wireString(groupData.group_name) ?? wireString(groupData.name) ?? '',
      members,
      currentMediaId: wireString(groupData.current_media_id) ?? null,
      playbackState: ((groupData.playback_state as string) ?? 'stopped') as SyncPlayGroup['playbackState'],
      // S441 — the snapshot anchor arrives in WIRE ms; the group (and every
      // consumer below it) speaks SECONDS.
      playbackPosition: wireMsToSeconds(wireNumber(groupData.playback_position)) ?? 0,
      hostId,
      hasPassword: groupData.has_password === true,
    };

    useSyncplayStore.getState().setCurrentGroup(group);
    useSyncplayStore.getState().setIsHost(you !== '' && you === group.hostId);

    // SPEC §6: a member is gone when a snapshot simply lacks them — emit the
    // left events from the diff (this replaces the prose `message.includes`
    // sniff that never matched the server's actual INFO wording pattern).
    const currentIds = new Set(members.map((m) => m.id));
    for (const memberId of this.lastMemberIds) {
      if (!currentIds.has(memberId)) {
        this.events.onMemberLeft?.(memberId);
      }
    }
    this.lastMemberIds = currentIds;

    this.events.onGroupStateUpdate?.(group);
  }

  private handlePlaybackPlay(msg: WsMessage): void {
    // S441 — the frame carries MILLISECONDS; the store and the event speak SECONDS.
    const position = wireMsToSeconds(wireNumber(msg.position)) ?? 0;
    const serverTime = wireNumber(msg.server_time) ?? this.getSynchronizedTime();

    useSyncplayStore.getState().updatePlaybackState('playing', position);
    this.events.onPlaybackCommand?.({ type: 'play', position, serverTime });
  }

  private handlePlaybackPause(msg: WsMessage): void {
    // S441 — the frame carries MILLISECONDS; the store and the event speak SECONDS.
    const position = wireMsToSeconds(wireNumber(msg.position)) ?? 0;
    const serverTime = wireNumber(msg.server_time) ?? this.getSynchronizedTime();

    useSyncplayStore.getState().updatePlaybackState('paused', position);
    this.events.onPlaybackCommand?.({ type: 'pause', position, serverTime });
  }

  private handlePlaybackSeek(msg: WsMessage): void {
    // S441 — `to_position` arrives in MILLISECONDS; store + event get SECONDS.
    const toPosition = wireMsToSeconds(wireNumber(msg.to_position)) ?? 0;
    const serverTime = wireNumber(msg.server_time) ?? this.getSynchronizedTime();

    useSyncplayStore.getState().updatePlaybackState(
      useSyncplayStore.getState().currentGroup?.playbackState ?? 'paused',
      toPosition
    );
    this.events.onPlaybackCommand?.({ type: 'seek', position: toPosition, serverTime });
  }

  /**
   * Handle the host-stamped `playback_sync` rebroadcast (SPEC §9.1, audit LOW).
   *
   * The server answers EVERY playback_sync — including the sender's own
   * request — with the host's current media, position (WIRE ms) and playing
   * flag (S291). Followers treat it as a re-anchor command; it is the frame
   * that keeps drifted members honest, and it used to fall through unrouted.
   */
  private handlePlaybackSync(msg: WsMessage): void {
    const position = wireMsToSeconds(wireNumber(msg.position)) ?? 0;
    const isPlaying = msg.is_playing === true;
    const serverTime = wireNumber(msg.server_time) ?? this.getSynchronizedTime();

    useSyncplayStore.getState().updatePlaybackState(
      isPlaying ? 'playing' : 'paused',
      position
    );
    this.events.onPlaybackCommand?.({
      type: isPlaying ? 'play' : 'pause',
      position,
      serverTime,
    });
  }

  private handleHostElect(msg: WsMessage): void {
    const newHostId = wireString(msg.elected_id);

    if (newHostId) {
      const you = this.yourId !== '' ? this.yourId : this.memberId;
      useSyncplayStore.getState().setIsHost(newHostId === you);
      this.events.onHostChanged?.(newHostId);
    }
  }

  /**
   * INFO frames carry the group's human events. SPEC §6: a member join arrives
   * with TOP-LEVEL `member_id`/`member_name` (the old code read a nested
   * `data` object that the server never sends, so join toasts never fired).
   * Departures are NOT here — they diff out of group_state snapshots.
   */
  private handleInfo(msg: WsMessage): void {
    const memberId = wireString(msg.member_id);
    const memberName = wireString(msg.member_name);

    if (memberId !== undefined && memberName !== undefined) {
      this.events.onMemberJoined?.({
        id: memberId,
        name: memberName,
        isHost: false,
        joinedAt: Date.now(),
      });
    }
  }

  private handleErrorMsg(msg: WsMessage): void {
    // phlix-syncplay SPEC read order: `error_code` (Messages::error) first,
    // then the legacy `code` (SyncPlayManager::sendError), then the sentinel.
    // `code` is parsed, not cast: a non-string wire value must not poison the
    // event signature (doctrine: boundary parses, internals trust).
    const code = wireString(msg.error_code) ?? wireString(msg.code) ?? 'UNKNOWN';
    const message = wireString(msg.message) ?? 'Unknown error';

    this.events.onError?.(code, message);
  }

  /**
   * Complete one NTP sample from the pong.
   *
   * The server pong wire is `{client_time, server_time}` ONLY (TimeSync.php) —
   * its compute law treats the response time t3 as EQUAL to the receive time
   * t2. Passing `t2 + latency` for t3 (the old code) double-subtracted half
   * the round trip and skewed every offset (audit LOW).
   */
  private handleTimePong(msg: WsMessage): void {
    const t1 = wireNumber(msg.client_time) ?? Date.now();
    const t2 = wireNumber(msg.server_time) ?? t1;
    const t4 = Date.now();

    this.timeSync.addSample(t1, t2, t2, t4);

    this.events.onTimeSyncUpdate?.({
      offset: this.timeSync.getOffset(),
      latency: this.timeSync.getLatency(),
      isStable: this.timeSync.isStable(),
    });
  }
}

export const syncPlayService = new SyncPlayService();
export default syncPlayService;
