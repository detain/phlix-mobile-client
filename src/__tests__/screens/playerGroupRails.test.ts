/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/screens/playerGroupRails.test.ts
//
// MW-125 (review mobile__crossfe #2) — renderer-free source pins per the
// playerWatchParty/SeekBar.test doctrine.
//
// The screen's own autoplay guard says it out loud: "the SyncPlay group owns
// media selection, not this screen" (M-MOBILE-15). But when the GROUP changed
// what it was watching, nothing on the phone acted on it — handleGroupState
// decoded `current_media_id` into the store and emitted onGroupStateUpdate
// into a void: PlayerScreen subscribed only to the command/error/membership
// rails. The same switch silently evaporated the server's real
// `syncplay_playback_queue`/`syncplay_chat` fan-outs. These pins hold the
// three subscriptions the fix adds, on the rails each one belongs to.

import * as fs from 'fs';
import * as path from 'path';

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../..', rel), 'utf8');

describe('MW-125 — the player follows the group’s media', () => {
  const player = read('src/screens/PlayerScreen.tsx');

  test('onGroupStateUpdate is subscribed and un-registered by identity', () => {
    expect(player).toMatch(/on\('onGroupStateUpdate', handleGroupMediaChange\)/);
    expect(player).toMatch(/off\('onGroupStateUpdate', handleGroupMediaChange\)/);
  });

  test('a differing currentMediaId loads through the replace() seam — the same one autoplay-next uses', () => {
    // Same-in-file precedent: nav.replace('Player', {...}) so Back does not
    // stack one hop per media change.
    expect(player).toMatch(
      /replace\?\.\('Player', \{ itemId: group\.currentMediaId/
    );
    // Guard law: null (server omitted the field — room without media) and
    // "already there" must not re-navigate; only a genuine change follows.
    expect(player).toMatch(
      /group\.currentMediaId === null \|\| group\.currentMediaId === itemId/
    );
  });

  test('the follow carries the room position as the new title’s start anchor', () => {
    // S441: the store (and route param) speak SECONDS; the snapshot anchor is
    // already decoded at the service boundary — the pin is that a start
    // position is threaded, not that a unit conversion happens here.
    expect(player).toMatch(/startPosition: group\.playbackPosition/);
  });
});

describe('MW-125 — queue and chat reach a visible surface', () => {
  const player = read('src/screens/PlayerScreen.tsx');

  test('onQueueUpdate rides the overlay notice rail (toast-style, one line at a time)', () => {
    expect(player).toMatch(/on\('onQueueUpdate', handleQueueUpdate\)/);
    expect(player).toMatch(/off\('onQueueUpdate', handleQueueUpdate\)/);
    expect(player).toMatch(/showMembershipNotice\(/);
  });

  test('onChatMessage rides the same rail with the sender resolved from the roster', () => {
    expect(player).toMatch(/on\('onChatMessage', handleChatMessage\)/);
    expect(player).toMatch(/off\('onChatMessage', handleChatMessage\)/);
    // Sender naming comes from the store roster at event time — same law as
    // handleHostChanged (MW-101), not a fabricated label.
    expect(player).toMatch(
      /currentGroup\?\.members\.find\(\(m\) => m\.id === chat\.memberId\)/
    );
  });
});
