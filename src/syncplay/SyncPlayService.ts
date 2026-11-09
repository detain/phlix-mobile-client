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
 * RELAY POSTURE (owner decision #14, phlix-hub cc1e128): the hub's `:8804`
 * relay now speaks this client's canonical `syncplay_*` catalog — a connection
 * latches its dialect on its first `syncplay_*` frame and every reply comes
 * back in it, so relay mode dials for real. The interim refusal guard is
 * removed; the relay lane and the direct lane share this one state machine.
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
import { serverTimeToMs, wireMsToSeconds } from './wireUnits';
import { MAX_INBOUND_FRAME_BYTES } from './frameLimits';
import {
  resolveSyncPlayWsEndpoint,
  SyncPlayHostPinError,
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
import type { PlaybackState, SyncPlayMessageType } from '@phlix/syncplay';

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
 * Park-at-cap re-arm (review mobile__asphp M2 / mobile__exploiter Info, fix
 * shaped after the hub's Federation lane 229d3d1): once the fast ladder's
 * budget is spent the socket does NOT dead-end in 'error' until a screen
 * drives an explicit connect() — it parks at a low frequency and keeps
 * retrying, because a phone walking between LTE/Wi-Fi zones can burn the
 * 5-attempt budget in ~31 s of one outage and then sit deaf forever. The
 * next dial restarts the fast ladder. The server's `JoinPasswordThrottle`
 * remains the outer abuse backstop.
 */
const RECONNECT_PARK_DELAY_MS = 60_000;

/**
 * Pong watchdog (review mobile__asphp M10): the 30 s `time_ping` had no
 * answer-oracle, so a socket whose peer silently vanished (iOS tears the TCP
 * down on suspend; Android Doze can strand it) believed `readyState === OPEN`
 * and serialized frames into a black hole forever. An unanswered ping older
 * than this window means the socket is a zombie: kill it and let the ladder
 * re-dial.
 */
const PONG_TIMEOUT_MS = 10_000;

/**
 * Minimum spacing between `syncplay_playback_sync` state reports (SPEC §4/
 * §9.1 "periodic, all members"; review mobile__asphp C3). 2 s matches the
 * estate cadence the library client keeps — fast enough to feed the S291
 * host re-anchor and the S446 drift policy, slow enough to never be the 1 s
 * chatter the battery audit (Info 20) warns against.
 */
const POSITION_REPORT_INTERVAL_MS = 2000;

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
    //
    // LW-099-d (review syncplay__crossfe #10, ruling 2026-11-06): the PLUS
    // one-way term is the ESTATE WIRE LAW, not a porting slip — this line
    // byte-matches the server's own compute (phlix-server
    // src/Session/SyncPlay/TimeSync.php:153
    // `$offset = $serverTime - $clientSendTime + (int)$oneWayLatency;`) and
    // phlix-syncplay SPEC §5. Textbook NTP's local-lead convention
    // (t2 − t1 − rtt/2) would DISAGREE with the server on the sign of the
    // latency correction; every estate port (this class, @phlix/syncplay's
    // TimeSync, the web client) copies the + law. If the estate ever flips
    // the convention, it flips as one lockstep wire change — never here
    // alone. Correct-to-law; recorded, behavior untouched.
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
  /**
   * The canonical SPEC §4 union from @phlix/syncplay — `playing | paused |
   * buffering | stopped` (messages.d.ts:64). MW-011 (review mobile__crossfe):
   * this field used to be a 3-member local twin that silently erased the
   * library's `buffering` state to `stopped` on every group frame.
   */
  playbackState: PlaybackState;
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
  /**
   * MW-118: this frame is the server's DIRECTED out-of-sync nudge
   * (`syncplay_playback_sync` + the additive `nudge` object — phlix-server
   * SyncPlayManager::sendOutOfSyncNudge :1593-1630). It tells the consumer
   * to apply `position` unconditionally, bypassing the group-echo tolerance
   * window (`syncReanchorTargetSeconds`). Absent on every other frame,
   * including all hub-relay traffic (the relay lane never carries a nudge).
   */
  forceReanchor?: boolean;
};

/**
 * MW-125 (review mobile__crossfe #2): one entry of the host's playback
 * queue, parsed at the wire boundary from `syncplay_playback_queue`
 * (phlix-server Messages::playbackQueue, src/Session/SyncPlay/Messages.php:500
 * — `queue[].media_id` with a `media_info` projection the server normalizes
 * to an object; the broadcaster chooses its contents, so a missing `name` is
 * a normal wire shape, not a defect — consumers fall back to the id).
 */
export interface SyncPlayQueueEntry {
  mediaId: string;
  name: string | null;
}

/**
 * MW-125: a chat line from `syncplay_chat`
 * (phlix-server Messages::chatMessage (src/Session/SyncPlay/Messages.php) — {member_id, message}).
 * Decoded here so the UI never touches raw wire keys.
 */
export interface SyncPlayChatMessage {
  memberId: string;
  message: string;
}

type WsMessage = {
  /** A SyncPlay wire message type (one of @phlix/syncplay's 19), or any other
   * string the server may emit; unknown types are named in a console warning
   * by routeMessage — a silent drop is how MW-125 went unnoticed (the phone
   * had been ignoring the server's queue/chat broadcasts for its whole life). */
  type: SyncPlayMessageType | string;
  [key: string]: unknown;
};

/** Parse a wire field into a usable string at the boundary; anything else
 * (number, object, missing) becomes undefined so `??` chains fall through. */
function wireString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Parse a wire field into a finite number at the boundary (strings, objects,
 * NaN/Infinity become undefined — the same parse-not-cast doctrine). */
function wireNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * MW-118: is this frame marked as a directed S446 nudge? The server stamps
 * `nudge` as a non-null OBJECT (drift_ms/direction/suggested_rate/... —
 * SyncPlayManager::sendOutOfSyncNudge :1615-1622); anything else (string,
 * number, null, array) is costume data on a plain group echo and degrades to
 * absent. Parse-not-cast, mirroring the library's `normalizeNudge`
 * (@phlix/syncplay src/client.ts:1259-1280) — mobile keeps only the BOOLEAN
 * verdict because the native bridge exposes no rate command (S407 refusal);
 * the authoritative position the same frame carries IS the mobile answer.
 */
function wireNudgePresent(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Boundary composition for the decode sites: parse a wire `server_time` with
 * `wireNumber` (non-numeric stays undefined so the consumer's `?? fallback`
 * keeps deciding — the M-SYNCPLAY-19 law), then normalize the unit via
 * `serverTimeToMs`. The unit law itself (mixed carriers, 1e12 threshold, v0.1.7
 * retirement, pong/advisory scope) lives in ./wireUnits next to its siblings.
 * handleTimePong deliberately does NOT use this — it reads `wireNumber` raw.
 */
function wireServerTimeMs(value: unknown): number | undefined {
  const raw = wireNumber(value);
  return raw === undefined ? undefined : serverTimeToMs(raw);
}

/**
 * Narrow an untrusted `playback_state` into the typed union at the boundary.
 *
 * A rogue/compromised server (or MITM on an `http://` lane) can send ANY value
 * here; the old `as` cast let a number/object/garbage string flow into the
 * typed `SyncPlayGroup['playbackState']`, which downstream consumers compare
 * against 'playing'/'paused' to drive the native player and the outbound
 * `is_playing` flag. Anything not in the whitelist falls back to 'stopped'
 * (review M-MOBILE-26/54).
 *
 * MW-011 (review mobile__crossfe): the whitelist IS the library union —
 * typing the array `readonly PlaybackState[]` pins the parity from BOTH
 * sides at build time: forgetting a member here is a jest red in
 * wireUnits.test.ts, and any new member the library grows is a `tsc` red on
 * this literal plus on the exhaustive `Record` the test carries. `buffering`
 * is a REAL server-sent state (SPEC §4) and was collapsing to `stopped`.
 */
const PLAYBACK_STATES: readonly PlaybackState[] = [
  'playing',
  'paused',
  'buffering',
  'stopped',
];
export function wirePlaybackState(value: unknown): PlaybackState {
  return (PLAYBACK_STATES as readonly unknown[]).includes(value)
    ? (value as PlaybackState)
    : 'stopped';
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface SyncPlayServiceEvents {
  onConnectionStateChange: (state: ConnectionState) => void;
  onGroupStateUpdate: (group: SyncPlayGroup) => void;
  onPlaybackCommand: (cmd: PlaybackCommand) => void;
  onMemberJoined: (member: SyncPlayMember) => void;
  /**
   * MW-101: the departure carries the LAST KNOWN display name — the store
   * has already been replaced with the new snapshot when this fires, so a
   * consumer reading the roster would only find "the id that vanished".
   * The name comes from the previous snapshot's roster (wire default
   * 'Unknown' when the frame never carried one).
   */
  onMemberLeft: (memberId: string, memberName: string) => void;
  onHostChanged: (newHostId: string) => void;
  /**
   * MW-125 (review mobile__crossfe #2): the host's queue snapshot, replaced
   * wholesale on every `syncplay_playback_queue` frame (the wire carries the
   * full list, not a delta — an empty array means the queue is empty).
   */
  onQueueUpdate: (entries: SyncPlayQueueEntry[]) => void;
  /**
   * MW-125: one decoded chat line. Membership resolution (which roster member
   * sent it) belongs to the consumer — this lane only guarantees the
   * {memberId, message} pair parsed from the wire.
   */
  onChatMessage: (chat: SyncPlayChatMessage) => void;
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
  /**
   * Last group_state roster (id → name) — the basis of join/left diffs.
   * MW-101: it carries names precisely so the left-event can say WHO.
   */
  private lastRoster = new Map<string, string>();
  private reconnectAttempts = 0;
  /**
   * Cached GROUP GATE digest for the room we intend to be in (review
   * mobile__asphp C1 / exploiter M11): the wire credential for `group_join`
   * is the SHA-256 hex digest (SPEC §4), which the server accepts replayably
   * (SPEC §8.2 — the gate is a weak presence-check by design, the REST
   * boundary is where plaintext is demanded). A reconnect used to send a bare
   * join into a gated room → invalid_password → the member was silently
   * dropped from their own watch party. Keyed by groupId so a stale digest
   * can never ride into a different room; cleared on leave/disconnect.
   */
  private groupGate: { groupId: string; digest: string } | null = null;
  /** True while handleOpen's auto-rejoin arm waits for the group_state that
   * confirms it (cleared by handleGroupState / disconnect / leaveGroup). */
  private awaitingAutoRejoin = false;
  /** When we last sent a position report (C3 throttle basis). */
  private lastPositionReportAt = 0;
  /** When the outstanding `time_ping` was sent; null = no ping awaiting a
   * pong. Basis of the zombie-socket watchdog (M10). */
  private pongPendingAt: number | null = null;

  /**
   * Connect to the SyncPlay WebSocket endpoint.
   * The endpoint (direct `:8097` or hub relay `:8804`, both with the bearer
   * subprotocol carrier) is resolved by `wsEndpoint.ts` from the hub store
   * state. Both lanes speak the canonical `syncplay_*` catalog (relay: since
   * phlix-hub cc1e128, owner decision #14).
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
   *
   * `gateDigest` (review mobile__asphp C1): the SHA-256 hex of the room gate
   * the caller already proved knowledge of over REST. The WS `group_join`
   * frame after socket-open needs it too for gated rooms — without it the
   * join is refused and the viewer sits in a room the server says they never
   * entered. Held process-locally (never persisted), keyed to `roomId`.
   */
  connectWithRoom(roomId: string, sessionId: string, gateDigest?: string): void {
    this.memberId = sessionId;
    this.pendingJoinRoomId = roomId;
    this.groupGate = gateDigest !== undefined && gateDigest !== '' ? { groupId: roomId, digest: gateDigest } : null;
    this.awaitingAutoRejoin = false;
    this.reconnectAttempts = 0;
    this.startConnection();
  }

  /**
   * Cache the group gate digest supplied in plaintext by a caller that just
   * proved it (create-with-gate / join-by-id-with-gate). Empty gate clears
   * any stale cache.
   */
  rememberGroupGate(groupId: string, password: string | undefined): void {
    if (password === undefined || password === '') {
      if (this.groupGate?.groupId === groupId) {
        this.groupGate = null;
      }
      return;
    }
    this.groupGate = { groupId, digest: hashGroupPassword(password) };
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
    this.lastRoster.clear();
    this.pendingJoinRoomId = null;
    this.reconnectAttempts = 0;
    this.groupGate = null;
    this.awaitingAutoRejoin = false;
    this.pongPendingAt = null;
    this.lastPositionReportAt = 0;
    useSyncplayStore.getState().reset();
  }

  /**
   * Register event handlers.
   */
  on<K extends keyof SyncPlayServiceEvents>(event: K, handler: SyncPlayServiceEvents[K]): void {
    this.events[event] = handler;
  }

  /**
   * Remove an event handler (review mobile__asphp C4). With a handler
   * argument the removal is identity-guarded: a screen unmounting while a
   * newer screen already owns the slot must not silently unregister the
   * successor's handler (React double-invocation / re-mount races). Without
   * an argument the slot is cleared unconditionally — the documented
   * "remove whatever is there" behaviour callers rely on.
   */
  off<K extends keyof SyncPlayServiceEvents>(
    event: K,
    handler?: SyncPlayServiceEvents[K]
  ): void {
    if (handler === undefined || this.events[event] === handler) {
      delete this.events[event];
    }
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
      const digest = hashGroupPassword(password);
      payload.password_hash = digest;
      // A group you just created over WS is the group you will rejoin on
      // every reconnect — cache the gate UNBOUND (the server has not named
      // the group yet; handleGroupState binds it on the first snapshot) so
      // the replay arm never sends a bare join into a gated room (C1).
      this.groupGate = { groupId: '', digest };
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
    // the tripwire lives in hashGroupPassword). A caller that supplies the
    // plaintext proves knowledge and refreshes the cache; a caller that
    // supplies nothing (the reconnect arms) rides the cached digest when it
    // belongs to THIS group — the C1 cure for "auto-rejoin drops you from a
    // gated room".
    if (password !== undefined && password !== '') {
      const fresh = hashGroupPassword(password);
      payload.password_hash = fresh;
      this.groupGate = { groupId, digest: fresh };
    } else if (this.groupGate?.groupId === groupId) {
      payload.password_hash = this.groupGate.digest;
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
    this.lastRoster.clear();
    this.stopSyncInterval();
    // Leaving is a decision to not come back — the cached gate dies with the
    // membership so a later auto-rejoin can't sneak back in (C1) and nothing
    // keeps the digest in memory once the user is out (M11 hygiene). Cleared
    // unconditionally: the store id is '' until the first group_state, and
    // "I am leaving this room" outranks any key-matching cleverness.
    this.groupGate = null;
    this.awaitingAutoRejoin = false;
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
   * Feed the periodic member position report (review mobile__asphp C3):
   * PlayerScreen's progress callback is the ONLY place the phone knows where
   * its video is, and until now that knowledge never reached the group —
   * `reportPosition` had zero callers, so this member's drift was invisible
   * to the host re-anchor (S291) and the S446 drift policy.
   *
   * Throttle: at most one frame per POSITION_REPORT_INTERVAL_MS, and only
   * when the position actually moved (a paused viewer sends nothing). `ms`
   * is the WIRE-milliseconds position (callers convert once, S293 law).
   */
  noteLocalPosition(positionMs: number): void {
    if (this.connectionState !== 'connected' || this.ws === null) {
      return;
    }
    if (!useSyncplayStore.getState().currentGroup) {
      return;
    }
    const now = Date.now();
    if (now - this.lastPositionReportAt < POSITION_REPORT_INTERVAL_MS) {
      return;
    }
    this.lastPositionReportAt = now;
    this.reportPosition(positionMs);
  }

  /**
   * App went to background (review mobile__asphp M10 — iOS jetsams a socket
   * mid-stream and Android Doze can strand one silently): stop all timers and
   * close the socket on OUR terms instead of letting the OS do it at an
   * unpredictable moment. Membership intent (group, gate, member id) is kept
   * — the foreground arm re-dials.
   *
   * MW-010 (review mobile__exploiter #4): the close is paired with a
   * connectionGeneration bump. Backgrounding while openSocket still awaits
   * resolveSyncPlayWsEndpoint used to let that pending leg pass its generation
   * re-check and construct a WebSocket (with its 30s ping interval) WHILE
   * backgrounded — violating the law stated above. The bump supersedes every
   * in-flight dial: a leg that resolves after it sees a stale generation and
   * drops on the floor. The foreground arm re-dials with a fresh generation.
   */
  handleAppBackground(): void {
    if (this.connectionState === 'disconnected' && this.ws === null && this.reconnectTimeout === null) {
      return; // nothing running — stay inert
    }
    this.connectionGeneration++;
    this.stopReconnect();
    this.stopSyncInterval();
    this.pongPendingAt = null;
    this.closeSocketQuietly();
    this.setConnectionState('disconnected');
  }

  /**
   * App returned to the foreground: if the viewer still intends to be in a
   * group (store says so, or a gate cache/join is pending) and nothing is
   * already dialing, restart the FAST ladder from attempt 0 — a background
   * gap is not the socket's fault.
   */
  handleAppForeground(): void {
    if (this.ws !== null || this.reconnectTimeout !== null) {
      return; // already connected or already re-dialing
    }
    const intendsGroup =
      this.memberId !== '' &&
      (useSyncplayStore.getState().currentGroup !== null || this.pendingJoinRoomId !== null);
    if (!intendsGroup) {
      return;
    }
    this.reconnectAttempts = 0;
    this.startConnection();
  }

  /**
   * Request time synchronization with the server.
   */
  requestTimeSync(): void {
    const t1 = Date.now();

    // The pong is routed back through handleMessage → handleTimePong, which adds
    // the completed sample and fires onTimeSyncUpdate. We only send the ping here.
    // Stamping the pending moment arms the zombie-socket watchdog (M10): if no
    // pong answers within PONG_TIMEOUT_MS, the socket is declared dead even
    // though its readyState still says OPEN.
    this.send({
      type: MSG.TIME_PING,
      protocol_version: PROTOCOL_VERSION,
      client_time: t1,
      timestamp: t1,
    });
    this.pongPendingAt = t1;
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

    let endpoint: SyncPlayWsEndpoint | null = null;
    let hostPinError: SyncPlayHostPinError | null = null;
    try {
      endpoint = await resolveSyncPlayWsEndpoint({
        connectionMode,
        effectiveServerUrl,
        hubUrl,
        activeServerId,
        getHubAccessToken: () => useHubStore.getState().session?.accessToken ?? null,
      });
    } catch (error) {
      if (error instanceof SyncPlayHostPinError) {
        hostPinError = error;
      }
      console.error('SyncPlay: endpoint resolution failed', error);
    }
    if (generation !== this.connectionGeneration) {
      return; // superseded by disconnect()/a newer connect()
    }
    if (hostPinError) {
      // The minted-host pin blocked a credential ride (review
      // mobile__exploiter M2). That is not a quiet "nothing to dial" — the
      // viewer is told, through the SAME onError → Alert rail every other
      // SyncPlay failure uses (estate fail-loud law: no silent drops), and
      // the socket is never constructed.
      this.events.onError?.(hostPinError.refusalCode, hostPinError.message);
      this.setConnectionState('error');
      return;
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

  /**
   * The display name this member broadcasts on the join/create frames.
   *
   * MW-012 (review mobile__crossfe): was a hardcoded 'Mobile User', leaving
   * the phone anonymous in every shared roster while other clients show
   * profile names. Now reads the signed-in user — profile display name,
   * then username — and reserves the 'Mobile User' fallback for the
   * signed-out state.
   *
   * The auth store statically imports THIS module (signOut → disconnect),
   * so the reverse edge is resolved lazily at call time; a module-scope
   * import would create a load cycle (PlayerScreen.tsx:91 lazy-require
   * precedent). The `getState?.()` guard mirrors the hermetic-suite idiom
   * authStore.ts:232 itself uses against mocked stores.
   */
  private getMemberName(): string {
    const { useAuthStore } = require('../stores/useAuthStore') as
      typeof import('../stores/useAuthStore');
    const user = useAuthStore?.getState?.().user ?? null;
    const displayName = user?.display_name?.trim();
    if (displayName) {
      return displayName;
    }
    const username = user?.username?.trim();
    if (username) {
      return username;
    }
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
    // M9 (review mobile__asphp): mirror the liveness rail into the store so
    // every screen — not just event subscribers — reads an honest
    // connected/connecting flag. The event keeps its own subscribers.
    const store = useSyncplayStore.getState();
    store.setIsConnected(state === 'connected');
    store.setIsConnecting(state === 'connecting');
    this.events.onConnectionStateChange?.(state);
  }

  private startSyncInterval(): void {
    this.stopSyncInterval();
    this.requestTimeSync();
    this.syncInterval = setInterval(() => {
      if (this.connectionState !== 'connected') {
        return;
      }
      // M10: a ping with no pong inside the window means the socket is a
      // zombie (silent peer death keeps readyState OPEN on both RN engines).
      // Declare it dead and let the ladder re-dial instead of serializing
      // frames into a black hole.
      if (this.pongPendingAt !== null && Date.now() - this.pongPendingAt > PONG_TIMEOUT_MS) {
        this.killZombieSocket();
        return;
      }
      this.requestTimeSync();
    }, SYNC_INTERVAL_MS);
  }

  /**
   * Force-close a socket the watchdog proved deaf: detach its handlers first
   * (the close event must not double-drive the state machine through the old
   * wiring), then run the standard closed-connection path so the reconnect
   * ladder, interval stop and store mirrors behave exactly as on a real drop.
   */
  private killZombieSocket(): void {
    console.warn('SyncPlay: time_ping unanswered — treating the socket as dead and re-dialing');
    this.pongPendingAt = null;
    const socket = this.ws;
    this.ws = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close();
      } catch {
        // A dead socket refusing close() changes nothing: we have already
        // unbound it from this state machine.
      }
    }
    this.handleClose(this.connectionGeneration);
  }

  private stopSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Capped exponential backoff with equal jitter (mirrors the hubRelay.ts
   * ladder, ceiling at RECONNECT_MAX_DELAY_MS). The previous fixed 5s uncapped
   * retry hammered the listener forever behind an outage (audit M5); the
   * previous capped version then DEAD-ENDED at 5 attempts, which strands a
   * phone that burned the budget during one commute (review mobile__asphp
   * M2/exploiter Info — hub Federation 229d3d1 shape): after the budget the
   * state reads 'error' for the UI, but a low-frequency PARK re-arm keeps
   * probing and restarts the fast ladder when a dial finally lands.
   */
  private scheduleReconnect(): void {
    this.stopReconnect();
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn(
        `SyncPlay: fast reconnect budget (${MAX_RECONNECT_ATTEMPTS} attempts) spent — parking at one retry per ${RECONNECT_PARK_DELAY_MS / 1000}s`
      );
      this.setConnectionState('error');
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        this.reconnectAttempts = 0;
        this.openSocket(this.connectionGeneration);
      }, RECONNECT_PARK_DELAY_MS);
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
    this.pongPendingAt = null;
    // SPEC §10.1 (audit M5): every established connection — first or
    // auto-reconnect — starts in a fresh clock domain. Old offsets measured
    // against a dead process must not skew the new one.
    this.timeSync.reset();
    this.startSyncInterval();

    if (this.pendingJoinRoomId !== null) {
      const roomId = this.pendingJoinRoomId;
      this.pendingJoinRoomId = null;
      this.awaitingAutoRejoin = false;
      this.joinGroup(roomId);
      return;
    }

    // Re-join group if we had one. `joinGroup` replays the cached gate digest
    // (C1) — and `awaitingAutoRejoin` lets the error arm tell "the room moved
    // on without us" apart from a mid-session command failure: an
    // invalid_password here means membership is gone, and the UI must say so
    // instead of rendering a group we are no longer part of.
    const { currentGroup } = useSyncplayStore.getState();
    if (currentGroup) {
      this.awaitingAutoRejoin = true;
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
    this.lastRoster.clear();
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
    // M-MOBILE-28: admission is size-capped BEFORE the parse — JSON.parse is
    // the resource the cap protects (drop-loud; the socket keeps running).
    const text = String(event.data);
    if (text.length > MAX_INBOUND_FRAME_BYTES) {
      console.error(
        `SyncPlay: dropping oversize frame (${text.length} chars > ${MAX_INBOUND_FRAME_BYTES} cap)`
      );
      return;
    }
    let msg: WsMessage;
    try {
      msg = JSON.parse(text) as WsMessage;
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

      case MSG.PLAYBACK_QUEUE:
        this.handlePlaybackQueue(msg);
        break;

      case MSG.CHAT:
        this.handleChatMessage(msg);
        break;

      case MSG.TYPING:
        // MW-125: refused BY NAME, not by silence. The typing indicator is a
        // per-keystroke frame with no mobile surface (the phone shows no
        // composer state), so there is nothing to render — but the refusal is
        // a documented decision, and the server's broadcast genuinely
        // reaches us here. Adding a chat composer later means handling this
        // arm, tripping the reader's eye, not spelunking a dropped frame.
        break;

      default:
        // MW-125: the silent `break` that swallowed the queue/chat rails for
        // the client's whole life. A frame we cannot route is a gap in this
        // file — name it so the gap is loud in the console and the next
        // register audit finds a statement, not an absence.
        console.warn(`SyncPlay: frame type '${String(msg.type)}' has no mobile handler — dropped`);
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
      playbackState: wirePlaybackState(groupData.playback_state),
      // S441 — the snapshot anchor arrives in WIRE ms; the group (and every
      // consumer below it) speaks SECONDS.
      // M-MOBILE-27: floored at the decode like the command handlers.
      playbackPosition: Math.max(0, wireMsToSeconds(wireNumber(groupData.playback_position)) ?? 0),
      hostId,
      hasPassword: groupData.has_password === true,
    };

    // A WS-created group learns its server-assigned id only here; bind the
    // unbound gate cache so reconnects can replay it (createGroup, C1).
    if (this.groupGate !== null && this.groupGate.groupId === '' && group.id !== '') {
      this.groupGate = { groupId: group.id, digest: this.groupGate.digest };
    }
    // The snapshot is the proof the (auto-)join succeeded — the error arm
    // stops treating failures as "membership lost" from here (C1).
    this.awaitingAutoRejoin = false;

    useSyncplayStore.getState().setCurrentGroup(group);
    useSyncplayStore.getState().setIsHost(you !== '' && you === group.hostId);

    // SPEC §6: a member is gone when a snapshot simply lacks them — emit the
    // left events from the diff (this replaces the prose `message.includes`
    // sniff that never matched the server's actual INFO wording pattern).
    const currentIds = new Set(members.map((m) => m.id));
    for (const [memberId, memberName] of this.lastRoster) {
      if (!currentIds.has(memberId)) {
        this.events.onMemberLeft?.(memberId, memberName);
      }
    }
    this.lastRoster = new Map(members.map((m) => [m.id, m.name]));

    this.events.onGroupStateUpdate?.(group);
  }

  private handlePlaybackPlay(msg: WsMessage): void {
    // S441 — the frame carries MILLISECONDS; the store and the event speak SECONDS.
    // M-MOBILE-27: floored at the decode — a negative position is malformed,
    // never a time machine (upper bounds belong to the consumer that knows
    // the duration: PlayerScreen's clamped seek arm).
    const position = Math.max(0, wireMsToSeconds(wireNumber(msg.position)) ?? 0);
    const serverTime = wireServerTimeMs(msg.server_time) ?? this.getSynchronizedTime();

    useSyncplayStore.getState().updatePlaybackState('playing', position);
    this.events.onPlaybackCommand?.({ type: 'play', position, serverTime });
  }

  private handlePlaybackPause(msg: WsMessage): void {
    // S441 — the frame carries MILLISECONDS; the store and the event speak SECONDS.
    // M-MOBILE-27: floored at the decode (see handlePlaybackPlay).
    const position = Math.max(0, wireMsToSeconds(wireNumber(msg.position)) ?? 0);
    const serverTime = wireServerTimeMs(msg.server_time) ?? this.getSynchronizedTime();

    useSyncplayStore.getState().updatePlaybackState('paused', position);
    this.events.onPlaybackCommand?.({ type: 'pause', position, serverTime });
  }

  private handlePlaybackSeek(msg: WsMessage): void {
    // S441 — `to_position` arrives in MILLISECONDS; store + event get SECONDS.
    // M-MOBILE-27: floored at the decode (see handlePlaybackPlay).
    const toPosition = Math.max(0, wireMsToSeconds(wireNumber(msg.to_position)) ?? 0);
    const serverTime = wireServerTimeMs(msg.server_time) ?? this.getSynchronizedTime();

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
   *
   * MW-118: the same family also carries the server's DIRECTED out-of-sync
   * nudge (SyncPlayManager::sendOutOfSyncNudge, phlix-server
   * src/Session/SyncPlay/SyncPlayManager.php:1593-1630) — an additive
   * `nudge` object aimed at exactly this member. The web client answers it
   * with `suggested_rate`; the mobile native bridge exposes no rate command
   * (the S407 refusal), so the mobile answer is the authoritative position
   * this same frame already carries: mark the command `forceReanchor` and
   * let the consumer apply it past the group-echo tolerance window. A
   * `nudge` that is not a non-null object degrades to absent (plain echo
   * shape) — see wireNudgePresent.
   */
  private handlePlaybackSync(msg: WsMessage): void {
    // M-MOBILE-27: floored at the decode (see handlePlaybackPlay).
    const position = Math.max(0, wireMsToSeconds(wireNumber(msg.position)) ?? 0);
    const isPlaying = msg.is_playing === true;
    const serverTime = wireServerTimeMs(msg.server_time) ?? this.getSynchronizedTime();

    useSyncplayStore.getState().updatePlaybackState(
      isPlaying ? 'playing' : 'paused',
      position
    );
    const command: PlaybackCommand = {
      type: isPlaying ? 'play' : 'pause',
      position,
      serverTime,
    };
    if (wireNudgePresent(msg.nudge)) {
      command.forceReanchor = true;
    }
    this.events.onPlaybackCommand?.(command);
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
   * MW-125 (review mobile__crossfe #2): `syncplay_playback_queue` carries the
   * FULL queue (phlix-server Messages::playbackQueue,
   * src/Session/SyncPlay/Messages.php:500 — an array
   * of {media_id, media_info}, the projection's `name` optional); the wire
   * sends snapshots, never deltas, so
   * the store rail is replaced wholesale. A frame whose `queue` is not an
   * array is dropped whole and loudly — half-parsing a corrupted snapshot
   * would show members a queue the host never had.
   */
  private handlePlaybackQueue(msg: WsMessage): void {
    const raw = msg.queue;
    if (!Array.isArray(raw)) {
      console.error('SyncPlay: syncplay_playback_queue frame carries a non-array `queue` — dropped whole');
      return;
    }
    const entries: SyncPlayQueueEntry[] = [];
    for (const item of raw as readonly unknown[]) {
      // An entry without a media_id cannot be resolved or played — it is not
      // a queue line, whatever the host's DB held when the frame was built.
      if (typeof item !== 'object' || item === null) {
        continue;
      }
      const record = item as { media_id?: unknown; media_info?: unknown };
      const mediaId = wireString(record.media_id);
      if (mediaId === undefined) {
        continue;
      }
      const info = record.media_info;
      const name =
        typeof info === 'object' && info !== null
          ? wireString((info as { name?: unknown }).name) ?? null
          : null;
      entries.push({ mediaId, name });
    }
    useSyncplayStore.getState().setPlaybackQueue(entries);
    this.events.onQueueUpdate?.(entries);
  }

  /**
   * MW-125: `syncplay_chat` (phlix-server Messages::chatMessage,
   * src/Session/SyncPlay/Messages.php:562)
   * carries {member_id, message}. Both parts are required for a renderable
   * line — a frame missing either drops loudly rather than showing an
   * anonymous orphan or an ownerless blob.
   */
  private handleChatMessage(msg: WsMessage): void {
    const memberId = wireString(msg.member_id);
    const message = wireString(msg.message);
    if (memberId === undefined || message === undefined) {
      console.error('SyncPlay: syncplay_chat frame without a usable member_id/message pair — dropped');
      return;
    }
    this.events.onChatMessage?.({ memberId, message });
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

    // C1 tail: if the refused moment is the auto-rejoin, the room no longer
    // accepts our (possibly expired) membership — wipe the group so the UI
    // stops presenting a watch party we are not in, and drop the gate cache
    // so we cannot hammer a dead key. The onError emit below still alerts.
    if (code === 'syncplay.invalid_password' && this.awaitingAutoRejoin) {
      this.awaitingAutoRejoin = false;
      this.groupGate = null;
      const store = useSyncplayStore.getState();
      if (store.currentGroup) {
        store.setCurrentGroup(null);
        store.setIsHost(false);
      }
    }

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
    this.pongPendingAt = null;

    const status = {
      offset: this.timeSync.getOffset(),
      latency: this.timeSync.getLatency(),
      isStable: this.timeSync.isStable(),
    };

    // M9 (review mobile__asphp): the store's time-sync fields were write-
    // never — the modal's "Time sync: …" row read a constant. The pong is
    // the only honest source, so mirror it into the store here (and the
    // event rail keeps serving live subscribers).
    useSyncplayStore.getState().setTimeSyncStatus(status);

    this.events.onTimeSyncUpdate?.(status);
  }
}

export const syncPlayService = new SyncPlayService();
export default syncPlayService;
