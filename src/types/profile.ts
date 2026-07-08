/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/types/profile.ts
//
// Multi-user profile types (slice E5). Field names mirror the SERVER's profile
// DTO verbatim (snake_case) — the same shape returned by the admin-gated routes
// `GET /api/v1/admin/users/{userId}/profiles` and `GET /api/v1/admin/profiles/{id}`.
//
// NOTE: there is currently NO user-facing `/api/v1/users/me/profiles` route, so
// mobile profile management is admin-scoped (gated on `users.is_admin`). See the
// upstream-gap flag in the README / CLAUDE.md.

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

/** Body for creating a profile (`POST /admin/users/{userId}/profiles`). */
export interface CreateProfileInput {
  name: string;
  /** Integer 0–6 (see `ratingToLabel`). Optional; server defaults when omitted. */
  rating?: number;
}

/** Body for updating a profile (`PUT /admin/profiles/{id}`). */
export interface UpdateProfileInput {
  name?: string;
  /** Integer 0–6 (see `ratingToLabel`). */
  rating?: number;
}

/**
 * Rating int → label map. The server encodes a profile's max content rating as
 * an integer on create/update (0=G … 6=UNRATED) but returns the LABEL inside
 * `settings.content_rating`. These helpers convert between the two forms.
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
