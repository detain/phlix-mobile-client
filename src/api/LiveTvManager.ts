/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/LiveTvManager.ts
import axios from 'axios';
import apiClient, { getApiBaseUrl, buildRequestHeaders } from './client';
import type {
  Channel,
  Program,
  Recording,
  SeriesRule,
  CreateRecordingInput,
  UpdateChannelInput,
  GuideQuery,
} from '../types/livetv';

/**
 * Live TV / EPG / DVR API surface (slice E8).
 *
 * EVERY route here is admin-gated on the server (AdminMiddleware,
 * `users.is_admin=1`) AND the route group is a REACH feature wrapped in
 * try/catch ("LiveTV admin not configured — silent ignore") — most servers have
 * NO tuner. Callers MUST gate on `useAuthStore.user.is_admin`, and the store
 * treats 404/500 from these routes as "not configured" (see
 * `isNotConfiguredError`) rather than a hard error.
 *
 * The apiClient baseURL already adds `/api/v1`, so paths start `/admin/livetv`.
 *
 * Envelopes are BARE `{ success, <key> }` (verified against AdminLiveTvController):
 *   - channels    → { success, channels } / { success, channel }
 *   - guide        → { success, programs } / { success, program }
 *   - recordings   → { success, recordings } / { success, recording }
 *   - series-rules → { success, rules }
 *
 * Field names are the server payload verbatim (snake_case); do NOT camelCase.
 */

/** A raw `{ success, location }` shape is NOT used — stream resolve is manual fetch. */

/**
 * True when an error from a Live TV route means "Live TV is not configured on
 * this server" (no tuner / the route group silently no-ops) rather than a real
 * failure. The server returns 404 (route not mounted) or 500 (manager throws on
 * a missing tuner). Network errors are NOT treated as not-configured.
 */
export const isNotConfiguredError = (error: unknown): boolean => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return status === 404 || status === 500;
  }
  return false;
};

class LiveTvManager {
  // ── Channels ──────────────────────────────────────────────────────────────

  // GET /api/v1/admin/livetv/channels → { success, channels }
  async getChannels(): Promise<Channel[]> {
    const res = await apiClient.get<{ success: boolean; channels: Channel[] }>(
      '/admin/livetv/channels'
    );
    return res.channels;
  }

  // GET /api/v1/admin/livetv/channels/{id} → { success, channel }
  async getChannel(id: string): Promise<Channel> {
    const res = await apiClient.get<{ success: boolean; channel: Channel }>(
      `/admin/livetv/channels/${id}`
    );
    return res.channel;
  }

  // PUT /api/v1/admin/livetv/channels/{id} → { success, channel }
  async updateChannel(id: string, input: UpdateChannelInput): Promise<Channel> {
    const res = await apiClient.put<{ success: boolean; channel: Channel }>(
      `/admin/livetv/channels/${id}`,
      input
    );
    return res.channel;
  }

  /**
   * Resolve the playable stream URL for a channel.
   *
   * `GET /admin/livetv/channels/{id}/stream` is admin-Bearer-gated and
   * 302-redirects to the tuner's HLS URL (NOT JSON). The native `<video>` player
   * can't carry a Bearer, and axios silently follows redirects, so we issue a
   * RAW `fetch` with `redirect: 'manual'` and read the `location` header.
   *
   * If `location` is unavailable (React Native often surfaces an opaque
   * redirect with empty headers), FALL BACK to returning the absolute
   * stream-endpoint URL itself — the native player will follow the redirect.
   *
   * CAVEAT (flagged upstream): the resolved tuner URL must be directly playable.
   * If it still requires auth, that is an upstream gap — the server should
   * expose a `GET .../stream-url` JSON route or a signed-livetv-url.
   */
  async getChannelStreamUrl(id: string): Promise<string> {
    const endpointUrl = `${getApiBaseUrl()}/admin/livetv/channels/${id}/stream`;
    try {
      const headers = await buildRequestHeaders();
      const response = await fetch(endpointUrl, {
        method: 'GET',
        redirect: 'manual',
        headers,
      });
      const location =
        response.headers.get('location') ?? response.headers.get('Location');
      if (location && location.trim() !== '') {
        return location;
      }
    } catch {
      // Network/opaque-redirect failure: fall through to the endpoint URL so the
      // native player can attempt the follow itself.
    }
    return endpointUrl;
  }

  // ── Guide / EPG ─────────────────────────────────────────────────────────────

  // GET /api/v1/admin/livetv/guide?channel_id=&from=&to= → { success, programs }
  async getGuide(query: GuideQuery = {}): Promise<Program[]> {
    const params: Record<string, string | number> = {};
    if (query.channelId !== undefined) {
      params.channel_id = query.channelId;
    }
    if (query.from !== undefined) {
      params.from = query.from;
    }
    if (query.to !== undefined) {
      params.to = query.to;
    }
    const res = await apiClient.get<{ success: boolean; programs: Program[] }>(
      '/admin/livetv/guide',
      params
    );
    return res.programs;
  }

  // GET /api/v1/admin/livetv/guide/programs/{id} → { success, program }
  async getProgram(id: string): Promise<Program> {
    const res = await apiClient.get<{ success: boolean; program: Program }>(
      `/admin/livetv/guide/programs/${id}`
    );
    return res.program;
  }

  // POST /api/v1/admin/livetv/guide/refresh → { success, ... }
  async refreshGuide(): Promise<void> {
    await apiClient.post<{ success: boolean }>('/admin/livetv/guide/refresh');
  }

  // ── Recordings (DVR) ─────────────────────────────────────────────────────────

  // GET /api/v1/admin/livetv/recordings?status= → { success, recordings }
  async getRecordings(status?: string): Promise<Recording[]> {
    const res = await apiClient.get<{ success: boolean; recordings: Recording[] }>(
      '/admin/livetv/recordings',
      status ? { status } : undefined
    );
    return res.recordings;
  }

  // GET /api/v1/admin/livetv/recordings/upcoming → { success, recordings }
  async getUpcomingRecordings(): Promise<Recording[]> {
    const res = await apiClient.get<{ success: boolean; recordings: Recording[] }>(
      '/admin/livetv/recordings/upcoming'
    );
    return res.recordings;
  }

  // GET /api/v1/admin/livetv/recordings/{id} → { success, recording }
  async getRecording(id: string): Promise<Recording> {
    const res = await apiClient.get<{ success: boolean; recording: Recording }>(
      `/admin/livetv/recordings/${id}`
    );
    return res.recording;
  }

  // POST /api/v1/admin/livetv/recordings → { success, recording }
  async createRecording(input: CreateRecordingInput): Promise<Recording> {
    const res = await apiClient.post<{ success: boolean; recording: Recording }>(
      '/admin/livetv/recordings',
      input
    );
    return res.recording;
  }

  // DELETE /api/v1/admin/livetv/recordings/{id} → { success }
  async deleteRecording(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean; message?: string }>(
      `/admin/livetv/recordings/${id}`
    );
  }

  // ── Series Rules ─────────────────────────────────────────────────────────────

  // GET /api/v1/admin/livetv/series-rules → { success, rules }
  async getSeriesRules(): Promise<SeriesRule[]> {
    const res = await apiClient.get<{ success: boolean; rules: SeriesRule[] }>(
      '/admin/livetv/series-rules'
    );
    return res.rules;
  }
}

export const liveTvManager = new LiveTvManager();
export default liveTvManager;
