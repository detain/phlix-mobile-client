/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/quarantineProse.ts
//
// M-MOBILE-34/52 doctrine, lifted out of `api/client.ts` so the SyncPlay WS
// lane (`syncplay/syncplayErrors.ts`) can share it without dragging the axios
// client, the vault and the settings store into its module graph. One
// sanitizer, one law: server-sourced prose is untrusted input — mask URLs,
// strip control/zero-width junk, collapse to one line, cap the length.
// `api/client.ts` re-exports `quarantineServerProse` from here; call sites
// and their pins keep working through either door.

/** Cap for server-sourced prose rendered in the UI — long enough for honest
 * sentences, short enough that walls of text can't impersonate the app. */
const QUARANTINE_MAX = 140;

/**
 * Render untrusted server prose safe for display: URLs masked, control and
 * zero-width characters dropped, whitespace collapsed to a single line, and
 * the whole thing capped. This is the fallback lane, not the primary one —
 * codes with catalog copy never come through here.
 */
export const quarantineServerProse = (raw: string): string => {
  const urlMasked = raw.replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[link]');
  // The sanitizer's whole job is removing control/zero-width characters, so
  // the `no-control-regex` rule describes the intent, not a defect.
  // eslint-disable-next-line no-control-regex
  const printable = urlMasked.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]+/g, ' ');
  const collapsed = printable.replace(/\s+/g, ' ').trim();
  return collapsed.length > QUARANTINE_MAX
    ? collapsed.slice(0, QUARANTINE_MAX - 1) + '…'
    : collapsed;
};

export default quarantineServerProse;
