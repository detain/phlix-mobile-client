/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/hub/HubAuthService.ts
import axios, { AxiosInstance } from 'axios';
import { useConnectionSecurityStore } from '../stores/useConnectionSecurityStore';

export interface HubSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  /**
   * MW-025 (review mobile__casualgamer #4): the hub's friendly identity —
   * `user.username`, falling back to `user.email` — captured at the sign-in
   * boundary so the UI never has to print the raw account UUID. `undefined`
   * when the hub's `user` row carries neither (nothing is invented).
   */
  displayName?: string;
}

export interface HubServer {
  /**
   * MW-022 (review mobile__exploiter #5): the hub answers
   * `GET /api/v1/me/servers` with `{servers: ServerInfoDto::toPayload()[]}` —
   * camelCase identity keys (phlix-hub ServerListController.php:46-61 at
   * 30012378; the payload body is vendor/detain/phlix-shared
   * src/Hub/ServerInfoDto.php:139-153). The address field on that wire is
   * `hostnameCandidates`: a list of FULL `scheme://host:port` URLs the media
   * server itself mints (phlix-server HubClient::getHostnameCandidates); the
   * hub's own best-direct law picks the FIRST non-empty one
   * (ServerManageController::bestDirectUrl), and {@link parseHubServer}
   * mirrors it here into `hostname`. There is no `relay_hostname` and no
   * `capabilities` on this wire — the fields the old snake_case mapping read
   * were fiction (against a real hub every one resolved `undefined`); the
   * relay lane's URL is built client-side from `serverId` by
   * `hubStore.resolveEffectiveUrl` (estate pin), never supplied by roster.
   */
  serverId: string;
  serverName: string;
  version: string;
  status: 'online' | 'offline';
  /** First usable hostnameCandidate URL; '' when the row carries none. */
  hostname: string;
}

interface SignInResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  /**
   * The hub's `createAuthResponse()` returns the identity as a nested
   * `user: { id, username, email, ... }` object — NOT a top-level `user_id`.
   * The old code destructured a `user_id` that was never on the wire, so
   * `HubSession.userId` was always `undefined` (audit M4) and SettingsScreen
   * rendered "Signed in as {undefined}". `user` is optional only for
   * type-safety against older hubs; {@link resolveUserId} fails loud when a
   * sign-in truly yields no identity.
   */
  user?: { id?: string } & Record<string, unknown>;
  claims?: { sub?: string } & Record<string, unknown>;
  /** Legacy spelling some early hub builds carried; read only as a fallback. */
  user_id?: string;
}

/** First candidate that is a usable non-empty string, else undefined (boundary read). */
function firstUsableString(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate !== '') {
      return candidate;
    }
  }
  return undefined;
}

/** `ServerInfoDto::toPayload()` row, before the boundary parse. */
type HubServerPayload = Record<string, unknown>;

/**
 * Fail-loud wire-string parse shared by every hub boundary (MW-022). A
 * missing/non-string/empty value is a CONTRACT violation at this seam —
 * the hub DTOs declare these fields as strings — so it halts with the
 * offending field named instead of letting `undefined` ride into the vault
 * or the roster (the exact poisoning class the review convicted).
 */
function requireWireString(value: unknown, fieldName: string, context: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`${context} carried no usable \`${fieldName}\``);
  }
  return value;
}

function requireFiniteNumber(value: unknown, fieldName: string, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${context} carried no usable \`${fieldName}\``);
  }
  return value;
}

/**
 * Parse one roster row from the hub's actual camelCase payload into a
 * trusted `HubServer` (identity fields fail loud; the two-state `status`
 * collapses every non-`online` hub convention — offline/claiming/disabled,
 * documented "conventions NOT gates" in ServerInfoDto — to `offline` rather
 * than lying about an unchecked cast; a missing/foreign-shaped candidate
 * list degrades to hostname `''`, which `resolveEffectiveUrl` already owns
 * as "no direct lane").
 */
function parseHubServer(row: unknown): HubServer {
  if (typeof row !== 'object' || row === null) {
    throw new Error('Hub server-list row is not an object — cannot parse a server from junk');
  }
  const record = row as HubServerPayload;
  const serverId = requireWireString(record.serverId, 'serverId', 'Hub server-list row');
  const rowContext = `Hub server-list row ${serverId}`;
  const candidates = Array.isArray(record.hostnameCandidates) ? record.hostnameCandidates : [];
  const firstCandidate = candidates.find(
    (candidate): candidate is string => typeof candidate === 'string' && candidate !== ''
  );
  return {
    serverId,
    serverName: requireWireString(record.serverName, 'serverName', rowContext),
    version: requireWireString(record.version, 'version', rowContext),
    status: record.status === 'online' ? 'online' : 'offline',
    hostname: firstCandidate ?? '',
  };
}

