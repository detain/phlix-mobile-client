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
 *   `:8097` (`phlix-server/config/server.php`, `WebSocketServer`). The
 *   handshake (`onWebSocketConnect` → `SyncPlayAuthMiddleware`) rejects the
 *   upgrade pre-101 without a JWT; the HTTP API port has no WS upgrade at
 *   all, so the old `{apiHost}/api/v1/syncplay/ws` build never reached a
 *   listener. The worker does not inspect the path — only host, port, and
 *   credential matter — but the documented path is kept for readability.
 *   Carrier law (phlix-server 424c14d0, `docs/dev/WEBSOCKET_AUTH_CARRIERS.md`
 *   + `SyncPlayAuthMiddleware::resolveHandshakeToken()`): the server is in
 *   TRANSITIONAL DUAL-CARRIER state — priority 1 is the
 *   `Sec-WebSocket-Protocol: bearer, <jwt>` subprotocol (TARGET), priority 2
 *   the legacy `?token=` query (RETIRING). This client ships the TARGET: the
 *   token travels as the second `WebSocket` constructor value, NEVER in the
 *   URL (estate policy WEBSOCKET_URL_QUERY_REFUSED — keeping credentials off
 *   URLs also keeps them out of access/proxy logs and handshake diagnostics).
 *   The server echoes the `bearer` marker on the 101 (S355-style gate), so
 *   strict WHATWG-style clients complete the handshake. In-repo proof that
 *   RN's global WebSocket honours the 2-arg constructor: `hubRelay.ts:256`
 *   dials `:8804` with `['bearer', token]` against the real hub today.
 * - **Relay** — the hub's `:8804/syncplay/{server_id}` relay
 *   (`SyncPlayRelayWorker`, S237): the token travels in the
 *   `Sec-WebSocket-Protocol: bearer, <token>` subprotocol and query-string
 *   tokens are refused BY DESIGN. `hubRelay.buildHubRelayUrl` is reused here
 *   rather than re-derived, so the URL law lives in exactly one module.
 *   STATUS (owner decision #14, phlix-hub cc1e128): the lane is LIVE. The hub
 *   relay now speaks the canonical `syncplay_*` catalog — it latches a
 *   connection's dialect on its first `syncplay_*` frame and answers in kind —
 *   so relay mode dials for real and this builder is the sole URL authority.
 *
 * Port: `PHLIX_SYNCPLAY_WS_PORT` (react-native-config env, same mechanism as
 * `PHLIX_BASE_URL`) overrides the `8097` default for deployments that remap
 * the listener.
 *
 * Identity pin (review mobile__exploiter M2): in DIRECT mode the dial target
 * `effectiveServerUrl` comes from the HUB's server list — a discovery trust
 * domain — while the bearer credential is the vault's SERVER JWT, minted by
 * whatever host the user actually authenticated to. The resolver therefore
 * refuses to hand that JWT to any host except the one recorded beside the
 * tokens at issuance (a mismatch or an unpinned pre-vault session throws a
 * typed `SyncPlayHostPinError` the service surfaces to the viewer — never a
 * silent fallback, never a downgrade). The hub-suggested host reaching a
 * socket at all is only ever through the RELAY lane, which presents a
 * hub-minted relay token to the hub itself: the server JWT stays home.
 */

import Config from 'react-native-config';
import { buildHubRelayUrl } from './hubRelay';
import { createHubRelayTokenProvider } from '../hub/RelayTokenProvider';
import { secureStorage } from '../services/SecureStorage';
import { hostOf, isHttpsBase } from '../utils/serverHost';
import { useConnectionSecurityStore } from '../stores/useConnectionSecurityStore';
import {
  SYNCPLAY_HOST_MISMATCH_CODE,
  SYNCPLAY_HOST_MISMATCH_MESSAGE,
  SYNCPLAY_HOST_UNPINNED_CODE,
  SYNCPLAY_HOST_UNPINNED_MESSAGE,
} from './syncplayErrors';

/** Server SyncPlay WS listener default port (config/server.php 'syncplay' => 'port'). */
export const SYNCPLAY_WS_DEFAULT_PORT = 8097;

/** A resolved WebSocket connect target: URL plus optional subprotocol offer. */
export interface SyncPlayWsEndpoint {
  url: string;
  /**
   * Second `WebSocket` constructor value — the `Sec-WebSocket-Protocol` offer
   * for the upgrade. BOTH lanes carry their credential here (`['bearer',
   * <jwt>]`): direct per phlix-server 424c14d0 dual-carrier TARGET law, relay
   * per hub S237. Absent only if a lane ever dials unauthenticated, which the
   * resolvers refuse.
   */
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

/**
 * `https://` → `wss`, everything else → `ws` (M-MOBILE-50: the predicate is
 * the shared STRICT `isHttpsBase` — a malformed look-alike like
 * `httpsfoo://x` is NOT TLS and must not be dialed as if it were).
 */
export function wsScheme(baseUrl: string): 'ws' | 'wss' {
  return isHttpsBase(baseUrl) ? 'wss' : 'ws';
}

/**
 * Direct-mode LOCATION: `ws(s)://{host}:{syncplayPort}/api/v1/syncplay/ws`.
 *
 * Deliberately carries NO credential. Since phlix-server 424c14d0 the `:8097`
 * handshake takes the JWT in the `bearer, <jwt>` subprotocol (priority-1
 * TARGET carrier of the transitional dual-carrier law; `?token=` is the
 * RETIRING legacy lane — see `docs/dev/WEBSOCKET_AUTH_CARRIERS.md` and
 * `SyncPlayAuthMiddleware::resolveHandshakeToken()`). The client ships the
 * target: this builder owns host/port/path, `resolveSyncPlayWsEndpoint`
 * attaches `protocols: ['bearer', <jwt>]`, and the estate policy
 * WEBSOCKET_URL_QUERY_REFUSED is satisfied — a credential never reaches a
 * URL, hence never a log line upstream of the app. Exported for tests.
 */
export function buildDirectSyncPlayWsUrl(
  serverRoot: string,
  port: number = syncPlayWsPort()
): string {
  const scheme = wsScheme(serverRoot);
  return `${scheme}://${hostOf(serverRoot)}:${port}/api/v1/syncplay/ws`;
}

// One relay-token provider per (hub, server) — the provider caches the minted
// token and re-mints before expiry, exactly as the pending-command consumer
// does. Re-creating it per connect would throw away the cache every
// reconnect-attempt boundary.
const relayTokenProviders = new Map<string, () => Promise<string | null>>();

/**
 * A TYPED refusal from the direct lane's minted-host pin: the vault's server
 * JWT may not be carried to `effectiveServerUrl`'s host. `refusalCode` is a
 * client-local stable code (never a wire value — the contracts registry owns
 * those) and `message` is the catalog sentence from `syncplayErrors.ts`, safe
 * to show the viewer. Throwing rather than returning null is deliberate: a
 * null means "nothing to dial, stay quiet"; this is "someone tried to ride
 * your credential somewhere — SAY SO" (estate fail-loud law).
 */
export class SyncPlayHostPinError extends Error {
  readonly refusalCode: string;

  constructor(refusalCode: string, message: string) {
    super(message);
    this.name = 'SyncPlayHostPinError';
    this.refusalCode = refusalCode;
  }
}

/**
 * Resolve the SyncPlay WS endpoint for the current connection mode.
 *
 * Returns `null` when the lane is not usable (no server root, no stored
 * server JWT, no hub session, or a relay token that will not mint) — callers
 * must treat null as "do not open the socket", never as "open without a
 * credential": both listeners reject unauthenticated upgrades, and a tokenless
 * attempt only burns a reconnect slot.
 *
 * THROWS `SyncPlayHostPinError` when the DIRECT lane's host pin refuses: the
 * hub-suggested host is not the host that minted the vault pair, or the pair
 * predates the pin and carries no recorded origin. That is not "nothing to
 * dial" — it is an attempted credential ride, and the service surfaces it.
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
    const relayUrl = buildHubRelayUrl(hubUrl, activeServerId);
    // M-MOBILE-51: the relay branch rides the same cleartext visibility law
    // as the direct return below.
    useConnectionSecurityStore.getState().mark('syncplayWs', relayUrl);
    return {
      url: relayUrl,
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

  // Minted-host pin (review mobile__exploiter M2). The direct bearer is the
  // vault's SERVER JWT — a credential that authenticates to exactly the host
  // that minted it. `effectiveServerUrl` is hub-supplied discovery data, so
  // the two must be shown to agree BEFORE the JWT is placed on the offer.
  const mintedHost = await secureStorage.getIssuedHost();
  if (mintedHost === null) {
    // A pre-pin migrated session: no recorded origin, so no host can be
    // proven safe. Fail closed; the viewer is asked to re-authenticate (which
    // mints a pinned pair). Never "dial anyway" over an unknown origin.
    throw new SyncPlayHostPinError(
      SYNCPLAY_HOST_UNPINNED_CODE,
      SYNCPLAY_HOST_UNPINNED_MESSAGE
    );
  }
  if (hostOf(source.effectiveServerUrl) !== mintedHost) {
    // The hub pointed at a different machine than the one the user signed in
    // to. Presenting the server JWT here is exactly the cross-domain ride the
    // review demonstrated — refuse loudly.
    throw new SyncPlayHostPinError(
      SYNCPLAY_HOST_MISMATCH_CODE,
      SYNCPLAY_HOST_MISMATCH_MESSAGE
    );
  }

  // Dual-carrier TARGET law (phlix-server 424c14d0): bearer subprotocol
  // carrier, never a query token — same offer shape the relay lane above and
  // hubRelay.ts:256 already ship.
  const url = buildDirectSyncPlayWsUrl(source.effectiveServerUrl);
  // M-MOBILE-51 (review mobile__secnet m3): the scheme here is purely
  // baseUrl-derived (m1/m2) — when it lands on plain `ws://`, the bearer JWT
  // is on-path readable, and the user deserves the visible signal. Reporting
  // seam only; the DIAL itself is untouched law.
  useConnectionSecurityStore.getState().mark('syncplayWs', url);
  return {
    url,
    protocols: ['bearer', serverJwt],
  };
}

/** Test seam: drop the cached relay-token providers (module-level cache). */
export function __resetRelayTokenProvidersForTests(): void {
  relayTokenProviders.clear();
}
