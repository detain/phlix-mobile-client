/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/syncplay/hubRelay.ts
/**
 * Hub relay pending-command consumer (S298, mobile half).
 *
 * The ONLY Phlix surface that can receive "Alexa, play X" is the hub's SyncPlay
 * relay WebSocket (`ws://<hub>:8804/syncplay/{server_id}`). Before S298 no
 * client connected there at all: every live socket pointed at the server's
 * `:8097`, spoke a different (`syncplay_`-prefixed) vocabulary, and carried its
 * token in the query string — which the relay refuses by design (S237). The hub
 * half (S93) therefore measured a delivered count of 0 and the Alexa skill spoke
 * its honest "no open app" answer.
 *
 * This module is the mobile consumer. It connects to the REAL relay with the
 * REAL handshake:
 *
 * - **URL** — `ws(s)://<hub-host>:8804/syncplay/<server_id>` (the path the
 *   relay's `onWebSocketConnect()` parses the server id from via
 *   `parseServerId`).
 * - **Token carrier** — the `Sec-WebSocket-Protocol: bearer, <token>`
 *   subprotocol. React Native's WebSocket supports BOTH the protocols array and
 *   custom headers; the subprotocol is chosen because it is the exact carrier
 *   the S298 ui consumer proved against the real hub (S355 echoes the token,
 *   so strict clients complete the handshake) and RN presents it natively.
 *   Query-string tokens are refused by design (S237) — this module never puts
 *   one there.
 * - **Vocabulary** — the relay's own JSON frames (`group_join`, `playback_*`,
 *   `room_state`, `pending_command`, …). ONLY `pending_command` /
 *   `play_media` is consumed here (S93's frame, dispatched by the hub's
 *   `PendingCommandDispatcher`); everything else is ignored. The frame is
 *   parsed at this boundary (parse-don't-validate): a typed command comes out,
 *   garbage yields `null` and is dropped.
 * - **Lifecycle** — the socket opens WHENEVER the app has hub auth, not inside
 *   a SyncPlay room join. The hub's `deliverToUser()` deliberately matches on
 *   (user, server) at connect time and does NOT require room membership — the
 *   primary case is a user with no room. Reconnects re-read the token every
 *   attempt because relay tokens expire (1h default); the ladder is capped and
 *   self-terminating.
 *
 * The module holds its connection in module-level state so the app boots it
 * once via `startHubRelayConsumer()` (see `HubRelayConsumer.ts`) and the store
 * reacts to delivered commands.
 */

/** The hub relay's SyncPlay WebSocket port (SyncPlayRelayWorker::DEFAULT_PORT). */
export const HUB_SYNC_PLAY_PORT = 8804;

/** Connection states surfaced via `onStatusChange`. */
export type HubRelayStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

/**
 * One delivered `pending_command` / `play_media` frame (S93's shape, emitted by
 * the hub's `PendingCommandDispatcher`). All fields are already coerced and
 * validated at the parse boundary; `issuedAt` is Unix seconds.
 */
export interface PendingPlayMediaCommand {
  type: 'pending_command';
  command: 'play_media';
  /** Hub server id the media id belongs to (the socket is bound to it). */
  serverId: string;
  /** Media item id to start playing. */
  mediaId: string;
  /** Human-readable title ("Alexa, play X" → X). */
  title: string;
  /** Unix seconds — when the hub dispatched the frame. */
  issuedAt: number;
  /** Frame origin, e.g. `alexa`. */
  source: string;
}

export interface HubRelayConfig {
  /** Server the hub relay socket is bound to (the `/syncplay/{server_id}` path
   *  AND the token's server scope). The media ids in delivered commands belong
   *  to this server. */
  serverId: string;
  /**
   * Returns the hub relay token to present on this (re)connect attempt.
   *
   * Re-read on EVERY attempt because relay tokens are short-lived (1h default);
   * a stale module-level token would fail validation the moment it expires.
   * May be async (the mobile token provider mints over HTTP). Returning `null`
   * keeps the socket closed.
   */
  tokenProvider: () => string | null | Promise<string | null>;
  /**
   * Hub base origin, e.g. `https://hub.example.com`. The relay listens on port
   * 8804 regardless of this origin's own port.
   */
  hubBaseUrl: string;
  /** Called once per delivered `pending_command` / `play_media` frame. */
  onPendingCommand: (command: PendingPlayMediaCommand) => void;
  /** Optional lifecycle visibility (e.g. a "connected to hub" indicator). */
  onStatusChange?: (status: HubRelayStatus) => void;
}

