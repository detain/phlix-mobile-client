/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/stores/usePhotoStore.ts
import { create } from 'zustand';
import { photoManager } from '../api/PhotoManager';
import { libraryManager } from '../api/LibraryManager';
import type { Library } from '../types/media';
import type { PhotoAlbum } from '../types/photo';

/**
 * Photo store (slice E9b). Holds the discovered photo libraries, the selected
 * library, that library's albums and the currently-open album, each with
 * section-scoped loading/error flags.
 *
 * Convention (matches useMusicStore): LOADERS swallow errors into the section
 * `*Error` (screens render an ErrorView). Photos have NO mutators.
 *
 * Photo libraries are discovered via `libraryManager.getLibraries()` filtered to
 * `type === 'photo'`; when exactly one exists it is auto-selected.
 */
interface PhotoState {
  photoLibraries: Library[];
  librariesLoading: boolean;
  librariesError: string | null;
  selectedLibraryId: string | null;

  albums: PhotoAlbum[];
  albumsLoading: boolean;
  albumsError: string | null;

  currentAlbum: PhotoAlbum | null;
  currentAlbumLoading: boolean;
  currentAlbumError: string | null;

  setSelectedLibraryId: (libraryId: string | null) => void;

  // Loaders (swallow → section error)
  loadPhotoLibraries: () => Promise<void>;
  loadAlbums: (libraryId: string) => Promise<void>;
  loadAlbum: (albumId: string, libraryId: string) => Promise<void>;

  reset: () => void;
}

const errMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const initialState = {
  photoLibraries: [] as Library[],
  librariesLoading: false,
  librariesError: null as string | null,
  selectedLibraryId: null as string | null,
  albums: [] as PhotoAlbum[],
  albumsLoading: false,
  albumsError: null as string | null,
  currentAlbum: null as PhotoAlbum | null,
  currentAlbumLoading: false,
  currentAlbumError: null as string | null,
};

export const usePhotoStore = create<PhotoState>((set) => ({
  ...initialState,

  setSelectedLibraryId: (libraryId) => set({ selectedLibraryId: libraryId }),

  loadPhotoLibraries: async () => {
    set({ librariesLoading: true, librariesError: null });
    try {
      const libs = await libraryManager.getLibraries();
      const photoLibraries = libs.filter((lib) => lib.type === 'photo');
      set((state) => ({
        photoLibraries,
        librariesLoading: false,
        // Auto-select when exactly one photo library exists; otherwise keep
        // any existing selection (don't clobber a deep-link choice).
        selectedLibraryId:
          photoLibraries.length === 1
            ? photoLibraries[0].id
            : state.selectedLibraryId,
      }));
    } catch (error) {
      set({
        librariesError: errMessage(error, 'Failed to load photo libraries'),
        librariesLoading: false,
      });
    }
  },

  loadAlbums: async (libraryId) => {
    set({ albumsLoading: true, albumsError: null });
    try {
      const albums = await photoManager.getAlbums(libraryId);
      set({ albums, albumsLoading: false });
    } catch (error) {
      set({
        albumsError: errMessage(error, 'Failed to load albums'),
        albumsLoading: false,
      });
    }
  },

  loadAlbum: async (albumId, libraryId) => {
    set({ currentAlbumLoading: true, currentAlbumError: null });
    try {
      const currentAlbum = await photoManager.getAlbum(albumId, libraryId);
      set({ currentAlbum, currentAlbumLoading: false });
    } catch (error) {
      set({
        currentAlbumError: errMessage(error, 'Failed to load album'),
        currentAlbumLoading: false,
      });
    }
  },

  reset: () => set({ ...initialState }),
}));
