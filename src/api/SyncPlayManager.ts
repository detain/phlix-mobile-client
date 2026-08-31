/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/SyncPlayManager.ts
import apiClient, { getApiBaseUrl } from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * SyncPlay Room DTOs matching phlix-server API contract.
 *
 * ⚠ S280 wire correction: the mobile client used to call `/syncplay/rooms`
 * (and a `DELETE …/leave`) — routes phlix-server NEVER registered. The whole
 * HTTP surface is five `/syncplay/groups` rails (verified against
 * `SyncPlayController` + the vendored `server-route-manifest.json`; the same
 * drift S264/S276/S279 caught in the other clients). The responses are the
 * server's snake_case group snapshots — there is no `session` envelope and no
 * camelCase anywhere on this surface — so {@link RawSyncPlayGroup} models the
 * wire honestly and the mappers below adapt it to the modal's existing view
 * models. Estate-wide normalisation of these shapes into @phlix/contracts is
 * an open design question (S279); this mobile-local mapper is deliberately
 * minimal and MUST NOT be cloned a third time.
 */
export interface SyncPlayRoom {
  id: string;
  name: string;
  isPublic: boolean;
  hasPassword: boolean;
  memberCount: number;
  createdAt: string;
  hostId: string;
  hostName: string;
}

export interface CreateRoomParams {
  name: string;
  isPublic: boolean;
  password?: string;
}

export interface CreateRoomResponse {
  roomId: string;
  /**
   * The GROUP id doubles as the joiner's WS sessionId input: the server has no
   * separate session entity (the group IS the session, s280ui/S285) and the
   * WS layer treats the member id as a synthetic per-client value.
   */
  sessionId: string;
  serverUrl: string;
}

export interface JoinRoomResponse {
  sessionId: string;
  members: SyncPlayMember[];
  currentState: SyncPlayPlaybackState;
}

export interface SyncPlayMember {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: string;
}

export interface SyncPlayPlaybackState {
  playbackState: 'playing' | 'paused' | 'stopped';
  position: number;
  serverTime: number;
}

/**
 * One group as the server actually puts it on the wire — `GroupState` /
 * `SyncPlaySnapshotService` output, snake_case, `members` a dictionary keyed
 * by member id on full states (absent on listing rows). Mirrors the shape
 * s280ui pinned in `phlix-ui/src/api/syncplay.ts`.
 */
interface RawSyncPlayGroup {
  group_id?: string;
  group_name?: string;
  /** Listing rows use the short spelling. */
  id?: string;
  name?: string;
  member_count?: number;
  members?: Record<string, RawSyncPlayMember> | RawSyncPlayMember[];
  host_id?: string | null;
  host_name?: string;
  has_password?: boolean;
  playback_state?: string;
  playback_position?: number;
  last_activity_at?: number;
  created_at?: number;
}

interface RawSyncPlayMember {
  id?: string;
  name?: string;
  is_host?: boolean;
  joined_at?: number;
}

/** `{ success, group }` — the create/join envelope (SyncPlayController). */
interface SyncPlayGroupResponse {
  success?: boolean;
  group?: RawSyncPlayGroup;
}

/** `{ groups: [...] }` — the list envelope. */
interface SyncPlayGroupListResponse {
  groups?: RawSyncPlayGroup[];
}

function isoFromUnixSeconds(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '';
  return new Date(value * 1000).toISOString();
}

function rawMembers(raw: RawSyncPlayGroup): RawSyncPlayMember[] {
  const members = raw.members;
  if (!members) return [];
  if (Array.isArray(members)) return members;
  return Object.entries(members).map(([key, value]) => ({ id: key, ...value }));
}

function mapRoom(raw: RawSyncPlayGroup): SyncPlayRoom {
  const id = raw.group_id ?? raw.id ?? '';
  return {
    id,
    name: raw.group_name ?? raw.name ?? '',
    // `has_password` is the only public/private signal the server emits.
    isPublic: raw.has_password !== true,
    hasPassword: raw.has_password === true,
    memberCount: raw.member_count ?? rawMembers(raw).length,
    createdAt: isoFromUnixSeconds(raw.created_at),
    hostId: raw.host_id ?? '',
    hostName: raw.host_name ?? raw.host_id ?? 'Unknown',
  };
}

