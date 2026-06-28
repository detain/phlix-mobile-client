// src/types/collection.ts
//
// Collections domain (slice E10a). A collection is a named grouping of media
// items within a single library. It may be MANUAL (items added/removed by hand)
// or SMART (`is_smart === true`, backed by a saved smart-playlist that the
// server evaluates — items can't be hand-edited, only refreshed).
//
// Field names are the server payload verbatim (snake_case); do NOT camelCase.
// See `CollectionController` (phlix-server) and the E10-remaining worklog.

/**
 * A media collection. `smart_playlist_id`/`parent_id` are null for a plain
 * manual top-level collection. `is_smart` is the convenience flag the server
 * derives from `smart_playlist_id` (smart collections cannot have items
 * added/removed by hand — they are evaluated from the saved playlist).
 */
export interface Collection {
  id: string;
  name: string;
  library_id: string;
  smart_playlist_id: string | null;
  parent_id: string | null;
  sort_order: number;
  is_smart: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Body for `POST /collections`. `name` + `library_id` are required; the rest are
 * optional. Pass `smart_playlist_id` to create a smart collection bound to a
 * saved smart-playlist.
 */
export interface CreateCollectionInput {
  name: string;
  library_id: string;
  smart_playlist_id?: string;
  parent_id?: string;
  sort_order?: number;
}

/**
 * Body for `PUT /collections/{id}` — all fields optional (partial update). Only
 * the supplied keys are changed server-side.
 */
export interface UpdateCollectionInput {
  name?: string;
  library_id?: string;
  smart_playlist_id?: string | null;
  parent_id?: string | null;
  sort_order?: number;
}
