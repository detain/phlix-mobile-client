/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/livetv.ts
//
// Live TV / EPG / DVR domain types (slice E8). The server's Live TV surface is
// ADMIN-gated (`/api/v1/admin/livetv/*`, AdminMiddleware) and is a REACH feature
// — most servers have no tuner configured. Field names are the server payload
// verbatim (snake_case); do NOT camelCase.
//
// Verified against `AdminLiveTvController` + the LiveTv module DTOs.

/** Channel kind. Mirrors the server `type` column. */
export type ChannelType = 'tv' | 'radio' | 'data';

/** Channel visibility. `enabled` (UI) maps to `visibility` on the server. */
export type ChannelVisibility = 'visible' | 'hidden' | 'deleted';

/** Recording lifecycle status. */
export type RecordingStatus =
  | 'pending'
  | 'recording'
  | 'completed'
  | 'failed';

/**
 * A tunable Live TV channel.
 * GET /admin/livetv/channels → { success, channels: Channel[] }
 */
export interface Channel {
  id: string;
  name: string;
  number: string | number;
  type: ChannelType;
  frequency?: number | null;
  icon_url?: string | null;
  visibility: ChannelVisibility;
}

/**
 * An EPG program (guide entry). `start_time` / `end_time` are UNIX SECONDS.
 * GET /admin/livetv/guide?channel_id=&from=&to= → { success, programs: Program[] }
 */
export interface Program {
  id: string;
  channel_id: string;
  title: string;
  description?: string | null;
  start_time: number;
  end_time: number;
  duration?: number | null;
  series_id?: string | null;
  is_repeat?: boolean;
  is_film?: boolean;
  rating?: string | null;
}

/**
 * A scheduled / completed DVR recording.
 * GET /admin/livetv/recordings → { success, recordings: Recording[] }
 */
export interface Recording {
  id: string;
  channel_id: string;
  title: string;
  start_time: number;
  end_time: number;
  status: RecordingStatus;
  program_id?: string | null;
  series_rule_id?: string | null;
}

/**
 * A series-recording rule.
 * GET /admin/livetv/series-rules → { success, rules: SeriesRule[] }
 */
export interface SeriesRule {
  id: string;
  series_id?: string | null;
  channel_id?: string | null;
  title: string;
  enabled?: boolean;
}

/** Body for POST /admin/livetv/recordings. */
export interface CreateRecordingInput {
  channel_id: string;
  title: string;
  start_time: number;
  end_time: number;
  program_id?: string;
  priority?: number;
}

/** Patch body for PUT /admin/livetv/channels/{id}. */
export interface UpdateChannelInput {
  name?: string;
  enabled?: boolean;
}

/** Optional filters for the guide query. */
export interface GuideQuery {
  channelId?: string;
  /** UNIX seconds; defaults to now on the server. */
  from?: number;
  /** UNIX seconds; defaults to now+7d on the server. */
  to?: number;
}

// ── Pure helpers (no I/O; unit-tested) ────────────────────────────────────────

/**
 * True when `nowSecs` falls within the program's air window
 * (`start_time <= nowSecs < end_time`). All values are UNIX seconds.
 */
export const programIsLive = (program: Program, nowSecs: number): boolean =>
  nowSecs >= program.start_time && nowSecs < program.end_time;

/**
 * Find the program currently airing on a channel, given a flat program list and
 * the current time (UNIX seconds). Returns `null` if nothing is live.
 */
export const currentProgram = (
  programs: Program[],
  nowSecs: number
): Program | null => programs.find((p) => programIsLive(p, nowSecs)) ?? null;

/**
 * Format a program's time range as a short local `HH:MM – HH:MM` label.
 * Times are UNIX seconds (×1000 → ms for `Date`).
 */
export const formatProgramTime = (program: Program): string => {
  const fmt = (secs: number): string => {
    const d = new Date(secs * 1000);
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };
  return `${fmt(program.start_time)} – ${fmt(program.end_time)}`;
};

/** Human label for a channel type. */
export const channelTypeLabel = (type: ChannelType): string => {
  switch (type) {
    case 'tv':
      return 'TV';
    case 'radio':
      return 'Radio';
    case 'data':
      return 'Data';
    default:
      return type;
  }
};