/** Maximum reconnect attempts before giving up (mirrors the SyncPlay socket). */
const MAX_RECONNECT_ATTEMPTS = 5;

/** Base delay in ms for the exponential backoff ladder. */
const RECONNECT_BASE_DELAY_MS = 1000;

/**
 * Coerce one raw relay frame into a typed play-media command.
 *
 * The parse boundary: the hub's `PendingCommandDispatcher` emits
 * `{type:'pending_command', command:'play_media', server_id, media_id, title,
 * issued_at, source}` — this validates that shape and coerces numbers at the
 * edge; anything else (unknown frame types, malformed bodies) returns `null`
 * and is dropped. Exported for tests and for consumers that want to parse a
 * frame without opening a socket.
 */
export function parsePendingCommandFrame(raw: unknown): PendingPlayMediaCommand | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const frame = raw as Record<string, unknown>;
  if (frame.type !== 'pending_command' || frame.command !== 'play_media') {
    return null;
  }
  if (typeof frame.server_id !== 'string' || frame.server_id === '') {
    return null;
  }
  if (typeof frame.media_id !== 'string' || frame.media_id === '') {
    return null;
  }
  if (typeof frame.title !== 'string' || frame.title === '') {
    return null;
  }
  const issuedAt =
    typeof frame.issued_at === 'number' && Number.isFinite(frame.issued_at)
      ? frame.issued_at
      : Math.floor(Date.now() / 1000);
  return {
    type: 'pending_command',
    command: 'play_media',
    serverId: frame.server_id,
    mediaId: frame.media_id,
    title: frame.title,
    issuedAt,
    source: typeof frame.source === 'string' ? frame.source : 'unknown',
  };
}

/**
 * Build the relay URL: `ws(s)://<host>:8804/syncplay/<server_id>`.
 *
 * The scheme follows `hubBaseUrl` (`https:` → `wss:`); the port is the relay's
 * own 8804, never the origin's. The host comes from the `URL` global (typed in
 * RN's globals, IPv6-correct); a malformed base falls back to the raw
 * authority string rather than throwing. Exported for tests.
 */
export function buildHubRelayUrl(hubBaseUrl: string, serverId: string): string {
  const scheme = hubBaseUrl.startsWith('https://') ? 'wss:' : 'ws:';
  let host: string;
  try {
    host = new URL(hubBaseUrl).hostname;
  } catch {
    host = hubBaseUrl.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  }
  return `${scheme}//${host}:${HUB_SYNC_PLAY_PORT}/syncplay/${encodeURIComponent(serverId)}`;
}

// ── module-level connection state (mirrors src/syncplay/SyncPlayService.ts) ──

let hubWs: WebSocket | null = null;
let hubConfig: HubRelayConfig | null = null;
let hubReconnectAttempts = 0;
let hubReconnectTimer: ReturnType<typeof setTimeout> | null = null;

function setStatus(status: HubRelayStatus): void {
  hubConfig?.onStatusChange?.(status);
}

/**
 * Open the hub relay socket (or return the open one).
 *
 * The "open-whenever" lifecycle: this is NOT gated on a SyncPlay room join —
 * the hub delivers `pending_command` to an authenticated (user, server) socket
 * regardless of room membership, and the primary "Alexa, play X" case has no
 * room at all. Call once when hub auth is available (see `HubRelayConsumer`);
 * the socket stays open with a capped reconnect ladder until
 * {@link closeHubRelayConnection}.
 *
 * If the token provider yields nothing, the socket stays closed (`closed`
 * status) and no reconnect ladder is armed — the caller re-invokes after the
 * token becomes available.
 */
