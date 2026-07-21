/**
 * Media-type helpers, keyed on the `media_items.type` ENUM.
 *
 * The ENUM has THIRTEEN members:
 *
 *     movie, series, season, episode, track, music, album, artist,
 *     video, audio, book, photo, audiobook
 *
 * There is no `image` member — that is a scanner-side label for a file-extension
 * set, and the column calls the same concept `photo`.
 *
 * These exist because the screens were gating on ad-hoc negations
 * (`!isSeries`) and two-way ternaries (`type === 'movie' ? … : 'Episode'`),
 * which are wrong for 11 of the 13 members. An allowlist is used rather than a
 * denylist for the same reason the Roku client's `PlayableTypes()` does: an
 * unknown or newly-added type is then treated as NOT playable, which degrades
 * to a missing button rather than a button that dead-ends.
 */
import type { MediaType } from '../types/media';

/**
 * Types that have a stream of their own and can therefore be played.
 *
 * Deliberately excluded: `series`/`season`/`album`/`artist`/`music` are
 * CONTAINERS — they drill down to children and have no stream; `book` and
 * `photo` carry no audio or video track at all.
 *
 * Kept in step with the Roku client's `PlayableTypes()` allowlist
 * (`phlix-roku-client/source/lib/Utilities.brs`).
 */
export const PLAYABLE_TYPES: readonly MediaType[] = [
  'movie',
  'episode',
  'video',
  'audio',
  'track',
  'audiobook',
];

/**
 * Is this a playable leaf type? Unknown input is never playable.
 */
export const isPlayableType = (type: unknown): boolean =>
  typeof type === 'string' && PLAYABLE_TYPES.includes(type.trim().toLowerCase() as MediaType);

/**
 * Is this type downloadable for offline playback?
 *
 * Same set as playable: a download is a fetch of the item's own stream, so
 * anything without a stream cannot be downloaded either. Kept as a separate
 * named export so the two can diverge later without hunting call sites.
 */
export const isDownloadableType = (type: unknown): boolean => isPlayableType(type);

/**
 * Human-readable singular label for every ENUM member.
 *
 * Replaces `type === 'movie' ? 'Movie' : 'Episode'`, which labelled 11 of the
 * 13 members "Episode" — including tracks, audiobooks, books and photos.
 */
const TYPE_LABELS: Record<MediaType, string> = {
  movie: 'Movie',
  series: 'Series',
  season: 'Season',
  episode: 'Episode',
  track: 'Track',
  music: 'Music',
  album: 'Album',
  artist: 'Artist',
  video: 'Video',
  audio: 'Audio',
  book: 'Book',
  photo: 'Photo',
  audiobook: 'Audiobook',
};

/**
 * Display label for a media type, falling back to a capitalised form of an
 * unrecognised value rather than mislabelling it.
 */
export const mediaTypeLabel = (type: unknown): string => {
  if (typeof type !== 'string' || type === '') {
    return 'Item';
  }
  const key = type.trim().toLowerCase() as MediaType;
  return TYPE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
};
