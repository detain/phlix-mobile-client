/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/syncplay/wsEndpoint.ts
/**
 * The single place that turns "where do we think the SyncPlay socket is" into
 * a concrete WebSocket endpoint — the H1/M7 wire-law fix.
 *
 * Two lanes exist and they are NOT interchangeable:
 *
 * - **Direct** — the server's dedicated SyncPlay WebSocket listener on
 *   `:8097` (`phlix-server/config/server.php`, `WebSocketServer`). Its
 *   handshake (`onWebSocketConnect` → `SyncPlayAuthMiddleware`) reads the JWT
 *   from the `?token=` QUERY parameter and rejects the upgrade pre-101 without
 *   it; the HTTP API port has no WS upgrade at all, so the old
 *   `{apiHost}/api/v1/syncplay/ws` build never reached a listener. The worker
 *   does not inspect the path — only host, port, and token matter — but the
 *   documented path is kept for readability. Query-carrier is CURRENT :8097
 *   law; the bearer-subprotocol is the HUB relay's law (below), not this one.
 * - **Relay** — the hub's `:8804/syncplay/{server_id}` relay
 *   (`SyncPlayRelayWorker`, S237): the token travels in the
 *   `Sec-WebSocket-Protocol: bearer, <token>` subprotocol and query-string
 *   tokens are refused BY DESIGN. `hubRelay.buildHubRelayUrl` is reused here
 *   rather than re-derived, so the URL law lives in exactly one module.
 *
 * Port: `PHLIX_SYNCPLAY_WS_PORT` (react-native-config env, same mechanism as
 * `PHLIX_BASE_URL`) overrides the `8097` default for deployments that remap
 * the listener.
 */

import Config from 'react-native-config';
import { buildHubRelayUrl } from './hubRelay';
import { createHubRelayTokenProvider } from '../hub/RelayTokenProvider';
import { secureStorage } from '../services/SecureStorage';

/** Server SyncPlay WS listener default port (config/server.php 'syncplay' => 'port'). */
export const SYNCPLAY_WS_DEFAULT_PORT = 8097;

/** A resolved WebSocket connect target: URL plus optional subprotocol offer. */
export interface SyncPlayWsEndpoint {
  url: string;
  /** `Sec-WebSocket-Protocol` values for the upgrade (relay lane only). */
  protocols?: string[];
}

/** The hub-store slice the endpoint resolver needs (injectable for tests). */
export interface SyncPlayWsSource {
  connectionMode: 'direct' | 'relay';
  /** Direct-mode server root, e.g. `https://192.168.1.100:32400`. */
  effectiveServerUrl: string;
  /** Hub origin (relay mode), e.g. `https://hub.example.com`. */
  hubUrl: string | null;
  /** Active hub server id (relay mode — the `/syncplay/{server_id}` path). */
  activeServerId: string | null;
  /**
   * LIVE reader for the current hub session JWT (authorizes the relay-token
   * mint). A callback, not a snapshot: providers cache across reconnects and
   * the session token rotates on refresh — a frozen value would eventually
   * mint against an expired JWT.
   */
  getHubAccessToken: () => string | null;
}

/**
 * The SyncPlay WS port: `PHLIX_SYNCPLAY_WS_PORT` when it parses as a valid
 * TCP port, otherwise the server default 8097. A malformed env value must not
 * produce a nonsense endpoint — it falls back (the build should not crash over
 * a typo, and the socket failing closed on a wrong port is worse than the
 * documented default).
 */
export function syncPlayWsPort(): number {
  const raw = (Config as { PHLIX_SYNCPLAY_WS_PORT?: string | number } | undefined)
    ?.PHLIX_SYNCPLAY_WS_PORT;
  const port = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;
  if (Number.isInteger(port) && port > 0 && port <= 65535) {
    return port;
  }
  return SYNCPLAY_WS_DEFAULT_PORT;
}

/** `https:`/`http:` → `wss:`/`ws:` (anything non-https maps to plain ws). */
export function wsScheme(baseUrl: string): 'ws' | 'wss' {
  return baseUrl.startsWith('https') ? 'wss' : 'ws';
}

/** Hostname (no port) of an http(s) base URL; URL global first, regex fallback. */
function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return baseUrl.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  }
}

/**
 * Direct-mode URL: `ws(s)://{host}:{syncplayPort}/api/v1/syncplay/ws?token=<JWT>`.
 *
 * The token is URI-encoded (JWTs are base64url + dots, so this is a no-op in
 * practice, but an endpoint builder must not assume its credential is
 * URL-safe). Exported for tests.
 */
export function buildDirectSyncPlayWsUrl(
  serverRoot: string,
  token: string,
  port: number = syncPlayWsPort()
): string {
  const scheme = wsScheme(serverRoot);
  return `${scheme}://${hostOf(serverRoot)}:${port}/api/v1/syncplay/ws?token=${encodeURIComponent(token)}`;
}

// One relay-token provider per (hub, server) — the provider caches the minted
// token and re-mints before expiry, exactly as the pending-command consumer
// does. Re-creating it per connect would throw away the cache every
// reconnect-attempt boundary.
const relayTokenProviders = new Map<string, () => Promise<string | null>>();

/**
 * Resolve the SyncPlay WS endpoint for the current connection mode.
 *
 * Returns `null` when the lane is not usable (no server root, no stored
 * server JWT, no hub session, or a relay token that will not mint) — callers
 * must treat null as "do not open the socket", never as "open without a
 * credential": both listeners reject unauthenticated upgrades, and a tokenless
 * attempt only burns a reconnect slot.
 */
export async function resolveSyncPlayWsEndpoint(source: SyncPlayWsSource): Promise<SyncPlayWsEndpoint | null> {
  if (source.connectionMode === 'relay') {
    const { hubUrl, activeServerId } = source;
    if (!hubUrl || !activeServerId) {
      return null;
    }
    if (!source.getHubAccessToken()) {
      return null; // signed out of the hub — the mint would only fail
    }
    const providerKey = `${hubUrl}|${activeServerId}`;
    let provider = relayTokenProviders.get(providerKey);
    if (!provider) {
      provider = createHubRelayTokenProvider({
        hubUrl,
        getAccessToken: source.getHubAccessToken,
        serverId: activeServerId,
      });
      relayTokenProviders.set(providerKey, provider);
    }
    const relayToken = await provider();
    if (!relayToken) {
      return null;
    }
    // S237 law: bearer subprotocol carrier, never a query token.
    return {
      url: buildHubRelayUrl(hubUrl, activeServerId),
      protocols: ['bearer', relayToken],
    };
  }

  if (!source.effectiveServerUrl) {
    return null;
  }
  const serverJwt = await secureStorage.getAccessToken();
  if (!serverJwt) {
    return null;
  }
  return { url: buildDirectSyncPlayWsUrl(source.effectiveServerUrl, serverJwt) };
}

/** Test seam: drop the cached relay-token providers (module-level cache). */
export function __resetRelayTokenProvidersForTests(): void {
  relayTokenProviders.clear();
}
