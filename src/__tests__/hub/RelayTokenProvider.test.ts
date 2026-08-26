/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/hub/RelayTokenProvider.test.ts
/**
 * S298 — hub-relay pending-command consumer (mobile half): relay token mint +
 * cache (S2a surface).
 *
 * The `:8804` socket authenticates with a client relay token, NOT the hub
 * session JWT; the provider mints per (user, server) and caches until just
 * before `expires_at` so a long-lived socket re-presents a valid token on
 * every reconnect.
 */
import { createHubRelayTokenProvider } from '../../hub/RelayTokenProvider';

describe('createHubRelayTokenProvider', () => {
  const HUB_URL = 'http://127.0.0.1:8800';
  const SERVER_ID = 'srv-abc';
  const ACCESS_TOKEN = 'hub-session-jwt';

  const mintResponse = (over: Partial<{ token: string; expires_at: number }> = {}) => ({
    token: 'relay-token-1',
    expires_at: 2_000_000_000,
    ...over,
  });

  const makeFetch = (responses: unknown[]): { fetchImpl: typeof fetch; calls: Array<{ url: string; init?: RequestInit }> } => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = ((url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const next = responses.shift();
      if (next instanceof Error) {
        return Promise.reject(next);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(next),
      } as Response);
    }) as typeof fetch;
    return { fetchImpl, calls };
  };

  it('mints via POST /api/v1/me/servers/{id}/relay-token with the session JWT', async () => {
    let nowSec = 1_900_000_000;
    const { fetchImpl, calls } = makeFetch([mintResponse()]);
    const provider = createHubRelayTokenProvider({
      hubUrl: HUB_URL,
      serverId: SERVER_ID,
      getAccessToken: () => ACCESS_TOKEN,
      fetchImpl,
      now: () => nowSec,
    });

    const token = await provider();
    expect(token).toBe('relay-token-1');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('http://127.0.0.1:8800/api/v1/me/servers/srv-abc/relay-token');
    expect(calls[0]!.init?.method).toBe('POST');
    expect((calls[0]!.init?.headers as Record<string, string>)?.Authorization).toBe(
      'Bearer hub-session-jwt'
    );
  });

  it('serves the cached token without re-minting while fresh', async () => {
    let nowSec = 1_900_000_000;
    const { fetchImpl, calls } = makeFetch([mintResponse({ expires_at: 2_000_000_000 })]);
    const provider = createHubRelayTokenProvider({
      hubUrl: HUB_URL,
      serverId: SERVER_ID,
      getAccessToken: () => ACCESS_TOKEN,
      fetchImpl,
      now: () => nowSec,
    });

    await provider();
    nowSec = 1_990_000_000; // still 10s+ of lead time before expiry
    expect(await provider()).toBe('relay-token-1');
    expect(calls).toHaveLength(1);
  });

  it('re-mints when the cached token is within the re-mint lead of expiry', async () => {
    let nowSec = 1_900_000_000;
    const { fetchImpl, calls } = makeFetch([
      mintResponse({ token: 'relay-token-1', expires_at: 1_950_000_000 }),
      mintResponse({ token: 'relay-token-2', expires_at: 2_050_000_000 }),
    ]);
    const provider = createHubRelayTokenProvider({
      hubUrl: HUB_URL,
      serverId: SERVER_ID,
      getAccessToken: () => ACCESS_TOKEN,
      fetchImpl,
      now: () => nowSec,
    });

    expect(await provider()).toBe('relay-token-1');
    nowSec = 1_950_000_000 - 30; // 30s before expiry < 60s lead
    expect(await provider()).toBe('relay-token-2');
    expect(calls).toHaveLength(2);
  });

  it('re-mints after expiry', async () => {
    let nowSec = 1_900_000_000;
    const { fetchImpl, calls } = makeFetch([
      mintResponse({ token: 'relay-token-1', expires_at: 1_940_000_000 }),
      mintResponse({ token: 'relay-token-2', expires_at: 2_040_000_000 }),
    ]);
    const provider = createHubRelayTokenProvider({
      hubUrl: HUB_URL,
      serverId: SERVER_ID,
      getAccessToken: () => ACCESS_TOKEN,
      fetchImpl,
      now: () => nowSec,
    });

    await provider();
    nowSec = 1_950_000_000; // past expiry
    expect(await provider()).toBe('relay-token-2');
    expect(calls).toHaveLength(2);
  });

  it('returns null and clears the cache when there is no session access token', async () => {
    let hasAccess = true;
    const { fetchImpl, calls } = makeFetch([mintResponse()]);
    const provider = createHubRelayTokenProvider({
      hubUrl: HUB_URL,
      serverId: SERVER_ID,
      getAccessToken: () => (hasAccess ? ACCESS_TOKEN : null),
      fetchImpl,
      now: () => 1_900_000_000,
    });

    expect(await provider()).toBe('relay-token-1');
    hasAccess = false;
    expect(await provider()).toBeNull();
    // The stale cache was cleared — a later access re-mints rather than
    // re-serving the token minted under the old session.
    hasAccess = true;
    await provider();
    expect(calls).toHaveLength(2);
  });

  it('returns null on an HTTP failure without throwing', async () => {
    const fetchImpl = (() =>
      Promise.resolve({ ok: false, status: 403 } as Response)) as typeof fetch;
    const provider = createHubRelayTokenProvider({
      hubUrl: HUB_URL,
      serverId: SERVER_ID,
      getAccessToken: () => ACCESS_TOKEN,
      fetchImpl,
      now: () => 1_900_000_000,
    });

    await expect(provider()).resolves.toBeNull();
  });

  it('returns null when the mint response is malformed', async () => {
    const { fetchImpl } = makeFetch([{ token: '' }, { not_a_token: true }]);
    const provider = createHubRelayTokenProvider({
      hubUrl: HUB_URL,
      serverId: SERVER_ID,
      getAccessToken: () => ACCESS_TOKEN,
      fetchImpl,
      now: () => 1_900_000_000,
    });

    expect(await provider()).toBeNull();
    expect(await provider()).toBeNull();
  });

  it('returns null when the mint request throws (network failure)', async () => {
    const { fetchImpl } = makeFetch([new Error('network down')]);
    const provider = createHubRelayTokenProvider({
      hubUrl: HUB_URL,
      serverId: SERVER_ID,
      getAccessToken: () => ACCESS_TOKEN,
      fetchImpl,
      now: () => 1_900_000_000,
    });

    await expect(provider()).resolves.toBeNull();
  });

  it('falls back to a 1h lifetime when the response carries no expires_at', async () => {
    let nowSec = 1_900_000_000;
    const { fetchImpl, calls } = makeFetch([{ token: 'relay-token-1' }]);
    const provider = createHubRelayTokenProvider({
      hubUrl: HUB_URL,
      serverId: SERVER_ID,
      getAccessToken: () => ACCESS_TOKEN,
      fetchImpl,
      now: () => nowSec,
    });

    expect(await provider()).toBe('relay-token-1');
    nowSec = 1_900_000_000 + 3500; // just inside the 1h fallback
    expect(await provider()).toBe('relay-token-1');
    expect(calls).toHaveLength(1);
    nowSec = 1_900_000_000 + 3600; // past the fallback lifetime
    await provider();
    expect(calls).toHaveLength(2);
  });
});