export function openHubRelayConnection(config: HubRelayConfig): void {
  if (hubWs && hubConfig?.serverId === config.serverId) {
    return;
  }
  // A DIFFERENT server id means the app re-pointed at another server (the hub
  // store's active server switch). The old socket is bound to the old server
  // and its onmessage closure reads the module-level hubConfig — leaving it
  // open would deliver the new config's frames to the old socket and leak it.
  if (hubWs) {
    hubWs.onclose = null;
    hubWs.close();
    hubWs = null;
  }
  hubConfig = config;
  if (hubReconnectTimer !== null) {
    clearTimeout(hubReconnectTimer);
    hubReconnectTimer = null;
  }
  // eslint-disable-next-line no-void -- fire-and-forget; the connect owns its errors
  void connectHubRelaySocket();
}

/**
 * Connect (or reconnect) the hub relay socket with the current token.
 *
 * Deliberately NOT the caller-initiated entry point — the reconnect timer must
 * not reset the backoff budget it is computed from (S283 lesson, same module
 * pattern as `connectSyncPlaySocket`).
 */
async function connectHubRelaySocket(): Promise<void> {
  if (!hubConfig) {
    return;
  }
  // Snapshot the config BEFORE the await: the token provider may mint over
  // HTTP, and while it runs the consumer may close (sign-out) or re-bind
  // (server switch) — the resumed code must not read a nulled/rebound global.
  const config = hubConfig;
  let token: string | null;
  try {
    const maybeToken = config.tokenProvider();
    // Sync fast-path: a provider that returns a plain token must not defer
    // the connect by a microtask (test determinism + no surprise gap).
    token = maybeToken instanceof Promise ? await maybeToken : maybeToken;
  } catch {
    token = null;
  }
  if (!token) {
    setStatus('closed');
    return;
  }
  if (hubConfig !== config) {
    return; // closed or re-bound while the token was being minted
  }
  const url = buildHubRelayUrl(config.hubBaseUrl, config.serverId);
  setStatus(hubReconnectAttempts > 0 ? 'reconnecting' : 'connecting');

  let socket: WebSocket;
  try {
    // The token travels in the `bearer, <token>` SUBPROTOCOL — the carrier the
    // S298 ui consumer proved against the real hub (S237: query-string refused
    // by design; S355 echoes the token so strict clients complete the
    // handshake). RN's WebSocket supports the protocols array natively.
    socket = new WebSocket(url, ['bearer', token]);
  } catch {
    scheduleHubReconnect();
    return;
  }
  hubWs = socket;

  socket.onopen = () => {
    hubReconnectAttempts = 0;
    setStatus('open');
  };

  socket.onmessage = (event) => {
    if (!hubConfig) {
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(event.data as string);
    } catch {
      return; // malformed frame — ignore
    }
    const command = parsePendingCommandFrame(raw);
    if (!command) {
      return;
    }
    try {
      hubConfig.onPendingCommand(command);
    } catch {
      // A throwing consumer must not kill the socket's message handler; the
      // hub keeps the connection either way.
    }
  };

  socket.onclose = () => {
    hubWs = null;
    scheduleHubReconnect();
  };

  socket.onerror = () => {
    // `onclose` follows `onerror` for a failed socket; the ladder lives there.
  };
}

function scheduleHubReconnect(): void {
  if (!hubConfig || hubWs !== null) {
    return;
  }
  if (hubReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    setStatus('closed');
    hubReconnectAttempts = 0;
    return;
  }
  const delay = RECONNECT_BASE_DELAY_MS * 2 ** hubReconnectAttempts;
  hubReconnectAttempts++;
  setStatus('reconnecting');
  hubReconnectTimer = setTimeout(() => {
    hubReconnectTimer = null;
    // eslint-disable-next-line no-void -- fire-and-forget; the connect owns its errors
    void connectHubRelaySocket();
  }, delay);
}

/**
 * Close the hub relay socket and stop the reconnect ladder.
 */
export function closeHubRelayConnection(): void {
  if (hubReconnectTimer !== null) {
    clearTimeout(hubReconnectTimer);
    hubReconnectTimer = null;
  }
  if (hubWs) {
    hubWs.onclose = null;
    hubWs.close();
    hubWs = null;
  }
  hubReconnectAttempts = 0;
  hubConfig = null;
  setStatus('closed');
}

/** The open socket, or null. Exported for tests / status UI. */
export function getHubRelaySocket(): WebSocket | null {
  return hubWs;
}