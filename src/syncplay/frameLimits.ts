/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */

// src/syncplay/frameLimits.ts
//
// M-MOBILE-28 (review mobile__exploiter m3): both inbound JSON lanes
// (`SyncPlayService.handleMessage` on the :8097 socket, `hubRelay` on the
// :8804 relay) fed `JSON.parse` with whatever arrived — no size question
// asked. A host or hub that misbehaves (or is merely compromised) can stream
// megabyte frames and make every client burn parse CPU and memory before the
// first field is ever inspected. The cap is a CEILING on admission, not a
// protocol statement: legitimate SyncPlay frames are small (a group state
// with members is kilobytes), so one megabyte carries an honest margin
// while refusing the pathological.
//
// Law: check the RAW TEXT length BEFORE parsing (a parsed oversize object is
// the cost we are refusing to pay), and drop LOUD — logged, socket stays
// open; closing on one bad frame would let a single corrupt byte evict every
// member.

/** Maximum accepted size, in characters, of one inbound text frame. */
export const MAX_INBOUND_FRAME_BYTES = 1_000_000;
