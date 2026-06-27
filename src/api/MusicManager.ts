// src/api/MusicManager.ts
import apiClient from './client';
import type { Artist, Album, Track, NowPlaying } from '../types/music';

/**
 * Music API surface (slice E9a) — `MusicController`, all Bearer-gated (NOT
 * admin-gated). Artists/albums/tracks aggregate across ALL music libraries
 * server-side (no library_id param).
 *
 * The apiClient baseURL already adds `/api/v1`, so paths start `/music`.
 *
 * Envelopes (verified against MusicController):
 *   - artists      → { artists } / { artist }   ({mbid} = artist NAME)
 *   - albums       → { albums }  / { album }     ({mbid} = album NAME)
 *   - tracks       → { tracks, limit, offset, total } / { track }
 *   - now-playing  → { now_playing: NowPlaying | null }
 *
 * Field names are the server payload verbatim (snake_case); do NOT camelCase.
 *
 * LANDMINE: list/getTrack return FLAT tracks; `album.tracks` are RAW rows —
 * normalize with `normalizeAlbumTrack` from `types/music`.
 *
 * Track playback: a track `id` IS a media_item id → navigate to `Player` with
 * `{ itemId: track.id }`; there is no dedicated music stream route.
 */

/** Whole envelope returned by `GET /music/tracks`. */
export interface TracksResponse {
  tracks: Track[];
  total: number;
  limit: number;
  offset: number;
}

class MusicManager {
  // GET /api/v1/music/artists → { artists }
  async getArtists(): Promise<Artist[]> {
    const res = await apiClient.get<{ artists: Artist[] }>('/music/artists');
    return res.artists;
  }

  // GET /api/v1/music/artists/{name} → { artist }  ({name} = artist NAME)
  async getArtist(name: string): Promise<Artist> {
    const res = await apiClient.get<{ artist: Artist }>(
      `/music/artists/${encodeURIComponent(name)}`
    );
    return res.artist;
  }

  // GET /api/v1/music/albums → { albums }
  async getAlbums(): Promise<Album[]> {
    const res = await apiClient.get<{ albums: Album[] }>('/music/albums');
    return res.albums;
  }

  // GET /api/v1/music/albums/{name} → { album }  ({name} = album NAME)
  async getAlbum(name: string): Promise<Album> {
    const res = await apiClient.get<{ album: Album }>(
      `/music/albums/${encodeURIComponent(name)}`
    );
    return res.album;
  }

  // GET /api/v1/music/tracks?limit&offset → { tracks, total, limit, offset }
  async getTracks(
    opts: { limit?: number; offset?: number } = {}
  ): Promise<TracksResponse> {
    const params: Record<string, number> = {};
    if (opts.limit !== undefined) {
      params.limit = opts.limit;
    }
    if (opts.offset !== undefined) {
      params.offset = opts.offset;
    }
    return apiClient.get<TracksResponse>('/music/tracks', params);
  }

  // GET /api/v1/music/tracks/{id} → { track }  ({id} = media_item UUID)
  async getTrack(id: string): Promise<Track> {
    const res = await apiClient.get<{ track: Track }>(`/music/tracks/${id}`);
    return res.track;
  }

  // GET /api/v1/music/now-playing → { now_playing: NowPlaying | null }
  async getNowPlaying(): Promise<NowPlaying | null> {
    const res = await apiClient.get<{ now_playing: NowPlaying | null }>(
      '/music/now-playing'
    );
    return res.now_playing;
  }
}

export const musicManager = new MusicManager();
export default musicManager;
