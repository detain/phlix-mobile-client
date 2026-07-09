/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/PhotoManager.ts
import apiClient from './client';
import type {
  Photo,
  PhotoAlbum,
  PhotoDetail,
  SlideshowItem,
} from '../types/photo';

/**
 * Photo API surface (slice E9b) — `PhotoController`, all Bearer-gated (NOT
 * admin-gated). The image BYTE routes (thumbnail/full) additionally accept a
 * signed-URL token; this manager never hits them directly — payloads carry
 * SIGNED `thumbnail_url`/`full_url` that go straight into `<Image source>`.
 *
 * The apiClient baseURL already adds `/api/v1`, so paths start `/photo`
 * (SINGULAR). `library_id` is a REQUIRED query param on albums/photos/slideshow.
 *
 * Envelopes (verified against PhotoController):
 *   - albums    → { albums } / { album }
 *   - photos    → { photos, pagination: { limit, offset, count } }
 *   - photo     → { photo: PhotoDetail }
 *   - slideshow → { slideshow, interval }
 *
 * Field names are the server payload verbatim (snake_case); do NOT camelCase.
 */

/** Whole envelope returned by `GET /photo/photos`. `count` = returned count. */
export interface PhotosResponse {
  photos: Photo[];
  pagination: { limit: number; offset: number; count: number };
}

/** Whole envelope returned by `GET /photo/slideshow`. */
export interface SlideshowResponse {
  slideshow: SlideshowItem[];
  interval: number;
}

class PhotoManager {
  // GET /api/v1/photo/albums?library_id → { albums }
  async getAlbums(libraryId: string): Promise<PhotoAlbum[]> {
    const res = await apiClient.get<{ albums: PhotoAlbum[] }>('/photo/albums', {
      library_id: libraryId,
    });
    return res.albums;
  }

  // GET /api/v1/photo/albums/{id}?library_id → { album }  (id = md5 of date)
  async getAlbum(albumId: string, libraryId: string): Promise<PhotoAlbum> {
    const res = await apiClient.get<{ album: PhotoAlbum }>(
      `/photo/albums/${albumId}`,
      { library_id: libraryId }
    );
    return res.album;
  }

  // GET /api/v1/photo/photos?library_id&limit&offset
  //   → { photos, pagination: { limit, offset, count } }  (whole envelope)
  async getPhotos(
    libraryId: string,
    opts: { limit?: number; offset?: number } = {}
  ): Promise<PhotosResponse> {
    const params: Record<string, string | number> = { library_id: libraryId };
    if (opts.limit !== undefined) {
      params.limit = opts.limit;
    }
    if (opts.offset !== undefined) {
      params.offset = opts.offset;
    }
    return apiClient.get<PhotosResponse>('/photo/photos', params);
  }

  // GET /api/v1/photo/photos/{id} → { photo: PhotoDetail }
  async getPhoto(id: string): Promise<PhotoDetail> {
    const res = await apiClient.get<{ photo: PhotoDetail }>(
      `/photo/photos/${id}`
    );
    return res.photo;
  }

  // GET /api/v1/photo/slideshow?library_id&album_id&interval
  //   → { slideshow, interval }  (whole envelope)
  async getSlideshow(
    libraryId: string,
    opts: { albumId?: string; interval?: number } = {}
  ): Promise<SlideshowResponse> {
    const params: Record<string, string | number> = { library_id: libraryId };
    if (opts.albumId !== undefined) {
      params.album_id = opts.albumId;
    }
    if (opts.interval !== undefined) {
      params.interval = opts.interval;
    }
    return apiClient.get<SlideshowResponse>('/photo/slideshow', params);
  }
}

export const photoManager = new PhotoManager();
export default photoManager;
