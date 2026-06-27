// src/api/LibraryManager.ts
import apiClient from './client';
import { MediaItem, Season, Episode, Library } from '../types/media';

/**
 * Paginated `/media` envelope. `total` is only returned by `GET /media`
 * (search / browse / children). `GET /libraries/{id}/items` returns
 * `{items, limit, offset}` with NO `total` — hence `total` is optional.
 */
export interface PaginatedResponse<T> {
  items: T[];
  total?: number;
  limit: number;
  offset: number;
}

/** Full filter set accepted by `GET /api/v1/media`. */
export interface BrowseMediaParams {
  search?: string;
  genres?: string[];
  ratings?: string[];
  actors?: string[];
  companies?: string[];
  yearFrom?: number;
  yearTo?: number;
  match?: string;
  sort?: 'name' | 'year' | 'rating' | 'date_added' | 'runtime';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  libraryId?: string;
  parentId?: string;
  topLevel?: boolean | 1;
}

class LibraryManager {
  // Get all libraries → GET /api/v1/libraries → { libraries }
  async getLibraries(): Promise<Library[]> {
    const res = await apiClient.get<{ libraries: Library[] }>('/libraries');
    return res.libraries;
  }

  // Get library items → GET /api/v1/libraries/{id}/items → { items, limit, offset }
  async getLibraryItems(
    libraryId: string,
    options: {
      type?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<PaginatedResponse<MediaItem>> {
    return apiClient.get<PaginatedResponse<MediaItem>>(
      `/libraries/${libraryId}/items`,
      options
    );
  }

  /**
   * General media browse/filter → GET /api/v1/media → { items, total, limit, offset }.
   * This single route backs search, children (parentId), and recently-added
   * (sort=date_added&order=desc).
   */
  async browseMedia(params: BrowseMediaParams = {}): Promise<PaginatedResponse<MediaItem>> {
    return apiClient.get<PaginatedResponse<MediaItem>>('/media', params);
  }

  // Recently added → GET /api/v1/media?sort=date_added&order=desc&limit=N
  async getRecentlyAdded(limit: number = 20): Promise<MediaItem[]> {
    const res = await this.browseMedia({ sort: 'date_added', order: 'desc', limit });
    return res.items;
  }

  // Media item details → GET /api/v1/media/{id} → { item }
  async getMediaItem(itemId: string): Promise<MediaItem> {
    const res = await apiClient.get<{ item: MediaItem }>(`/media/${itemId}`);
    return res.item;
  }

  // Seasons of a series → GET /api/v1/media?parentId={seriesId} → { items }
  async getSeasons(seriesId: string): Promise<Season[]> {
    const res = await this.browseMedia({ parentId: seriesId });
    return res.items as Season[];
  }

  // Episodes of a season → GET /api/v1/media?parentId={seasonId} → { items }
  async getEpisodes(seasonId: string): Promise<Episode[]> {
    const res = await this.browseMedia({ parentId: seasonId });
    return res.items as Episode[];
  }

  // Search → GET /api/v1/media?search={query} → { items, total, limit, offset }
  async search(
    query: string,
    options: Omit<BrowseMediaParams, 'search'> = {}
  ): Promise<MediaItem[]> {
    const res = await this.browseMedia({ search: query, ...options });
    return res.items;
  }
}

export const libraryManager = new LibraryManager();
export default libraryManager;
