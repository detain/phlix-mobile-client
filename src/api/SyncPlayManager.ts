/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/api/SyncPlayManager.ts
import apiClient, { getApiBaseUrl } from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * SyncPlay Room DTOs matching phlix-server API contract
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

class SyncPlayManager {
  /**
   * Get list of public SyncPlay rooms
   * GET /api/v1/syncplay/rooms
   */
  async getPublicRooms(): Promise<SyncPlayRoom[]> {
    const response = await apiClient.get<SyncPlayRoom[]>('/syncplay/rooms');
    return response;
  }

  /**
   * Create a new SyncPlay room
   * POST /api/v1/syncplay/rooms
   */
  async createRoom(params: CreateRoomParams): Promise<CreateRoomResponse> {
    const response = await apiClient.post<CreateRoomResponse>('/syncplay/rooms', {
      name: params.name,
      is_public: params.isPublic,
      ...(params.password !== undefined && { password: params.password }),
    });
    return response;
  }

  /**
   * Join an existing SyncPlay room
   * POST /api/v1/syncplay/rooms/{id}/join
   */
  async joinRoom(roomId: string, password?: string): Promise<JoinRoomResponse> {
    const response = await apiClient.post<JoinRoomResponse>(
      `/syncplay/rooms/${roomId}/join`,
      password !== undefined ? { password } : {}
    );
    return response;
  }

  /**
   * Leave a SyncPlay room
   * DELETE /api/v1/syncplay/rooms/{id}/leave
   */
  async leaveRoom(roomId: string): Promise<void> {
    await apiClient.delete(`/syncplay/rooms/${roomId}/leave`);
  }

  /**
   * Get WebSocket URL for real-time SyncPlay connection
   * WS /api/v1/syncplay/{roomId}?token=JWT
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