export class HubAuthService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Pull the caller's identity out of a hub auth response at the boundary.
   *
   * The current hub (`AuthController::loginJson`/`refreshJson` →
   * `createAuthResponse`) nests it as `user.id`; `claims.sub` (the JWT subject)
   * is the equivalent authority, and `user_id` is a legacy top-level spelling.
   * Parse in that order and fail loud when none is present: a session with no
   * id silently renders "Signed in as {undefined}" downstream (audit M4),
   * which is worse than an explicit error at sign-in.
   */
  private resolveUserId(data: SignInResponse): string {
    const userId =
      (typeof data.user?.id === 'string' && data.user.id !== '' ? data.user.id : undefined) ??
      (typeof data.claims?.sub === 'string' && data.claims.sub !== '' ? data.claims.sub : undefined) ??
      (typeof data.user_id === 'string' && data.user_id !== '' ? data.user_id : undefined);
    if (userId === undefined) {
      throw new Error('Hub sign-in response carried no user identity');
    }
    return userId;
  }

  /**
   * The friendly half of the identity (MW-025, review mobile__casualgamer #4):
   * `createAuthResponse` ships the full current-user row minus the password
   * hash, so `username`/`email` are on this wire — read them at the boundary
   * (username first) so Settings can stop printing the 36-char account UUID.
   * OPTIONAL by design: a hub row carrying neither yields `undefined`, and
   * the UI falls back to a plain label. `claims.sub` is deliberately NOT a
   * candidate — it is the same UUID as `user.id`, not a friendly name.
   */
  private resolveDisplayName(data: SignInResponse): string | undefined {
    return firstUsableString(data.user?.username, data.user?.email);
  }

  /**
   * Parse a hub auth envelope (`loginJson`/`refreshJson` →
   * `createAuthResponse`: `{access_token, refresh_token, token_type,
   * expires_in, user, claims}`) into the session the store persists.
   * MW-022 (review mobile__exploiter #6): every leg used to destructure
   * unchecked — a malformed 200 stored `accessToken: undefined` and the
   * device spent its life sending `Bearer undefined`. Same boundary law as
   * {@link resolveUserId}, extended to the tokens and the TTL.
   */
  private parseSession(data: SignInResponse, context: string): HubSession {
    const accessToken = requireWireString(data?.access_token, 'access_token', context);
    const refreshToken = requireWireString(data?.refresh_token, 'refresh_token', context);
    const expiresInSeconds = requireFiniteNumber(data?.expires_in, 'expires_in', context);

    return {
      accessToken,
      refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + expiresInSeconds,
      userId: this.resolveUserId(data),
      displayName: this.resolveDisplayName(data),
    };
  }

  /**
   * Sign in to the hub with username/password.
   * Returns a HubSession with access/refresh tokens.
   */
  async signIn(
    hubUrl: string,
    username: string,
    password: string
  ): Promise<HubSession> {
    const normalizedUrl = this.normalizeHubUrl(hubUrl);

    const response = await this.client.post<SignInResponse>(
      `${normalizedUrl}/api/v1/auth/login`,
      {
        username,
        password,
      }
    );

    return this.parseSession(response.data, 'Hub sign-in response');
  }

  /**
   * Refresh the hub JWT using the refresh token.
   */
  async refresh(hubUrl: string, refreshToken: string): Promise<HubSession> {
    const normalizedUrl = this.normalizeHubUrl(hubUrl);

    const response = await this.client.post<SignInResponse>(
      `${normalizedUrl}/api/v1/auth/refresh`,
      {
        refresh_token: refreshToken,
      }
    );

    return this.parseSession(response.data, 'Hub refresh response');
  }

  /**
   * Get the list of servers claimed by the user.
   *
   * The roster is HUB-PROVIDED data, so it is parsed here and nowhere
   * downstream: a body without a `servers` array, or a row whose identity
   * fields violate the DTO contract, fails loud at this boundary (MW-022)
   * instead of shipping `undefined` into the store, the vault, or a
   * `.map is not a function` TypeError.
   */
  async listServers(hubUrl: string, session: HubSession): Promise<HubServer[]> {
    const normalizedUrl = this.normalizeHubUrl(hubUrl);

    const response = await this.client.get<{ servers?: unknown }>(
      `${normalizedUrl}/api/v1/me/servers`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    const servers = response.data?.servers;
    if (!Array.isArray(servers)) {
      throw new Error('Hub server-list response carried no `servers` array');
    }

    return servers.map(parseHubServer);
  }

  /**
   * Sign out: best-effort HUB-SIDE revocation (review M-MOBILE-53d — this was
   * a literal no-op, so the spec's "invalidates the refresh token" promise was
   * theater; only local state was ever cleared). The hub's
   * `POST /api/v1/auth/logout` answers 204 and cuts the presented refresh
   * token's jti lineage; an access token is not required to call it.
   *
   * Every failure is swallowed on purpose: an offline device or an old hub
   * must never strand the caller signed-in locally — the vault wipe in
   * {@link hubStore.signOutOfHub} always proceeds.
   */
  async signOut(hubUrl: string, session: HubSession): Promise<void> {
    const normalizedUrl = this.normalizeHubUrl(hubUrl);
    try {
      await this.client.post(
        `${normalizedUrl}/api/v1/auth/logout`,
        { refresh_token: session.refreshToken },
        { headers: { Authorization: `Bearer ${session.accessToken}` } }
      );
    } catch {
      // Best-effort by design — see docblock.
    }
  }

  /**
   * Normalize hub URL - strip trailing slashes, ensure https.
   *
   * Review mobile__exploiter M6: scheme-less input defaults to https, but an
   * EXPLICIT `http://hub…` passed the gate and carried username/password
   * sign-in, refresh, /me/servers and relay-token mints in cleartext with
   * zero UI signal — the M-MOBILE-51 banner only listened to three lanes.
   * This resolver is the FOURTH seam ('hubApi'): every hub HTTP leg in the
   * repo passes through it, so it reports the resolved URL to the shared
   * cleartext ledger and the banner now fires for a WAN hub on http too.
   * (Posture unchanged — LAN http stays accepted-but-VISIBLE.)
   */
  private normalizeHubUrl(hubUrl: string): string {
    let url = hubUrl.replace(/\/+$/, '');
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      url = `https://${url}`;
    }
    useConnectionSecurityStore.getState().mark('hubApi', url);
    return url;
  }
}

export const hubAuthService = new HubAuthService();
export default hubAuthService;
