/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/screens/wmin61UiPins.test.ts
//
// Source-level pins for the W-min61 UI cures (house idiom: the sibling
// keyboardAndSkeleton.test.ts reads screen sources for exactly this class
// of law — an affordance's presence is a string property of the render).

import * as fs from 'fs';
import * as path from 'path';

const read = (rel: string): string =>
  fs.readFileSync(path.resolve(__dirname, '../../..', rel), 'utf8');

describe('M-MOBILE-41 — destructive long-press is discoverable', () => {
  it('WatchHistory states the hold-to-remove gesture where items render', () => {
    const source = read('src/screens/WatchHistoryScreen.tsx');
    expect(source).toMatch(/Press and hold an item to remove it/);
    expect(source).toMatch(/onLongPress/);
  });

  it('Collections states the hold-to-delete gesture under its header', () => {
    const source = read('src/screens/CollectionsScreen.tsx');
    expect(source).toMatch(/Press and hold a collection to delete/);
    expect(source).toMatch(/onLongPress/);
  });
});

describe('M-MOBILE-48 — detail-page IA untangles', () => {
  const source = read('src/screens/MediaDetailScreen.tsx');

  it('the poster tap is wired to a real action (no empty-press no-op)', () => {
    // The exact dead prop combo `onPress={() => {}}` must not return for
    // the poster. (The conditional playable-else-noop form is explicit,
    // commented, and only for NON-playable types.)
    expect(source).not.toMatch(/<PosterCard[^>]*onPress=\{\(\) => \{\}\}/s);
    expect(source).toMatch(/isPlayableType\(item\.type\)[\s\S]{0,120}handleResume[\s\S]{0,40}handlePlay/);
  });

  it('Resume keeps a start-over path that says so', () => {
    expect(source).toMatch(/onLongPress=\{hasResumePosition \? handlePlay : undefined\}/);
    expect(source).toMatch(/Press and hold to start from the beginning/);
  });

  it('exactly one rating UI renders on the detail page', () => {
    // UserRatingPicker removed from this screen AND from the tree (its file
    // joined the zero-call-site deletion list); the inline row remains.
    expect(source).not.toMatch(/<UserRatingPicker/);
    expect(source).toMatch(/handleStarPress/);
    expect(fs.existsSync(path.resolve(__dirname, '../../..', 'src/components/UserRatingPicker.tsx'))).toBe(false);
  });

  it('a queued download tap answers instead of silently no-oping', () => {
    expect(source).toMatch(/Already in the queue/);
  });
});

describe('M-MOBILE-48 — Login footer stops asserting an unwritten contract', () => {
  it('no dead "Terms of Service" claim survives', () => {
    const source = read('src/screens/LoginScreen.tsx');
    expect(source).not.toMatch(/agree to our Terms of Service/);
    expect(source).toMatch(/its access terms are set/);
  });
});

describe('M-MOBILE-27 — the clamped seek boundary', () => {
  it('PlayerScreen seeks through clampSeekSeconds, not raw cmd.position', () => {
    const source = read('src/screens/PlayerScreen.tsx');
    expect(source).toMatch(/clampSeekSeconds\(cmd\.position, durationRef\.current\)/);
    expect(source).not.toMatch(/dispatchPlayerCommand\(playerRef, 'seekTo', \[cmd\.position\]\)/);
  });
});

describe('M-MOBILE-54/26 — group playbackState narrows at the parser', () => {
  it('handleGroupState routes playback_state through wirePlaybackState', () => {
    const source = read('src/syncplay/SyncPlayService.ts');
    expect(source).toMatch(/playbackState: wirePlaybackState\(groupData\.playback_state\)/);
    // The unchecked double-cast the finding named must not return; the
    // whitelisted cast INSIDE wirePlaybackState (:301, after the includes
    // check) is the checked kind and stays.
    expect(source).not.toMatch(/groupData\.playback_state as string/);
  });
});

// ── Review mobile__gameux M4 + asphp C1 — the gated join is joinable ───────
// A private room's whole point is a shared Room ID; until this lane the Join
// tab had NO password field and neither connectWithRoom leg carried the
// SPEC §4 gate digest — gated rooms were silently unjoinable from mobile and
// auto-reconnects dropped members. Source-level pins (house idiom) keep the
// affordance and both digest legs from regressing away.
describe('M4/C1 — SyncPlayModal gated-join surface', () => {
  const source = read('src/components/syncplay/SyncPlayModal.tsx');

  it('the Join tab carries a password field', () => {
    expect(source).toMatch(/value=\{joinPassword\}/);
    expect(source).toMatch(/secureTextEntry/);
  });

  it('join-by-id forwards the password into the REST join', () => {
    expect(source).toMatch(/handleJoinRoom\(joinRoomId\.trim\(\), joinPassword/);
  });

  it('BOTH connect legs carry the SPEC §4 gate digest to the socket', () => {
    // join: proven plaintext → hashed carrier
    expect(source).toMatch(/hashGroupPassword\(roomPassword\)/);
    // create-with-gate: same carrier for the post-open WS join
    expect(source).toMatch(/hashGroupPassword\(password\)/);
  });
});
