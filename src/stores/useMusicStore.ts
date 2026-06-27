// src/stores/useMusicStore.ts
import { create } from 'zustand';
import { musicManager } from '../api/MusicManager';
import type { Artist, Album, Track, NowPlaying } from '../types/music';

/**
 * Music store (slice E9a). Holds artists, albums, the first page of tracks and
 * the now-playing session, each with section-scoped loading/error flags.
 *
 * Convention (matches useLiveTvStore): LOADERS swallow errors into the section
 * `*Error` (screens render an ErrorView). Music has NO mutators.
 *
 * Album-level track listing is screen-local (MusicAlbumScreen calls
 * `musicManager.getAlbum` directly) — not held here.
 */
interface MusicState {
  artists: Artist[];
  artistsLoading: boolean;
  artistsError: string | null;

  albums: Album[];
  albumsLoading: boolean;
  albumsError: string | null;

  tracks: Track[];
  tracksLoading: boolean;
  tracksError: string | null;

  nowPlaying: NowPlaying | null;
  nowPlayingLoading: boolean;
  nowPlayingError: string | null;

  // Loaders (swallow → section error)
  loadArtists: () => Promise<void>;
  loadAlbums: () => Promise<void>;
  loadTracks: () => Promise<void>;
  loadNowPlaying: () => Promise<void>;

  reset: () => void;
}

const errMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const initialState = {
  artists: [] as Artist[],
  artistsLoading: false,
  artistsError: null as string | null,
  albums: [] as Album[],
  albumsLoading: false,
  albumsError: null as string | null,
  tracks: [] as Track[],
  tracksLoading: false,
  tracksError: null as string | null,
  nowPlaying: null as NowPlaying | null,
  nowPlayingLoading: false,
  nowPlayingError: null as string | null,
};

export const useMusicStore = create<MusicState>((set) => ({
  ...initialState,

  loadArtists: async () => {
    set({ artistsLoading: true, artistsError: null });
    try {
      const artists = await musicManager.getArtists();
      set({ artists, artistsLoading: false });
    } catch (error) {
      set({
        artistsError: errMessage(error, 'Failed to load artists'),
        artistsLoading: false,
      });
    }
  },

  loadAlbums: async () => {
    set({ albumsLoading: true, albumsError: null });
    try {
      const albums = await musicManager.getAlbums();
      set({ albums, albumsLoading: false });
    } catch (error) {
      set({
        albumsError: errMessage(error, 'Failed to load albums'),
        albumsLoading: false,
      });
    }
  },

  loadTracks: async () => {
    set({ tracksLoading: true, tracksError: null });
    try {
      const res = await musicManager.getTracks();
      set({ tracks: res.tracks, tracksLoading: false });
    } catch (error) {
      set({
        tracksError: errMessage(error, 'Failed to load tracks'),
        tracksLoading: false,
      });
    }
  },

  loadNowPlaying: async () => {
    set({ nowPlayingLoading: true, nowPlayingError: null });
    try {
      const nowPlaying = await musicManager.getNowPlaying();
      set({ nowPlaying, nowPlayingLoading: false });
    } catch (error) {
      set({
        nowPlayingError: errMessage(error, 'Failed to load now playing'),
        nowPlayingLoading: false,
      });
    }
  },

  reset: () => set({ ...initialState }),
}));
