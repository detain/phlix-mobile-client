// src/types/music.ts
//
// Music domain types (slice E9a). Field names are the server payload verbatim
// (snake_case) from `MusicController` — see the E9 worklog "VERIFIED SERVER
// CONTRACTS → MUSIC". Do NOT camelCase these.
//
// LANDMINE (worklog): `getArtists`/`getAlbums`/`getTracks`/`getTrack` return
// FLAT, formatTrack-normalized `Track` rows — BUT `album.tracks` (from the album
// endpoints) are RAW media-item rows whose track fields live under a `metadata`
// object, NOT flat. Hence `RawAlbumTrack` + the pure `normalizeAlbumTrack`
// adapter below. Only the *album* endpoints return raw tracks.

/** Aggregated across all music libraries (no library_id scoping server-side). */
export interface Artist {
  name: string;
  album_count: number;
  track_count: number;
  /** Album NAME strings only (NOT album objects). */
  albums: string[];
}

/** A flat, formatTrack-normalized track (from list/getTrack endpoints). */
export interface Track {
  id: string;
  name: string;
  artist: string | null;
  album: string | null;
  album_artist: string | null;
  year: number | null;
  genre: string | null;
  track_number: number | null;
  disc_number: number | null;
  duration_secs: number | null;
  composer: string | null;
  path: string;
}

/**
 * A RAW media-item row as returned inside `album.tracks` (NOT flat). Top-level
 * track fields may instead live under `metadata.*`. Loose by design — read via
 * `normalizeAlbumTrack`.
 */
export interface RawAlbumTrack {
  id: string;
  name?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Album {
  name: string;
  artist: string;
  year: number | null;
  track_count: number;
  /** RAW media-item rows — normalize with `normalizeAlbumTrack`. */
  tracks: RawAlbumTrack[];
}

export interface NowPlaying {
  track: Track;
  /** Session `position_ticks` (treated as 100ns ticks); display-only. */
  position: number;
  state: string;
  session_id: string;
}

/** Coerce an unknown value to a string or null. */
const toStringOrNull = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

/** Coerce an unknown value to a finite number or null. */
const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/**
 * Normalize a RAW album-track row into a flat `Track`. Reads each field from the
 * row top-level FIRST, then falls back to `raw.metadata.*`. `name` is
 * `metadata.title ?? raw.name ?? ''`. All numeric fields are coerced safely.
 */
export const normalizeAlbumTrack = (raw: RawAlbumTrack): Track => {
  const meta: Record<string, unknown> = raw.metadata ?? {};

  const str = (key: string): string | null =>
    toStringOrNull(raw[key]) ?? toStringOrNull(meta[key]);

  const num = (key: string): number | null => {
    const top = toNumberOrNull(raw[key]);
    return top !== null ? top : toNumberOrNull(meta[key]);
  };

  const name =
    toStringOrNull(meta.title) ?? toStringOrNull(raw.name) ?? '';

  return {
    id: raw.id,
    name,
    artist: str('artist'),
    album: str('album'),
    album_artist: str('album_artist'),
    year: num('year'),
    genre: str('genre'),
    track_number: num('track_number'),
    disc_number: num('disc_number'),
    duration_secs: num('duration_secs'),
    composer: str('composer'),
    path: toStringOrNull(raw.path) ?? toStringOrNull(meta.path) ?? '',
  };
};

/**
 * Stable sort by `disc_number` then `track_number`, nulls last. Returns a NEW
 * array (does not mutate the input).
 */
export const sortTracks = (tracks: Track[]): Track[] => {
  // null → +Infinity so it sorts last; stable via index tiebreak.
  const ord = (n: number | null): number =>
    n === null ? Number.POSITIVE_INFINITY : n;

  return tracks
    .map((track, index) => ({ track, index }))
    .sort((a, b) => {
      const discDiff = ord(a.track.disc_number) - ord(b.track.disc_number);
      if (discDiff !== 0) {
        return discDiff;
      }
      const trackDiff = ord(a.track.track_number) - ord(b.track.track_number);
      if (trackDiff !== 0) {
        return trackDiff;
      }
      return a.index - b.index;
    })
    .map((entry) => entry.track);
};
