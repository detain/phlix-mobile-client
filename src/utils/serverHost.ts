/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/serverHost.ts
/**
 * THE host-identity parser. One function, imported by every site that has
 * to answer "which machine is this URL about?" — so the two halves of the
 * SyncPlay minted-host pin (vault write at token issuance, dial check in
 * `syncplay/wsEndpoint.ts`) cannot drift into disagreeing parsers. A drift
 * would fail CLOSED (a refusal, not a ride), but a refusal nobody can
 * reproduce is its own defect class.
 *
 * The anchor is the HOSTNAME only: no scheme, no port, no path, lower-cased.
 * The port is deliberately excluded — the direct SyncPlay lane legitimately
 * port-hops from the API port to the `:8097` listener, and an IP/DNS name is
 * the machine identity either way. Bare `host:port` and scheme-less `host`
 * inputs fall to the regex lane (a scheme-less `host:8096` string would
 * otherwise parse as a `host:` SCHEME under WHATWG URL rules and yield an
 * empty hostname); bracketed IPv6 keeps its brackets in both lanes, so
 * write-side and read-side forms stay comparable.
 */

/** Hostname (no port, lower-case) of an http(s) or bare `host[:port]` URL. */
export function hostOf(baseUrl: string): string {
  const trimmed = baseUrl.trim().toLowerCase();
  if (/^https?:\/\//.test(trimmed)) {
    try {
      return new URL(trimmed).hostname;
    } catch {
      // Malformed absolute URL — fall through to the regex lane.
    }
  }
  return trimmed.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
}
