/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/serverLabel.ts
import { hostOf } from './serverHost';

/**
 * MOB-16: the host the app dials when no server address is saved (client.ts
 * tier 3 default). One constant shared by the login help copy and the
 * Settings server card so the two cannot drift.
 */
export const DEFAULT_SERVER_HOST = 'api.phlix.app';

/** Label for the Settings server card: the server's name, else its host. */
export function serverCardLabel(serverName: string, serverUrl: string): string {
  const name = serverName.trim();
  if (name) return name;
  return serverUrl ? hostOf(serverUrl) : DEFAULT_SERVER_HOST;
}

/**
 * MOB-14: Live TV row visibility from the admin settings bag. Hidden only
 * when the server states the flag explicitly false; unknown/absent keeps the
 * row (older servers carry no flag).
 *
 * MOB-S12: phlix-server's admin settings schema declares NO Live TV flag today
 * (verified: no livetv/live_tv enabled key in src/ or config/), so the row never
 * hides against a current server — it fails open, which is the safe direction.
 * The guessed alias list is narrowed to the one key that follows the settings
 * bag's snake_case convention; if the server ever publishes a different key,
 * change it here and in the test together.
 */
export function isLiveTvEnabled(settings: Record<string, unknown> | null | undefined): boolean {
  if (!settings) return true;
  const v = settings.livetv_enabled;
  return !(v === false || v === 0 || v === '0' || v === 'false');
}
