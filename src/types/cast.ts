/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/types/cast.ts
//
// Server-mediated Cast (slice E7). The server exposes four independent cast
// backends — Chromecast, Roku, AirPlay, DLNA — as discover → send → transport
// HTTP routes. There is NO native local Cast SDK in the mobile client today;
// every cast operation is a plain HTTP call the server proxies to the device.
//
// This module holds the NORMALIZED client-side shapes (camelCase) plus PURE,
// unit-testable capability helpers and per-backend DTO → normalized mappers.
// The wire REQUEST bodies (snake_case) live in CastManager — only the
// normalized read-models live here.

/** The four server cast backends. */
export type CastBackend = 'chromecast' | 'roku' | 'airplay' | 'dlna';

/** Stable list for iteration / fan-out / UI grouping. */
export const CAST_BACKENDS: readonly CastBackend[] = [
  'chromecast',
  'roku',
  'airplay',
  'dlna',
];

/** Human label for a backend (UI grouping headers). */
export const backendLabel = (backend: CastBackend): string => {
  switch (backend) {
    case 'chromecast':
      return 'Chromecast';
    case 'roku':
      return 'Roku';
    case 'airplay':
      return 'AirPlay';
    case 'dlna':
      return 'DLNA';
    default:
      return backend;
  }
};

/**
 * Normalized cast device. Per-backend the server uses different id/name keys
 * (`device_id` vs `udn`, `name` vs `friendly_name`); the manager normalizes
 * them into this shape so the store/screen never branch on backend for display.
 */
export interface CastDevice {
  backend: CastBackend;
  /** Path id used in routes (`device_id` for cast/roku/airplay, `udn` for dlna). */
  id: string;
  name: string;
  model?: string;
  /** Free-form secondary line (host:port, manufacturer, software version). */
  detail?: string;
  /** AirPlay video support flag; undefined when unknown/irrelevant. */
  supportsVideo?: boolean;
}

/** Normalized device transport status (from the `/status` endpoints). */
export interface CastStatus {
  active: boolean;
  state?: string;
  sessionId?: string;
}

/** Result of a successful `castTo` (send) call. */
export interface CastSession {
  sessionId?: string;
  deviceId?: string;
  state?: string;
}

// ── Capability gates (mirror the console CastBackend exactly) ──────────────
//
// NEVER fire an unsupported transport call — the screen/store consult these
// PURE helpers and no-op the disabled controls.

/** Resume is supported on every backend EXCEPT DLNA (no resume endpoint). */
export const canResume = (backend: CastBackend): boolean => backend !== 'dlna';

/** Stop is supported on every backend EXCEPT Roku (no reliable stop key). */
export const canStop = (backend: CastBackend): boolean => backend !== 'roku';

/** Seek is supported ONLY on Chromecast and DLNA. */
export const canSeek = (backend: CastBackend): boolean =>
  backend === 'chromecast' || backend === 'dlna';

// ── Raw server DTOs (snake_case, per-backend key differences) ──────────────

export interface ChromecastDeviceDto {
  device_id: string;
  name?: string;
  host?: string;
  port?: number;
  model?: string;
  address?: string;
}

export interface RokuDeviceDto {
  device_id: string;
  name?: string;
  host?: string;
  port?: number;
  model?: string;
  software_version?: string;
  address?: string;
}

export interface AirplayDeviceDto {
  device_id: string;
  name?: string;
  host?: string;
  port?: number;
  raop_port?: number;
  model?: string;
  supports_video?: boolean;
}

export interface DlnaRendererDto {
  udn: string;
  friendly_name?: string;
  host?: string;
  port?: number;
  model_name?: string;
  manufacturer?: string;
  has_active_session?: boolean;
  session_state?: string;
  session_position?: number;
}

/** Raw `/status` payload shared across backends (loose — keys vary). */
export interface CastStatusDto {
  device_id?: string;
  renderer_id?: string;
  active?: boolean;
  has_active_session?: boolean;
  state?: string;
  session_state?: string;
  session_id?: string;
  media_status?: unknown;
}

/** Raw send/play response shared across backends. */
export interface CastSessionDto {
  session_id?: string;
  device_id?: string;
  renderer_id?: string;
  state?: string;
}

// ── Pure normalization fns (one per backend) ──────────────────────────────

const hostDetail = (host?: string, port?: number): string | undefined => {
  if (!host) {
    return undefined;
  }
  return typeof port === 'number' ? `${host}:${port}` : host;
};

export const normalizeChromecast = (dto: ChromecastDeviceDto): CastDevice => ({
  backend: 'chromecast',
  id: dto.device_id,
  name: dto.name ?? dto.model ?? dto.device_id,
  model: dto.model,
  detail: hostDetail(dto.host ?? dto.address, dto.port),
});

export const normalizeRoku = (dto: RokuDeviceDto): CastDevice => ({
  backend: 'roku',
  id: dto.device_id,
  name: dto.name ?? dto.model ?? dto.device_id,
  model: dto.model,
  detail:
    dto.software_version != null
      ? `${hostDetail(dto.host ?? dto.address, dto.port) ?? ''}${
          hostDetail(dto.host ?? dto.address, dto.port) ? ' · ' : ''
        }v${dto.software_version}`
      : hostDetail(dto.host ?? dto.address, dto.port),
});

export const normalizeAirplay = (dto: AirplayDeviceDto): CastDevice => ({
  backend: 'airplay',
  id: dto.device_id,
  name: dto.name ?? dto.model ?? dto.device_id,
  model: dto.model,
  detail: hostDetail(dto.host, dto.port),
  supportsVideo: dto.supports_video,
});

export const normalizeDlna = (dto: DlnaRendererDto): CastDevice => ({
  backend: 'dlna',
  id: dto.udn,
  name: dto.friendly_name ?? dto.model_name ?? dto.udn,
  model: dto.model_name,
  detail:
    dto.manufacturer != null
      ? `${hostDetail(dto.host, dto.port) ?? ''}${
          hostDetail(dto.host, dto.port) ? ' · ' : ''
        }${dto.manufacturer}`
      : hostDetail(dto.host, dto.port),
});

/**
 * Normalize a `/status` payload. DLNA uses `has_active_session` +
 * `session_state`; the others use `active` + `state`. `renderer_id` (DLNA)
 * and `device_id` both map to nothing structural here — only the active flag,
 * state and session id surface.
 */
export const normalizeStatus = (dto: CastStatusDto): CastStatus => ({
  active: Boolean(dto.active ?? dto.has_active_session ?? false),
  state: dto.state ?? dto.session_state,
  sessionId: dto.session_id,
});

/** Normalize a send/play response. */
export const normalizeSession = (dto: CastSessionDto): CastSession => ({
  sessionId: dto.session_id,
  deviceId: dto.device_id ?? dto.renderer_id,
  state: dto.state,
});
