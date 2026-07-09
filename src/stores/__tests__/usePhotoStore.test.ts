/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/usePhotoStore.test.ts
import { usePhotoStore } from '../usePhotoStore';
import { photoManager } from '../../api/PhotoManager';
import { libraryManager } from '../../api/LibraryManager';
import type { Library } from '../../types/media';
import type { PhotoAlbum } from '../../types/photo';

jest.mock('../../api/PhotoManager', () => ({
  photoManager: {
    getAlbums: jest.fn(),
    getAlbum: jest.fn(),
    getPhotos: jest.fn(),
    getPhoto: jest.fn(),
    getSlideshow: jest.fn(),
  },
}));

jest.mock('../../api/LibraryManager', () => ({
  libraryManager: {
    getLibraries: jest.fn(),
  },
}));

const mockedPhoto = photoManager as jest.Mocked<typeof photoManager>;
const mockedLibrary = libraryManager as jest.Mocked<typeof libraryManager>;

const photoLib = (id: string, name: string): Library => ({
  id,
  name,
  type: 'photo',
});
const videoLib: Library = { id: 'v1', name: 'Movies', type: 'movie' };

const album: PhotoAlbum = {
  id: 'a1',
  date: '2026-06-01',
  photo_count: 2,
  photos: [],
};

describe('usePhotoStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePhotoStore.getState().reset();
  });

  it('loadPhotoLibraries filters type === photo', async () => {
    mockedLibrary.getLibraries.mockResolvedValue([
      videoLib,
      photoLib('ph1', 'Family'),
      photoLib('ph2', 'Travel'),
    ]);
    await usePhotoStore.getState().loadPhotoLibraries();
    const s = usePhotoStore.getState();
    expect(s.photoLibraries.map((l) => l.id)).toEqual(['ph1', 'ph2']);
    expect(s.librariesLoading).toBe(false);
    expect(s.librariesError).toBeNull();
  });

  it('loadPhotoLibraries auto-selects when exactly one photo library', async () => {
    mockedLibrary.getLibraries.mockResolvedValue([
      videoLib,
      photoLib('ph1', 'Family'),
    ]);
    await usePhotoStore.getState().loadPhotoLibraries();
    expect(usePhotoStore.getState().selectedLibraryId).toBe('ph1');
  });

  it('loadPhotoLibraries does NOT auto-select with multiple photo libraries', async () => {
    mockedLibrary.getLibraries.mockResolvedValue([
      photoLib('ph1', 'A'),
      photoLib('ph2', 'B'),
    ]);
    await usePhotoStore.getState().loadPhotoLibraries();
    expect(usePhotoStore.getState().selectedLibraryId).toBeNull();
  });

  it('loadPhotoLibraries sets librariesError on failure', async () => {
    mockedLibrary.getLibraries.mockRejectedValue(new Error('boom'));
    await usePhotoStore.getState().loadPhotoLibraries();
    const s = usePhotoStore.getState();
    expect(s.librariesError).toBe('boom');
    expect(s.librariesLoading).toBe(false);
  });

  it('loadAlbums populates albums', async () => {
    mockedPhoto.getAlbums.mockResolvedValue([album]);
    await usePhotoStore.getState().loadAlbums('ph1');
    expect(mockedPhoto.getAlbums).toHaveBeenCalledWith('ph1');
    expect(usePhotoStore.getState().albums).toEqual([album]);
  });

  it('loadAlbums sets albumsError on failure', async () => {
    mockedPhoto.getAlbums.mockRejectedValue(new Error('nope'));
    await usePhotoStore.getState().loadAlbums('ph1');
    expect(usePhotoStore.getState().albumsError).toBe('nope');
  });

  it('loadAlbum populates currentAlbum', async () => {
    mockedPhoto.getAlbum.mockResolvedValue(album);
    await usePhotoStore.getState().loadAlbum('a1', 'ph1');
    expect(mockedPhoto.getAlbum).toHaveBeenCalledWith('a1', 'ph1');
    expect(usePhotoStore.getState().currentAlbum).toEqual(album);
  });

  it('loadAlbum sets currentAlbumError on failure', async () => {
    mockedPhoto.getAlbum.mockRejectedValue(new Error('fail'));
    await usePhotoStore.getState().loadAlbum('a1', 'ph1');
    expect(usePhotoStore.getState().currentAlbumError).toBe('fail');
  });

  it('setSelectedLibraryId updates the selection', () => {
    usePhotoStore.getState().setSelectedLibraryId('ph9');
    expect(usePhotoStore.getState().selectedLibraryId).toBe('ph9');
  });
});
