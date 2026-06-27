// src/types/media.ts
//
// DIVERGENCE (reconcile in E2): these local types are kept AS-IS in E1. mobile's
// `MediaItem.type` / `Library.type` use `'music' | 'photo'`, while the shared
// `@phlix/contracts` `MediaType` uses `'audio' | 'image'` (plus
// `season | episode`). A blind `export * from '@phlix/contracts'` here would
// break every `=== 'music'` / `=== 'photo'` comparison in the app, so the full
// MediaType/MediaItem consolidation is deferred to E2 (done with the API rewrite
// and verified against a live server). See `src/types/contracts.ts` for the
// safe, non-divergent contracts surface adopted in E1.
export interface MediaItem {
  id: string;
  name: string;
  type: 'movie' | 'series' | 'music' | 'photo';
  overview?: string;
  poster_url?: string;
  backdrop_url?: string;
  year?: number;
  official_rating?: string;
  run_time_ticks?: number;
  genres?: string[];
  user_data?: UserData;
}

export interface UserData {
  playback_position_ticks?: number;
  resume_position_ticks?: number;
  is_watched?: boolean;
  rating?: number;
  favorite?: boolean;
}

export interface Series extends MediaItem {
  type: 'series';
  series_name?: string;
}

export interface Season {
  id: string;
  series_id: string;
  name: string;
  overview?: string;
  poster_url?: string;
  season_number: number;
  episode_count: number;
}

export interface Episode {
  id: string;
  season_id: string;
  series_id: string;
  name: string;
  overview?: string;
  poster_url?: string;
  episode_number: number;
  season_number: number;
  run_time_ticks?: number;
  user_data?: UserData;
}

export interface Movie extends MediaItem {
  type: 'movie';
}

export interface Library {
  id: string;
  name: string;
  type: 'movie' | 'series' | 'music' | 'photo';
  display_order: number;
  artwork: {
    poster: string;
    backdrop: string;
  };
}
