/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/usePlayerStore.test.ts
import { usePlayerStore } from '../usePlayerStore';
import type { MediaItem } from '../../types/media';
import type { StreamInfo, PlaybackSession } from '../../types/playback';

const item = (id: string): MediaItem => ({ id, name: 'Test', type: 'movie' });

describe('usePlayerStore', () => {
  beforeEach(() => {
    usePlayerStore.getState().reset();
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = usePlayerStore.getState();
      expect(state.currentItem).toBeNull();
      expect(state.currentSession).toBeNull();
      expect(state.streamInfo).toBeNull();
      expect(state.isPlaying).toBe(false);
      expect(state.isBuffering).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.duration).toBe(0);
      expect(state.volume).toBe(1);
      expect(state.isMuted).toBe(false);
      expect(state.playbackRate).toBe(1);
      expect(state.subtitleTracks).toEqual([]);
      expect(state.currentSubtitleTrackId).toBeNull();
      expect(state.audioTracks).toEqual([]);
      expect(state.currentAudioTrackId).toBeNull();
      expect(state.currentQuality).toBe('auto');
      expect(state.error).toBeNull();
    });
  });

  describe('setCurrentItem', () => {
    it('sets the current media item', () => {
      const mediaItem = item('m1');
      usePlayerStore.getState().setCurrentItem(mediaItem);
      expect(usePlayerStore.getState().currentItem).toEqual(mediaItem);
    });

    it('can set item to null', () => {
      usePlayerStore.getState().setCurrentItem(item('m1'));
      usePlayerStore.getState().setCurrentItem(null);
      expect(usePlayerStore.getState().currentItem).toBeNull();
    });
  });

  describe('setStreamInfo', () => {
    it('sets the stream info', () => {
      const info: StreamInfo = {
        url: 'https://example.com/stream',
        protocol: 'hls',
        container: 'm3u8',
        size: 1024,
        bitrate: 5000,
        duration_seconds: 3600,
      };
      usePlayerStore.getState().setStreamInfo(info);
      expect(usePlayerStore.getState().streamInfo).toEqual(info);
    });
  });

  describe('setSession', () => {
    it('sets the playback session', () => {
      const session: PlaybackSession = {
        id: 'sess-1',
        user_id: 'u1',
        media_item_id: 'm1',
        server_id: 'srv-1',
        client_name: 'Phlix Mobile',
        device_id: 'device-1',
      };
      usePlayerStore.getState().setSession(session);
      expect(usePlayerStore.getState().currentSession).toEqual(session);
    });
  });

  describe('playback state setters', () => {
    it('setIsPlaying', () => {
      usePlayerStore.getState().setIsPlaying(true);
      expect(usePlayerStore.getState().isPlaying).toBe(true);
    });

    it('setIsBuffering', () => {
      usePlayerStore.getState().setIsBuffering(true);
      expect(usePlayerStore.getState().isBuffering).toBe(true);
    });

    it('setCurrentTime', () => {
      usePlayerStore.getState().setCurrentTime(120);
      expect(usePlayerStore.getState().currentTime).toBe(120);
    });

    it('setDuration', () => {
      usePlayerStore.getState().setDuration(3600);
      expect(usePlayerStore.getState().duration).toBe(3600);
    });

    it('setVolume', () => {
      usePlayerStore.getState().setVolume(0.5);
      expect(usePlayerStore.getState().volume).toBe(0.5);
    });

    it('setIsMuted', () => {
      usePlayerStore.getState().setIsMuted(true);
      expect(usePlayerStore.getState().isMuted).toBe(true);
    });

    it('setPlaybackRate', () => {
      usePlayerStore.getState().setPlaybackRate(1.5);
      expect(usePlayerStore.getState().playbackRate).toBe(1.5);
    });
  });

  describe('subtitle track setters', () => {
    it('setSubtitleTracks', () => {
      const tracks = [
        { id: 'sub1', codec: 'srt', language: 'en', display_title: 'English' },
      ];
      usePlayerStore.getState().setSubtitleTracks(tracks);
      expect(usePlayerStore.getState().subtitleTracks).toEqual(tracks);
    });

    it('setCurrentSubtitleTrackId', () => {
      usePlayerStore.getState().setCurrentSubtitleTrackId('sub1');
      expect(usePlayerStore.getState().currentSubtitleTrackId).toBe('sub1');
    });

    it('can set subtitle track to null', () => {
      usePlayerStore.getState().setCurrentSubtitleTrackId('sub1');
      usePlayerStore.getState().setCurrentSubtitleTrackId(null);
      expect(usePlayerStore.getState().currentSubtitleTrackId).toBeNull();
    });
  });

  describe('audio track setters', () => {
    it('setAudioTracks', () => {
      const tracks = [
        { id: 'aud1', codec: 'aac', language: 'en', display_title: 'English', channels: 2 },
      ];
      usePlayerStore.getState().setAudioTracks(tracks);
      expect(usePlayerStore.getState().audioTracks).toEqual(tracks);
    });

    it('setCurrentAudioTrackId', () => {
      usePlayerStore.getState().setCurrentAudioTrackId('aud1');
      expect(usePlayerStore.getState().currentAudioTrackId).toBe('aud1');
    });
  });

  describe('setCurrentQuality', () => {
    it('sets quality preference', () => {
      usePlayerStore.getState().setCurrentQuality('1080p');
      expect(usePlayerStore.getState().currentQuality).toBe('1080p');
    });
  });

  describe('setError', () => {
    it('sets error message', () => {
      usePlayerStore.getState().setError('Playback failed');
      expect(usePlayerStore.getState().error).toBe('Playback failed');
    });

    it('can clear error', () => {
      usePlayerStore.getState().setError('Some error');
      usePlayerStore.getState().setError(null);
      expect(usePlayerStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      // Set various states
      usePlayerStore.getState().setCurrentItem(item('m1'));
      usePlayerStore.getState().setIsPlaying(true);
      usePlayerStore.getState().setCurrentTime(100);
      usePlayerStore.getState().setVolume(0.8);
      usePlayerStore.getState().setError('some error');
      usePlayerStore.getState().setCurrentQuality('1080p');

      // Reset
      usePlayerStore.getState().reset();

      // Verify all reset
      const state = usePlayerStore.getState();
      expect(state.currentItem).toBeNull();
      expect(state.isPlaying).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.volume).toBe(1);
      expect(state.error).toBeNull();
      expect(state.currentQuality).toBe('auto');
      expect(state.isMuted).toBe(false);
      expect(state.playbackRate).toBe(1);
    });
  });
});
