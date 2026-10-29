/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/player/SeekBar.tsx
//
// M-MOBILE-13 (review mobile__gameux): this bar used to be decorative — the
// component destructured `onSeek` as `_onSeek` and every surface here was a
// plain View with no responder, so a drag did nothing. It is now a real
// scrubber, dependency-free:
//
//  - The track captures the RN core RESPONDER system (onStartShouldSetResponder
//    / grant / move / release) — the same no-extra-package idiom the repo's
//    modal surfaces already lean on (@react-native-community/slider sits in
//    package.json wired to NOTHING; it stays unused, no lock churn).
//  - While a drag is in flight the bar renders the DRAG position, not the
//    ticker: the native `onProgress` stream keeps repainting `currentTime`
//    several times a second and would fight the finger. The ticker is only
//    visually paused here — PlayerScreen keeps receiving real position events
//    (the resume reporter feeds on them); nothing but this display defers.
//  - The seek COMMITS EXACTLY ONCE, on release. Move events are preview-only;
//    seeking per-pixel is a native seek-thrash bug class.
//  - Units: SECONDS end to end. `currentTime`/`duration` are the internal
//    seconds clock and `onSeek` fires seconds — the native `seekTo` is a
//    seconds API (src/native/types.ts; the Android impl multiplies by 1000 at
//    its own boundary). SyncPlay wire milliseconds are converted ONLY at the
//    PlayerScreen send boundary (`toSyncPlayPositionMs`); never in here.
//
// Grouped (SyncPlay) disposition lives with the caller via `canSeek`: the wire
// makes seeking a HOST-ONLY command (phlix-syncplay SPEC.md §9 item 2 —
// `syncplay_playback_seek` is authorized by the server against the connection's
// identity), and a member-local seek desyncs from the group clock. PlayerScreen
// therefore passes `canSeek={false}` while the viewer is a non-host member and
// this bar renders as a live, non-capturing progress display.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';

interface SeekBarProps {
  /** Live playback clock in SECONDS (fed by the native progress ticker). */
  currentTime: number;
  /** Total length in SECONDS; 0 until the player reports metadata. */
  duration: number;
  /** Commit callback — fires EXACTLY ONCE on drag release, in SECONDS. */
  onSeek: (position: number) => void;
  /**
   * False renders the bar as display-only (no drag capture): grouped members
   * follow the host timeline — see the header for the wire law behind it.
   */
  canSeek: boolean;
}

/**
 * Pure touch→seconds mapping: clamps a track-relative X to [0, trackWidth]
 * and scales it onto the duration. Unit-testable in isolation; an unmeasured
 * track (width 0) or unknown duration can only produce 0, never NaN.
 */
export function scrubSecondsFromLocation(
  locationX: number,
  trackWidth: number,
  duration: number,
): number {
  if (trackWidth <= 0 || duration <= 0) {
    return 0;
  }
  const fraction = Math.min(Math.max(locationX / trackWidth, 0), 1);
  return fraction * duration;
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const SeekBar: React.FC<SeekBarProps> = ({
  currentTime,
  duration,
  onSeek,
  canSeek,
}) => {
  // Non-null while a drag is in flight: the preview position in SECONDS.
  // Doubles as the "ticker visually paused" flag (see header).
  const [dragSeconds, setDragSeconds] = React.useState<number | null>(null);
  // Measured track width; 0 until the first onLayout, which is exactly why
  // responder capture is gated on it — an unmapped track must never commit a
  // bogus position-0 seek.
  const [trackWidth, setTrackWidth] = React.useState(0);

  const isScrubbing = canSeek && duration > 0 && trackWidth > 0;
  const displayedSeconds = dragSeconds ?? currentTime;
  const fraction = duration > 0 ? displayedSeconds / duration : 0;

  const secondsFromEvent = (event: GestureResponderEvent): number =>
    scrubSecondsFromLocation(event.nativeEvent.locationX, trackWidth, duration);

  const handleLayout = (event: LayoutChangeEvent): void => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const handleResponderRelease = (event: GestureResponderEvent): void => {
    const targetSeconds = secondsFromEvent(event);
    setDragSeconds(null);
    onSeek(targetSeconds);
  };

  const scrubbingHandlers = isScrubbing
    ? {
        onStartShouldSetResponder: () => true,
        onResponderGrant: (event: GestureResponderEvent) =>
          setDragSeconds(secondsFromEvent(event)),
        onResponderMove: (event: GestureResponderEvent) =>
          setDragSeconds(secondsFromEvent(event)),
        onResponderRelease: handleResponderRelease,
        // System takeover (e.g. a notification steal): drop the preview,
        // NEVER commit an abandoned drag.
        onResponderTerminate: () => setDragSeconds(null),
        accessibilityLabel: 'Seek',
      }
    : {};

  return (
    <View style={styles.container}>
      <Text style={styles.timeText}>{formatTime(displayedSeconds)}</Text>
      <View style={styles.sliderContainer}>
        <View style={styles.sliderTrack}>
          <View
            style={[styles.sliderProgress, { width: `${fraction * 100}%` }]}
          />
        </View>
        <View
          style={[styles.sliderThumb, { left: fraction * trackWidth }]}
          pointerEvents="none"
        />
        {/* Measurement lives on the ALWAYS-rendered surface: without a width
            the bar cannot map a touch, and capture is gated on exactly that
            width being known (isScrubbing) — no bogus position-0 commits. */}
        <View
          style={styles.scrubSurface}
          testID="seek-track"
          onLayout={handleLayout}
          {...scrubbingHandlers}
        />
      </View>
      <Text style={styles.timeText}>{formatTime(duration)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    minWidth: 50,
  },
  sliderContainer: {
    flex: 1,
    height: 30,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  sliderProgress: {
    height: '100%',
    backgroundColor: '#0066cc',
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginLeft: -8,
    top: 7,
  },
  // Transparent full-height capture layer over the track: the responder
  // surface is deliberately larger than the 4px visual track — a thumb you
  // can hit with a thumb. pointerEvents="none" on the decorative thumb keeps
  // locationX math on this layer's own frame.
  scrubSurface: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
});

export default SeekBar;
