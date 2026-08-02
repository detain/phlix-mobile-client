/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/__tests__/playback.test.ts
//
// `playback.ts` re-exports `Rendition`, `RenditionId`, `QualitySelection` from
// `@phlix/contracts` and declares StreamInfo, SubtitleTrack, AudioTrack,
// SkipMarkers, etc. These are compile-time shape assertions.
import type {
  StreamInfo,
  SubtitleTrack,
  AudioTrack,
  SkipMarkers,
  Marker,
  Chapter,
  PlaybackInfo,
  TranscodeJob,
  TranscodeStatus,
  PlaybackSession,
} from '../playback';

/**
 * `true` only when `A` and `B` are the SAME type, not merely assignable to one
 * another. Assignability is too weak for an absence pin: `false` is assignable
 * to `boolean`, so a widened result would slip through a subtype check.
 * (Mirrors the `Exact<A, B>` helper in `@phlix/contracts`' own S11 pin.)
 */
type Exact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/**
 * `true` iff `K` is a member of `keyof T`. `keyof` includes OPTIONAL members,
 * so this is RED for `dash_url?: string` just as it is for `dash_url: string` —
 * which a value-level fixture or assignability check would NOT catch.
 */
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

/**
 * Compile-time assertion: the type argument must resolve to exactly `true`.
 * Anything else is a typecheck error.
 *
 * ⚠ The executing gate is `npm run typecheck` (`tsc --noEmit`), run by
 * `.github/workflows/test.yml` before lint and jest. Jest uses the babel-based
 * `@react-native/jest-preset`, which STRIPS types without checking them — a
 * broken assertion here still shows GREEN under `npm test`.
 */
function assertExact<T extends true>(value: T): T {
  return value;
}

