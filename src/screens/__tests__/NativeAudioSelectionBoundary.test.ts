/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/__tests__/NativeAudioSelectionBoundary.test.ts
//
// S407 NAMED-REFUSAL GATE (the honest half of the audio track picker).
//
// PlayerScreen's audio picker persists the viewer's choice to the store and
// states — visibly, via `AUDIO_TRACK_APPLY_UNSUPPORTED_NATIVE` — that APPLYING
// it is unsupported, because the native bridge exposes NO audio-selection
// surface. This test does not take that claim on faith: it reads the REAL view
// managers and pins the exact exported surface, so the refusal cannot silently
// rot in EITHER direction:
//   - if someone invents a phantom JS call (e.g. dispatching an 'setAudioTrack'
//     command), the command-set equality below still shows the native side
//     cannot receive it, and the audio test in PlayerScreen.test.tsx proves no
//     such call ships;
//   - if a REAL native audio API ever lands, the set equality goes RED here —
//     that is the tripwire to retire the refusal and wire the effect.
//
// Bridge evidence (re-verified at this commit):
//   - ios/LocalPods/PhlixPlayer/PhlixPlayerViewManager.m — 9 RCT props,
//     7 RCT commands; NO selectMediaOption/AVAudioMediaSelectionOption anywhere
//     in the pod (PhlixPlayerView.swift exports the same 7 @objc methods).
//   - android/app/src/main/java/com/phlixmobile/player/PhlixPlayerViewManager.kt
//     — @ReactProp set + receiveCommand handles ONLY the pinned names.

import { readFileSync } from 'fs';
import * as path from 'path';

const IOS_MANAGER = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'ios',
  'LocalPods',
  'PhlixPlayer',
  'PhlixPlayerViewManager.m',
);
const ANDROID_MANAGER = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'android',
  'app',
  'src',
  'main',
  'java',
  'com',
  'phlixmobile',
  'player',
  'PhlixPlayerViewManager.kt',
);
const ANDROID_VIEW = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'android',
  'app',
  'src',
  'main',
  'java',
  'com',
  'phlixmobile',
  'player',
  'PhlixPlayerView.kt',
);
const IOS_SWIFT_VIEW = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'ios',
  'LocalPods',
  'PhlixPlayer',
  'PhlixPlayerView.swift',
);

function read(source: string): string {
  try {
    return readFileSync(source, 'utf8');
  } catch {
    throw new Error(
      `S407 bridge pin cannot be measured: ${source} is missing — the refusal test would be vacuous. FAIL LOUD.`,
    );
  }
}

const collect = (src: string, re: RegExp): string[] => {
  const out: string[] = [];
  for (const m of src.matchAll(re)) {
    out.push(m[1]);
  }
  return out;
};

const sortedUnique = (xs: string[]): string[] => [...new Set(xs)].sort();

// A name is "audio-selection-ish" if it could plausibly switch the played
// audio track. `autoPlay` is a substring trap (`a-uto`) — match whole-ish
// tokens only: audio/audiotrack/mediaoption/switchaudio/selecttrack.
const AUDIO_SELECTION_RE = /audio|mediaoption|switchaudio|selecttrack|audiostream/i;

describe('S407 native bridge surface — the audio refusal is the TRUTH, not an excuse', () => {
  it('iOS exports EXACTLY the pinned props and commands — no audio-selection surface', () => {
    const src = read(IOS_MANAGER);

    expect(sortedUnique(collect(src, /RCT_EXPORT_VIEW_PROPERTY\((\w+)/g))).toEqual(
      [
        'autoPlay',
        'muted',
        'onError',
        'onPlaybackEvent',
        'onProgress',
        'src',
        'startPosition',
        'subtitleUrl',
        'volume',
      ].sort(),
    );
    expect(sortedUnique(collect(src, /RCT_EXTERN_METHOD\((\w+)/g))).toEqual(
      [
        'pause',
        'play',
        'seekTo',
        'startPiP',
        'stopPiP',
        'updateMuted',
        'updateVolume',
      ].sort(),
    );

    // No capture group on AUDIO_SELECTION_RE, so assert absence on the source
    // directly (`autoPlay`/`updateVolume` contain no `audio` substring).
    expect(src).not.toMatch(AUDIO_SELECTION_RE);
  });

  it('iOS Swift view exposes no media-selection API (selectMediaOption et al. are absent)', () => {
    const src = read(IOS_SWIFT_VIEW);
    expect(src).not.toMatch(/selectMediaOption|AVMediaSelectionGroup|AVAudioMediaSelectionOption/);
    expect(src).not.toMatch(AUDIO_SELECTION_RE);
  });

  it('Android @ReactProp set contains NO audio surface (subtitleUrl is the only track prop)', () => {
    const src = read(ANDROID_MANAGER);
    const props = sortedUnique(collect(src, /@ReactProp\(name = "(\w+)"/g));
    expect(props).toEqual(
      ['autoPlay', 'muted', 'src', 'startPosition', 'subtitleUrl', 'volume'].sort(),
    );
    expect(props.filter((p) => AUDIO_SELECTION_RE.test(p) && !/autoPlay/i.test(p))).toEqual([]);
  });

  it('Android receiveCommand handles EXACTLY play|pause|seekTo|setVolume|setMuted', () => {
    const src = read(ANDROID_MANAGER);
    const handler = src.slice(src.indexOf('override fun receiveCommand'));
    const commands = sortedUnique(collect(handler, /"(\w+)"\s*->/g));
    expect(commands).toEqual(['pause', 'play', 'seekTo', 'setMuted', 'setVolume']);
    expect(commands.filter((c) => AUDIO_SELECTION_RE.test(c))).toEqual([]);
  });

  it('Android view carries NO track-switch API (only the subtitle side-load)', () => {
    const src = read(ANDROID_VIEW);
    expect(src).not.toMatch(/setAudioTrack|switchAudioTrack|selectTrack|setTrackSelection/i);
    // The subtitle side-load is the OBSERVABLE arm — it must exist, else this
    // file's premise silently changed under S407.
    expect(src).toMatch(/setSubtitleUrl/);
  });

  it('PlayerScreen dispatches ONLY commands inside the pinned native set (no phantom audio call)', () => {
    const screenSrc = read(path.join(__dirname, '..', 'PlayerScreen.tsx'));
    const dispatched = sortedUnique(
      collect(screenSrc, /dispatchPlayerCommand\([^,]+,\s*'(\w+)'/g),
    );
    const NATIVE_ACCEPTED = new Set([
      'play',
      'pause',
      'seekTo',
      'setVolume',
      'setMuted',
      'updateVolume',
      'updateMuted',
      'startPiP',
      'stopPiP',
    ]);
    for (const command of dispatched) {
      expect(NATIVE_ACCEPTED.has(command)).toBe(true);
    }
    expect(dispatched.filter((c) => AUDIO_SELECTION_RE.test(c))).toEqual([]);
  });
});