function mapMembers(raw: RawSyncPlayGroup): SyncPlayMember[] {
  return rawMembers(raw).map((m) => ({
    id: m.id ?? '',
    name: m.name ?? 'Unknown',
    isHost: m.is_host === true,
    joinedAt: isoFromUnixSeconds(m.joined_at),
  }));
}

function mapPlaybackState(raw: RawSyncPlayGroup): SyncPlayPlaybackState {
  const state =
    raw.playback_state === 'playing' || raw.playback_state === 'paused'
      ? raw.playback_state
      : 'stopped';
  return {
    playbackState: state,
    position: raw.playback_position ?? 0,
    serverTime: raw.last_activity_at ?? Math.floor(Date.now() / 1000),
  };
}

class SyncPlayManager {
  /**
   * List all SyncPlay groups.
   * GET /api/v1/syncplay/groups → { groups: [...] }
   */
  async getPublicRooms(): Promise<SyncPlayRoom[]> {
    const response = await apiClient.get<SyncPlayGroupListResponse>('/syncplay/groups');
    return (response.groups ?? []).map(mapRoom);
  }

  /**
   * Create a new SyncPlay group.
   * POST /api/v1/syncplay/groups → { success, group }
   *
   * `is_public` is forwarded, but the server's `createGroup()` reads only
   * `name`, `password`, `memberId` and `memberName` — `has_password` is the
   * public/private signal it keeps (same note s280ui carries).
   */
  async createRoom(params: CreateRoomParams): Promise<CreateRoomResponse> {
    const response = await apiClient.post<SyncPlayGroupResponse>('/syncplay/groups', {
      name: params.name,
      is_public: params.isPublic,
      ...(params.password !== undefined && { password: params.password }),
    });
    const group = response.group ?? {};
    const roomId = group.group_id ?? group.id ?? '';
    return { roomId, sessionId: roomId, serverUrl: '' };
  }

  /**
   * Join an existing SyncPlay group.
   * POST /api/v1/syncplay/groups/{id}/join → { success, group }
   */
  async joinRoom(roomId: string, password?: string): Promise<JoinRoomResponse> {
    const response = await apiClient.post<SyncPlayGroupResponse>(
      `/syncplay/groups/${encodeURIComponent(roomId)}/join`,
      password !== undefined ? { password } : {}
    );
    const group = response.group ?? {};
    const sessionId = group.group_id ?? group.id ?? roomId;
    return {
      sessionId,
      members: mapMembers(group),
      currentState: mapPlaybackState(group),
    };
  }

  /**
   * Leave a SyncPlay group.
   * POST /api/v1/syncplay/groups/{id}/leave → { success }
   * (the server registers leave as POST, not DELETE — an earlier mobile
   * revision called DELETE and got a 405/404 class failure)
   */
  async leaveRoom(roomId: string): Promise<void> {
    await apiClient.post<{ success?: boolean }>(
      `/syncplay/groups/${encodeURIComponent(roomId)}/leave`
    );
  }

  /**
   * Get WebSocket URL for real-time SyncPlay connection.
   * WS /api/v1/syncplay/{roomId}?token=JWT
   *
   * ⚠ Transport note (S280): the WebSocket upgrade is served by the SyncPlay
   * socket server, NOT the HTTP router whose routes `server-route-manifest.json`
   * pins — this URL is deliberately outside the route gate, alongside the
   * `SyncPlayService` `/syncplay/ws` and hub-relay `:8804` shapes.
   */
  async getWebSocketUrl(roomId: string): Promise<string> {
    const token = await AsyncStorage.getItem('access_token');
    const baseUrl = getApiBaseUrl();
    const wsBase = baseUrl.startsWith('https')
      ? baseUrl.replace('https', 'wss')
      : baseUrl.replace('http', 'ws');
    return `${wsBase}/syncplay/${roomId}?token=${token ?? ''}`;
  }
}

export const syncPlayManager = new SyncPlayManager();
export default syncPlayManager;
