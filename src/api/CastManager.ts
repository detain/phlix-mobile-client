/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/CastManager.ts
import apiClient from './client';
import {
  canResume,
  canSeek,
  canStop,
  normalizeAirplay,
  normalizeChromecast,
  normalizeDlna,
  normalizeRoku,
  normalizeSession,
  normalizeStatus,
  type AirplayDeviceDto,
  type CastDevice,
  type CastSession,
  type CastStatus,
  type CastSessionDto,
  type CastStatusDto,
  type ChromecastDeviceDto,
  type DlnaRendererDto,
  type RokuDeviceDto,
} from '../types/cast';

/**
 * Server-mediated Cast (slice E7). Mirrors the console CastClient.
 *
 * The server exposes FOUR independent backends — Chromecast / Roku / AirPlay /
 * DLNA — each as its own discover → send → transport route set. There is no
 * native local Cast SDK: every method here is a plain HTTP call the server
 * relays to the device. The apiClient baseURL already adds `/api/v1`, so paths
 * start `/cast`, `/roku`, `/airplay`, `/dlna`.
 *
 * REQUEST BODIES use the EXACT server snake_case field names (media_url,
 * audio_url, uri, media_item_id, position_ms, position_ticks, …). Capability
 * gates (canResume/canStop/canSeek) are honored: an unsupported transport call
 * is a no-op — we NEVER fire a request the backend cannot serve.
 */

/** What to send to a device. `mediaUrl` is the signed direct-play stream URL. */
export interface CastMediaInput {
  mediaItemId: string;
  /** Signed stream URL (used as media_url / audio_url / uri per backend). */
  mediaUrl: string;
  mimeType?: string;
  title?: string;
  thumbnail?: string;
  durationSecs?: number;
}

/** DLNA position ticks are 100ns? No — server DLNA ticks = ms × 10000. */
const POSITION_TICKS_PER_MS = 10000;

/** Discovery envelopes per backend. */
interface CastDevicesEnvelope {
  devices?: ChromecastDeviceDto[];
  count?: number;
}
interface RokuDevicesEnvelope {
  devices?: RokuDeviceDto[];
  count?: number;
}
interface AirplayDevicesEnvelope {
  devices?: AirplayDeviceDto[];
  count?: number;
}
interface DlnaRenderersEnvelope {
  renderers?: DlnaRendererDto[];
  count?: number;
}

class CastManager {
  // ── Discovery (fault-tolerant fan-out) ───────────────────────────────────

  // GET /api/v1/cast/devices → { devices, count }
  private async discoverChromecast(): Promise<CastDevice[]> {
    try {
      const res = await apiClient.get<CastDevicesEnvelope>('/cast/devices');
      return (res.devices ?? []).map(normalizeChromecast);
    } catch {
      return [];
    }
  }

  // GET /api/v1/roku/devices → { devices, count }
  private async discoverRoku(): Promise<CastDevice[]> {
    try {
      const res = await apiClient.get<RokuDevicesEnvelope>('/roku/devices');
      return (res.devices ?? []).map(normalizeRoku);
    } catch {
      return [];
    }
  }

  // GET /api/v1/airplay/devices → { devices, count }
  private async discoverAirplay(): Promise<CastDevice[]> {
    try {
      const res = await apiClient.get<AirplayDevicesEnvelope>('/airplay/devices');
      return (res.devices ?? []).map(normalizeAirplay);
    } catch {
      return [];
    }
  }

  // GET /api/v1/dlna/renderers → { renderers, count }
  private async discoverDlna(): Promise<CastDevice[]> {
    try {
      const res = await apiClient.get<DlnaRenderersEnvelope>('/dlna/renderers');
      return (res.renderers ?? []).map(normalizeDlna);
    } catch {
      return [];
    }
  }

  /**
   * Discover all four backends concurrently. Each leg swallows its own error
   * (→ []), so one unreachable backend never blanks the others. Returns the
   * merged, normalized device list.
   */
  async discover(): Promise<CastDevice[]> {
    const results = await Promise.all([
      this.discoverChromecast(),
      this.discoverRoku(),
      this.discoverAirplay(),
      this.discoverDlna(),
    ]);
    return results.flat();
  }

  // ── Send / play ──────────────────────────────────────────────────────────

