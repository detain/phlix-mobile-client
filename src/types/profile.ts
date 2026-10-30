/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/profile.ts
//
// Multi-user profile types (slice E5). Field names mirror the SERVER's profile
// DTO verbatim (snake_case) — the same shape returned by the self-service
// routes `GET /api/v1/profiles` and `GET /api/v1/profiles/{profileId}`
// (repointed from the admin-scoped lane by review M-MOBILE-07; the server
// registers both surfaces — mobile uses the caller's-own one).

/** Content rating label as stored on a profile's settings (server `content_rating`). */
export type ContentRatingLabel = 'G' | 'PG' | 'PG-13' | 'R' | 'NC-17' | 'X' | 'UNRATED';

/**
 * Per-profile settings (server `settings` sub-object). All fields are optional —
 * a freshly created profile or an older server may omit any of them.
 */
export interface ProfileSettings {
  content_rating?: ContentRatingLabel;
  pin_required_for_admin?: boolean;
  max_daily_watch_time?: number;
  allow_unrated?: boolean;
  allowed_genres?: string[];
  blocked_genres?: string[];
}

/** A user profile (server profile DTO). */
export interface Profile {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string | null;
  updated_at: string | null;
  settings?: ProfileSettings;
}

/**
 * Body for creating a profile (`POST /api/v1/profiles`, self-service). The
 * server trims the name and mints settings defaults; optional fields are sent
 * only when set.
 */
export interface CreateProfileInput {
  name: string;
  content_rating?: ContentRatingLabel;
  /** 4- or 6-digit numeric PIN, applied at creation. */
  pin?: string;
  pin_required_for_admin?: boolean;
}

/**
 * Body for updating a profile (`PUT /api/v1/profiles/{profileId}`,
 * self-service). Partial: only present keys change. `is_active` is REJECTED
 * (400) by the server — activation is the separate switch route.
 */
export interface UpdateProfileInput {
  name?: string;
  content_rating?: ContentRatingLabel;
  pin_required_for_admin?: boolean;
}

/**
 * Rating int → label map. The ADMIN routes (`/api/v1/admin/profiles...`)
 * encode a profile's max content rating as an integer on create/update
 * (0=G … 6=UNRATED) while the self-service lane and all GETs carry the LABEL;
 * these helpers convert between the two forms.
 */
const RATING_LABELS: readonly ContentRatingLabel[] = [
  'G', // 0
  'PG', // 1
  'PG-13', // 2
  'R', // 3
  'NC-17', // 4
  'X', // 5
  'UNRATED', // 6
];

/** Convert a rating integer (0–6) to its label. Out-of-range falls back to UNRATED. */
export const ratingToLabel = (n: number): ContentRatingLabel => {
  return RATING_LABELS[n] ?? 'UNRATED';
};

/** Convert a rating label to its integer (0–6). Unknown labels fall back to 6 (UNRATED). */
export const labelToRating = (s: string): number => {
  const idx = RATING_LABELS.indexOf(s as ContentRatingLabel);
  return idx >= 0 ? idx : 6;
};
