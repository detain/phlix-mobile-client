// src/api/__tests__/PhotoManager.test.ts
import { photoManager } from '../PhotoManager';
import apiClient from '../client';
import type { Photo, PhotoAlbum, PhotoDetail } from '../../types/photo';

jest.mock('../client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const samplePhoto: Photo = {
  id: 'p1',
  name: 'IMG_0001.jpg',
  path: '/photos/IMG_0001.jpg',
  type: 'photo',
  library_id: 'lib1',
  metadata: { width: 4000, height: 3000 },
  thumbnail_url: 'https://srv/photo/photos/p1/thumbnail?sig=abc',
  full_url: 'https://srv/photo/photos/p1/full?sig=abc',
};

const sampleAlbum: PhotoAlbum = {
  id: 'a1',
  date: '2026-06-01',
  photo_count: 1,
  cover_photo: samplePhoto,
  photos: [samplePhoto],
};

const sampleDetail: PhotoDetail = {
  id: 'p1',
  name: 'IMG_0001.jpg',
  path: '/photos/IMG_0001.jpg',
  metadata: {
    camera_make: 'Canon',
    camera_model: 'EOS R5',
    lens: 'RF 24-70',
    aperture: 'f/2.8',
    iso: 100,
    shutter_speed: '1/250',
    focal_length: '50mm',
    width: 4000,
    height: 3000,
    orientation: 1,
    orientation_name: 'Horizontal',
    date_taken_unix: 1717200000,
    date_taken_formatted: 'June 1, 2026',
    date_taken_year: '2026',
    date_taken_month: 'June',
    gps_lat: 12.34,
    gps_lng: 56.78,
    gps_alt: 100,
    gps_display: '12.34, 56.78',
  },
  exif: {
    camera_make: 'Canon',
    camera_model: 'EOS R5',
    lens: 'RF 24-70',
    aperture: 'f/2.8',
    iso: 100,
    shutter_speed: '1/250',
    focal_length: '50mm',
    width: 4000,
    height: 3000,
    orientation: 1,
    orientation_name: 'Horizontal',
    date_taken_unix: 1717200000,
    date_taken_formatted: 'June 1, 2026',
    date_taken_year: '2026',
    date_taken_month: 'June',
    gps_lat: 12.34,
    gps_lng: 56.78,
    gps_alt: 100,
    gps_display: '12.34, 56.78',
  },
  thumbnail_url: 'https://srv/photo/photos/p1/thumbnail?sig=abc',
  full_url: 'https://srv/photo/photos/p1/full?sig=abc',
};

describe('PhotoManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getAlbums GETs /photo/albums with library_id and unwraps .albums', async () => {
    mockedClient.get.mockResolvedValue({ albums: [sampleAlbum] });
    const result = await photoManager.getAlbums('lib1');
    expect(mockedClient.get).toHaveBeenCalledWith('/photo/albums', {
      library_id: 'lib1',
    });
    expect(result).toEqual([sampleAlbum]);
  });

  it('getAlbum GETs /photo/albums/{id} with library_id and unwraps .album', async () => {
    mockedClient.get.mockResolvedValue({ album: sampleAlbum });
    const result = await photoManager.getAlbum('a1', 'lib1');
    expect(mockedClient.get).toHaveBeenCalledWith('/photo/albums/a1', {
      library_id: 'lib1',
    });
    expect(result).toEqual(sampleAlbum);
  });

  it('getPhotos GETs /photo/photos with library_id + limit/offset and returns the whole envelope', async () => {
    const envelope = {
      photos: [samplePhoto],
      pagination: { limit: 50, offset: 0, count: 1 },
    };
    mockedClient.get.mockResolvedValue(envelope);
    const result = await photoManager.getPhotos('lib1', {
      limit: 50,
      offset: 0,
    });
    expect(mockedClient.get).toHaveBeenCalledWith('/photo/photos', {
      library_id: 'lib1',
      limit: 50,
      offset: 0,
    });
    expect(result).toEqual(envelope);
  });

  it('getPhotos with no opts sends only library_id', async () => {
    mockedClient.get.mockResolvedValue({
      photos: [],
      pagination: { limit: 100, offset: 0, count: 0 },
    });
    await photoManager.getPhotos('lib1');
    expect(mockedClient.get).toHaveBeenCalledWith('/photo/photos', {
      library_id: 'lib1',
    });
  });

  it('getPhoto GETs /photo/photos/{id} and unwraps .photo', async () => {
    mockedClient.get.mockResolvedValue({ photo: sampleDetail });
    const result = await photoManager.getPhoto('p1');
    expect(mockedClient.get).toHaveBeenCalledWith('/photo/photos/p1');
    expect(result).toEqual(sampleDetail);
  });

  it('getSlideshow GETs /photo/slideshow with library_id + album_id + interval and returns the whole envelope', async () => {
    const envelope = {
      slideshow: [
        {
          id: 'p1',
          url: samplePhoto.full_url,
          thumbnail_url: samplePhoto.thumbnail_url,
          caption: 'IMG_0001.jpg',
          interval: 7,
        },
      ],
      interval: 7,
    };
    mockedClient.get.mockResolvedValue(envelope);
    const result = await photoManager.getSlideshow('lib1', {
      albumId: 'a1',
      interval: 7,
    });
    expect(mockedClient.get).toHaveBeenCalledWith('/photo/slideshow', {
      library_id: 'lib1',
      album_id: 'a1',
      interval: 7,
    });
    expect(result).toEqual(envelope);
  });

  it('getSlideshow with no opts sends only library_id', async () => {
    mockedClient.get.mockResolvedValue({ slideshow: [], interval: 5 });
    await photoManager.getSlideshow('lib1');
    expect(mockedClient.get).toHaveBeenCalledWith('/photo/slideshow', {
      library_id: 'lib1',
    });
  });
});