  /**
   * Cast media to a device, dispatched per backend to the correct route + body.
   *   - Chromecast POST /cast/devices/{id}/cast    { media_url, mime_type, title?, duration? }
   *   - Roku       POST /roku/devices/{id}/send     { media_url, mime_type, title?, thumbnail? }
   *   - AirPlay    POST /airplay/devices/{id}/stream { audio_url, content_type, duration? }
   *   - DLNA       POST /dlna/renderers/{id}/play    { media_item_id, uri, metadata? }
   */
  async castTo(device: CastDevice, media: CastMediaInput): Promise<CastSession> {
    switch (device.backend) {
      case 'chromecast': {
        const res = await apiClient.post<CastSessionDto>(
          `/cast/devices/${device.id}/cast`,
          {
            media_url: media.mediaUrl,
            mime_type: media.mimeType ?? 'application/x-mpegurl',
            ...(media.title != null ? { title: media.title } : {}),
            ...(media.durationSecs != null ? { duration: media.durationSecs } : {}),
          }
        );
        return normalizeSession(res);
      }
      case 'roku': {
        const res = await apiClient.post<CastSessionDto>(
          `/roku/devices/${device.id}/send`,
          {
            media_url: media.mediaUrl,
            mime_type: media.mimeType ?? 'application/x-mpegurl',
            ...(media.title != null ? { title: media.title } : {}),
            ...(media.thumbnail != null ? { thumbnail: media.thumbnail } : {}),
          }
        );
        return normalizeSession(res);
      }
      case 'airplay': {
        const res = await apiClient.post<CastSessionDto>(
          `/airplay/devices/${device.id}/stream`,
          {
            audio_url: media.mediaUrl,
            content_type: media.mimeType ?? 'audio/mp4',
            ...(media.durationSecs != null ? { duration: media.durationSecs } : {}),
          }
        );
        return normalizeSession(res);
      }
      case 'dlna': {
        const res = await apiClient.post<CastSessionDto>(
          `/dlna/renderers/${device.id}/play`,
          {
            media_item_id: media.mediaItemId,
            uri: media.mediaUrl,
            ...(media.title != null ? { metadata: { title: media.title } } : {}),
          }
        );
        return normalizeSession(res);
      }
      default:
        throw new Error(`Unsupported cast backend: ${device.backend as string}`);
    }
  }

  // ── Transport (capability-gated) ──────────────────────────────────────────

  /**
   * Pause. Roku has no pause endpoint — it toggles via key/Play (the same key
   * resumes), which we use for both pause and resume.
   */
  async pause(device: CastDevice): Promise<void> {
    switch (device.backend) {
      case 'chromecast':
        await apiClient.post(`/cast/devices/${device.id}/pause`);
        break;
      case 'roku':
        await apiClient.post(`/roku/devices/${device.id}/key/Play`);
        break;
      case 'airplay':
        await apiClient.post(`/airplay/devices/${device.id}/pause`);
        break;
      case 'dlna':
        await apiClient.post(`/dlna/renderers/${device.id}/pause`);
        break;
      default:
        break;
    }
  }

  /**
   * Resume. DLNA has NO resume endpoint (canResume false) → no-op. Roku toggles
   * via the same key/Play.
   */
  async resume(device: CastDevice): Promise<void> {
    if (!canResume(device.backend)) {
      // DLNA: no resume endpoint — never fire.
      return;
    }
    switch (device.backend) {
      case 'chromecast':
        await apiClient.post(`/cast/devices/${device.id}/play`);
        break;
      case 'roku':
        await apiClient.post(`/roku/devices/${device.id}/key/Play`);
        break;
      case 'airplay':
        await apiClient.post(`/airplay/devices/${device.id}/resume`);
        break;
      default:
        break;
    }
  }

  /** Stop. Roku has no reliable stop key (canStop false) → no-op. */
  async stop(device: CastDevice): Promise<void> {
    if (!canStop(device.backend)) {
      // Roku: no reliable stop key — never fire.
      return;
    }
    switch (device.backend) {
      case 'chromecast':
        await apiClient.post(`/cast/devices/${device.id}/stop`);
        break;
      case 'airplay':
        await apiClient.post(`/airplay/devices/${device.id}/stop`);
        break;
      case 'dlna':
        await apiClient.post(`/dlna/renderers/${device.id}/stop`);
        break;
      default:
        break;
    }
  }

  /**
   * Seek. Only Chromecast + DLNA support it (canSeek). Chromecast takes
   * `position_ms`; DLNA takes `position_ticks` (ms × 10000). Roku/AirPlay no-op.
   */
  async seek(device: CastDevice, positionMs: number): Promise<void> {
    if (!canSeek(device.backend)) {
      // Roku / AirPlay: cannot seek — never fire.
      return;
    }
    switch (device.backend) {
      case 'chromecast':
        await apiClient.post(`/cast/devices/${device.id}/seek`, {
          position_ms: positionMs,
        });
        break;
      case 'dlna':
        await apiClient.post(`/dlna/renderers/${device.id}/seek`, {
          position_ticks: positionMs * POSITION_TICKS_PER_MS,
        });
        break;
      default:
        break;
    }
  }

  /**
   * Live transport status for a device.
   *   - Chromecast GET /cast/devices/{id}/status
   *   - Roku       GET /roku/devices/{id}/status
   *   - AirPlay    GET /airplay/devices/{id}/status
   *   - DLNA       GET /dlna/renderers/{id}/status
   */
  async status(device: CastDevice): Promise<CastStatus> {
    let dto: CastStatusDto;
    switch (device.backend) {
      case 'chromecast':
        dto = await apiClient.get<CastStatusDto>(`/cast/devices/${device.id}/status`);
        break;
      case 'roku':
        dto = await apiClient.get<CastStatusDto>(`/roku/devices/${device.id}/status`);
        break;
      case 'airplay':
        dto = await apiClient.get<CastStatusDto>(`/airplay/devices/${device.id}/status`);
        break;
      case 'dlna':
        dto = await apiClient.get<CastStatusDto>(`/dlna/renderers/${device.id}/status`);
        break;
      default:
        return { active: false };
    }
    return normalizeStatus(dto);
  }
}

export const castManager = new CastManager();
export default castManager;
