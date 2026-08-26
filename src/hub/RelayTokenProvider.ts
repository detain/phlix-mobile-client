/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/hub/RelayTokenProvider.ts
/**
 * Client relay token provider for the hub-relay pending-command consumer
 * (S298, mobile half).
 *
 * The hub's SyncPlay relay (`:8804`) authenticates a socket with a **client
 * relay token** — NOT the hub session JWT. Tokens are minted per (user, server)
 * via `POST /api/v1/me/servers/{id}/relay-token` (S2a, owner-gated) and expire
 * (default TTL 1h). The provider mints on demand, caches the plaintext with its
 * `expires_at`, and re-mints shortly before expiry — so a long-lived open
 * socket always re-presents a token that is still valid.
 *
 * Every failure returns `null` rather than throwing: the consumer treats a
 * missing token as "keep the socket closed" and the reconnect ladder re-reads
 * the provider on its next attempt. A token that failed to mint must never be
 * presented as a credential; `null` is the safe side of that line.
 */

interface MintResponse {
  token: string;
  expires_at: number;
}

interface RelayTokenProviderOptions {
  /** Hub base origin, e.g. `https://hub.example.com` (no trailing slash). */
  hubUrl: string;
  /** Returns the hub session access JWT to authorize the mint (or null). */
  getAccessToken: () => string | null;
  /** The server the token must be scoped to. */
  serverId: string;
  /** Fetch implementation (injectable for tests; defaults to global fetch). */
  fetchImpl?: typeof fetch;
  /** Clock for the expiry decision (injectable for tests). */
  now?: () => number;
}

/**
 * Create a cached relay-token provider for one (user, server).
 *
 * The returned function is safe to call on EVERY reconnect attempt: it returns
 * the cached token while it is still fresh and only mints over HTTP when the
 * cache is empty or within {@link RE_MINT_LEAD_SECONDS} of expiry.
 */
export function createHubRelayTokenProvider(
  options: RelayTokenProviderOptions
): () => Promise<string | null> {
  const {
    hubUrl,
    getAccessToken,
    serverId,
    fetchImpl = fetch,
    now = () => Math.floor(Date.now() / 1000),
  } = options;

  let cachedToken: string | null = null;
  let cachedExpiresAt = 0;

  return async (): Promise<string | null> => {
    const nowSec = now();

    // The session check comes BEFORE the cache: a signed-out user must not
    // keep presenting a relay token minted under the old hub session. Sign-out
    // (getAccessToken → null) clears the cache immediately.
    const accessToken = getAccessToken();
    if (!accessToken) {
      cachedToken = null;
      cachedExpiresAt = 0;
      return null;
    }

    if (cachedToken !== null && nowSec < cachedExpiresAt - RE_MINT_LEAD_SECONDS) {
      return cachedToken;
    }

    try {
      const response = await fetchImpl(`${hubUrl}/api/v1/me/servers/${encodeURIComponent(serverId)}/relay-token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        cachedToken = null;
        cachedExpiresAt = 0;
        return null;
      }
      const body = (await response.json()) as MintResponse;
      if (typeof body.token !== 'string' || body.token === '') {
        cachedToken = null;
        cachedExpiresAt = 0;
        return null;
      }
      cachedToken = body.token;
      cachedExpiresAt = typeof body.expires_at === 'number' ? body.expires_at : nowSec + DEFAULT_TTL_SECONDS;
      return cachedToken;
    } catch {
      cachedToken = null;
      cachedExpiresAt = 0;
      return null;
    }
  };
}

/** Re-mint this many seconds before the cached token's `expires_at`. */
const RE_MINT_LEAD_SECONDS = 60;

/** Fallback lifetime when the mint response carries no `expires_at`. */
const DEFAULT_TTL_SECONDS = 3600;