describe('playback types', () => {
  describe('StreamInfo', () => {
    it('matches the server shape for direct play', () => {
      const stream: StreamInfo = {
        url: 'https://server/stream.m3u8',
        protocol: 'hls',
        container: 'm3u8',
        size: 1073741824,
        bitrate: 5000000,
        duration_seconds: 7200,
      };
      expect(stream.protocol).toBe('hls');
      expect(stream.duration_seconds).toBe(7200);
    });

    it('allows optional stream_url for signed URLs', () => {
      const stream: StreamInfo = {
        url: 'https://server/stream.m3u8',
        stream_url: 'https://signed/stream.m3u8?exp=123&sig=abc',
        protocol: 'hls',
        container: 'm3u8',
        size: 1073741824,
        bitrate: 5000000,
        duration_seconds: 7200,
      };
      expect(stream.stream_url).toContain('sig=');
    });

    it('matches HTTP protocol shape', () => {
      const stream: StreamInfo = {
        url: 'https://server/stream.mp4',
        protocol: 'http',
        container: 'mp4',
        size: 2147483648,
        bitrate: 8000000,
        duration_seconds: 3600,
      };
      expect(stream.protocol).toBe('http');
    });
  });

  describe('SubtitleTrack', () => {
    it('matches the subtitle track shape', () => {
      const track: SubtitleTrack = {
        id: 'sub1',
        codec: 'subrip',
        language: 'eng',
        display_title: 'English',
      };
      expect(track.id).toBe('sub1');
    });

    it('allows optional url for external subtitles', () => {
      const track: SubtitleTrack = {
        id: 'sub2',
        codec: 'webvtt',
        language: 'spa',
        display_title: 'Spanish',
        url: 'https://server/subtitles/spa.vtt',
      };
      expect(track.url).toContain('vtt');
    });
  });

  describe('AudioTrack', () => {
    it('matches the audio track shape', () => {
      const track: AudioTrack = {
        id: 'audio1',
        codec: 'aac',
        language: 'eng',
        display_title: 'English (AAC)',
        channels: 6,
      };
      expect(track.channels).toBe(6);
    });

    it('allows optional url for external audio', () => {
      const track: AudioTrack = {
        id: 'audio2',
        codec: 'mp3',
        language: 'und',
        display_title: 'Commentary',
        channels: 2,
        url: 'https://server/audio/commentary.mp3',
      };
      expect(track.url).toBeDefined();
    });

    it('supports stereo audio', () => {
      const track: AudioTrack = {
        id: 'audio3',
        codec: 'aac',
        language: 'eng',
        display_title: 'English Stereo',
        channels: 2,
      };
      expect(track.channels).toBe(2);
    });
  });

  describe('SkipMarkers', () => {
    it('matches the full skip markers shape', () => {
      const markers: SkipMarkers = {
        skip_intro_start: 0,
        skip_intro_end: 90000,
        skip_outro_start: 6930000,
        skip_outro_end: 7200000,
      };
      expect(markers.skip_intro_start).toBe(0);
      expect(markers.skip_outro_end).toBe(7200000);
    });

    it('allows null values when markers are not set', () => {
      const markers: SkipMarkers = {
        skip_intro_start: null,
        skip_intro_end: null,
        skip_outro_start: null,
        skip_outro_end: null,
      };
      expect(markers.skip_intro_start).toBeNull();
      expect(markers.skip_outro_end).toBeNull();
    });

    it('allows partial markers (intro only)', () => {
      const markers: SkipMarkers = {
        skip_intro_start: 0,
        skip_intro_end: 90000,
        skip_outro_start: null,
        skip_outro_end: null,
      };
      expect(markers.skip_intro_end).toBe(90000);
      expect(markers.skip_outro_start).toBeNull();
    });
  });

  describe('Marker', () => {
    it('matches the marker shape with start and end seconds', () => {
      const marker: Marker = {
        start_seconds: 0,
        end_seconds: 90,
      };
      expect(marker.start_seconds).toBe(0);
      expect(marker.end_seconds).toBe(90);
    });
  });

  describe('Chapter', () => {
    it('matches the chapter shape with title', () => {
      const chapter: Chapter = {
        start_seconds: 120,
        end_seconds: 300,
        title: 'Chapter 1: The Beginning',
      };
      expect(chapter.title).toBe('Chapter 1: The Beginning');
    });
  });

  describe('PlaybackInfo', () => {
    it('matches the full playback info shape', () => {
      const info: PlaybackInfo = {
        item_id: 'm123',
        intro_marker: { start_seconds: 0, end_seconds: 90 },
        outro_marker: { start_seconds: 6930, end_seconds: 7200 },
        chapters: [
          { start_seconds: 120, end_seconds: 300, title: 'Chapter 1' },
          { start_seconds: 301, end_seconds: 600, title: 'Chapter 2' },
        ],
      };
      expect(info.item_id).toBe('m123');
      expect(info.intro_marker?.start_seconds).toBe(0);
      expect(info.chapters).toHaveLength(2);
    });

    it('allows null markers when no intro/outro', () => {
      const info: PlaybackInfo = {
        item_id: 'm456',
        intro_marker: null,
        outro_marker: null,
        chapters: [],
      };
      expect(info.intro_marker).toBeNull();
      expect(info.outro_marker).toBeNull();
    });

    it('allows optional skip_button_spec', () => {
      const info: PlaybackInfo = {
        item_id: 'm789',
        intro_marker: null,
        outro_marker: null,
        chapters: [],
        skip_button_spec: { type: 'outro' },
      };
      expect(info.skip_button_spec).toBeDefined();
    });
  });

  describe('TranscodeJob', () => {
    it('matches the transcode job shape', () => {
      const job: TranscodeJob = {
        job_id: 'job-1',
        master_url: 'https://server/transcode/job-1/master.m3u8',
        hls_url: 'https://server/transcode/job-1/playlist.m3u8',
        status: 'encoding',
        reused: false,
        subtitles: [],
      };
      expect(job.status).toBe('encoding');
      expect(job.reused).toBe(false);
    });

    it('allows variants for ABR ladder (type check)', () => {
      // variants is typed as Rendition[] | null | undefined from @phlix/contracts
      // This is a compile-time assertion that the field exists and accepts the right shape
      const job: TranscodeJob = {
        job_id: 'job-2',
        master_url: 'https://server/transcode/job-2/master.m3u8',
        hls_url: 'https://server/transcode/job-2/playlist.m3u8',
        status: 'ready',
        reused: true,
        subtitles: [],
        variants: null,
      };
      expect(job.variants).toBeNull();
    });
  });

  describe('TranscodeStatus', () => {
    it('matches the transcode status shape', () => {
      const status: TranscodeStatus = {
        job_id: 'job-1',
        status: 'encoding',
        segments: 45,
        playlist_ready: false,
        progress: 45,
        master_url: 'https://server/transcode/job-1/master.m3u8',
        subtitles: [],
      };
      expect(status.progress).toBe(45);
      expect(status.playlist_ready).toBe(false);
    });

    it('allows ready status with playlist', () => {
      const status: TranscodeStatus = {
        job_id: 'job-1',
        status: 'ready',
        segments: 100,
        playlist_ready: true,
        progress: 100,
        master_url: 'https://server/transcode/job-1/master.m3u8',
        subtitles: [],
      };
      expect(status.status).toBe('ready');
      expect(status.playlist_ready).toBe(true);
    });

    it('declares no dash_url on either transcode shape (S11 absence pin)', () => {
      // phlix-server S11 removed `dash_url` from every transcode payload: real
      // DASH is unbuilt (S56-S60), so `/dash/{job}/manifest.mpd` always 404'd.
      // `@phlix/contracts` v0.4.0 dropped it from TranscodeStartResponse /
      // TranscodeStatusResponse; these local copies followed.
      //
      // `Exact<…, false>` rather than a bare assignability check, so re-adding
      // the member as `dash_url?: string` is just as RED as `dash_url: string`.
      // The four fixtures above only prove the REQUIRED form is gone; they stay
      // green against the optional form.
      expect(assertExact<Exact<HasKey<TranscodeJob, 'dash_url'>, false>>(true)).toBe(true);
      expect(assertExact<Exact<HasKey<TranscodeStatus, 'dash_url'>, false>>(true)).toBe(true);

      // Counterweight: the helper must be capable of reporting `true`, else the
      // two assertions above would pass against literally any type.
      expect(assertExact<Exact<HasKey<TranscodeJob, 'master_url'>, true>>(true)).toBe(true);
      expect(assertExact<Exact<HasKey<TranscodeStatus, 'master_url'>, true>>(true)).toBe(true);
    });
  });

  describe('PlaybackSession', () => {
    it('matches the playback session shape', () => {
      const session: PlaybackSession = {
        id: 'sess-1',
        user_id: 'u1',
        media_item_id: 'm123',
        server_id: 'srv-1',
        client_name: 'Phlix Mobile',
        device_id: 'device-abc',
      };
      expect(session.id).toBe('sess-1');
    });
  });
});
