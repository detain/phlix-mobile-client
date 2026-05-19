// src/syncplay/SyncPlayService.ts
/**
 * SyncPlay Service
 *
 * WebSocket-based service for synchronized group playback.
 * Implements NTP-style time synchronization and handles all SyncPlay
 * protocol messages with the server.
 *
 * ## TimeSync Protocol
 *
 * 1. Client sends syncplay_time_ping with local timestamp t1
 * 2. Server responds with syncplay_time_pong containing t1, t2 (server receive),
 *    t3 (server response time)
 * 3. Client computes: offset = (t2 - t1 - (t3 - t2)) / 2
 * 4. Rolling average of last OFFSET_SAMPLE_COUNT samples
 * 5. adjustedTime = Date.now() + averageOffset
 */

import { useSyncplayStore } from '../store/syncplayStore';
import { useHubStore } from '../store/hubStore';

// ---------------------------------------------------------------------------
// Message Types (mirrors src/Session/SyncPlay/Messages.php)
// ---------------------------------------------------------------------------

const MSG = {
  GROUP_CREATE: 'syncplay_group_create',
  GROUP_JOIN: 'syncplay_group_join',
  GROUP_LEAVE: 'syncplay_group_leave',
  GROUP_STATE: 'syncplay_group_state',
  GROUP_LIST: 'syncplay_group_list',
  PLAYBACK_PLAY: 'syncplay_playback_play',
  PLAYBACK_PAUSE: 'syncplay_playback_pause',
  PLAYBACK_SEEK: 'syncplay_playback_seek',
  PLAYBACK_QUEUE: 'syncplay_playback_queue',
  PLAYBACK_SYNC: 'syncplay_playback_sync',
  CHAT_MESSAGE: 'syncplay_chat',
  CHAT_TYPING: 'syncplay_typing',
  HOST_TRANSFER: 'syncplay_host_transfer',
  HOST_ELECT: 'syncplay_host_elect',
  TIME_PING: 'syncplay_time_ping',
  TIME_PONG: 'syncplay_time_pong',
  TIME_SYNC: 'syncplay_time_sync',
  ERROR: 'syncplay_error',
  INFO: 'syncplay_info',
} as const;

type MessageType = (typeof MSG)[keyof typeof MSG];

// ---------------------------------------------------------------------------
// TimeSync - NTP-style clock offset calculation
// ---------------------------------------------------------------------------

const OFFSET_SAMPLE_COUNT = 5;
const MAX_ACCEPTABLE_RTT = 1000;
const SYNC_INTERVAL_MS = 30000;

interface OffsetSample {
  offset: number;
  rtt: number;
  timestamp: number;
}

class TimeSync {
  private samples: OffsetSample[] = [];

  /**
   * Get the current estimated time offset from server (ms).
   * Add this to local time to get server-synchronized time.
   */
  getOffset(): number {
    if (this.samples.length === 0) {
      return 0;
    }

    const recent = this.samples.slice(-OFFSET_SAMPLE_COUNT);
    let weightedSum = 0;
    let weightSum = 0;

    for (const sample of recent) {
      const weight = 1 / Math.max(1, sample.rtt);
      weightedSum += sample.offset * weight;
      weightSum += weight;
    }

    return Math.round(weightedSum / Math.max(1, weightSum));
  }

  /**
   * Get estimated one-way latency to server (ms).
   */
  getLatency(): number {
    if (this.samples.length === 0) {
      return 0;
    }

    const recent = this.samples.slice(-OFFSET_SAMPLE_COUNT);
    let totalLatency = 0;

    for (const sample of recent) {
      totalLatency += sample.rtt / 2;
    }

    return Math.round(totalLatency / recent.length);
  }

  /**
   * Check if time sync has collected enough stable samples.
   */
  isStable(): boolean {
    if (this.samples.length < OFFSET_SAMPLE_COUNT) {
      return false;
    }

    const recent = this.samples.slice(-OFFSET_SAMPLE_COUNT);
    const offsets = recent.map((s) => s.offset);
    const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;

    let varianceSum = 0;
    for (const offset of offsets) {
      const diff = offset - mean;
      varianceSum += diff * diff;
    }
    const variance = varianceSum / offsets.length;

    return variance < 50;
  }

  /**
   * Add a time sync sample from a pong response.
   *
   * @param t1 Client send time (ms)
   * @param t2 Server receive time (ms)
   * @param t3 Server response time (ms)
   * @param t4 Client receive time (ms)
   */
  addSample(t1: number, t2: number, t3: number, t4: number): void {
    const rtt = t4 - t1 - (t3 - t2);

    if (rtt > MAX_ACCEPTABLE_RTT) {
      return;
    }

    const latency = rtt / 2;
    // offset = server_time - client_time + latency
    const offset = Math.round(t2 - t1 + latency);

    this.samples.push({
      offset,
      rtt,
      timestamp: Date.now(),
    });

    // Keep rolling buffer
    if (this.samples.length > OFFSET_SAMPLE_COUNT * 2) {
      this.samples.shift();
    }
  }

  /**
   * Reset all time sync samples.
   */
  reset(): void {
    this.samples = [];
  }

  /**
   * Get current sync status.
   */
  getStatus(): { offset: number; latency: number; isStable: boolean; sampleCount: number } {
    return {
      offset: this.getOffset(),
      latency: this.getLatency(),
      isStable: this.isStable(),
      sampleCount: this.samples.length,
    };
  }
}

// ---------------------------------------------------------------------------
// SyncPlayService
// ---------------------------------------------------------------------------

export interface SyncPlayMember {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
}

export interface SyncPlayGroup {
  id: string;
  name: string;
  members: SyncPlayMember[];
  currentMediaId: string | null;
  playbackState: 'playing' | 'paused' | 'stopped';
  playbackPosition: number;
  hostId: string;
  hasPassword: boolean;
}

export type PlaybackCommand = {
  type: 'play' | 'pause' | 'seek';
  position: number;
  serverTime: number;
};

type WsMessage = {
  type: string;
  [key: string]: unknown;
};

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface SyncPlayServiceEvents {
  onConnectionStateChange: (state: ConnectionState) => void;
  onGroupStateUpdate: (group: SyncPlayGroup) => void;
  onPlaybackCommand: (cmd: PlaybackCommand) => void;
  onMemberJoined: (member: SyncPlayMember) => void;
  onMemberLeft: (memberId: string) => void;
  onHostChanged: (newHostId: string) => void;
  onError: (code: string, message: string) => void;
  onTimeSyncUpdate: (status: { offset: number; latency: number; isStable: boolean }) => void;
}

class SyncPlayService {
  private ws: WebSocket | null = null;
  private timeSync = new TimeSync();
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private memberId: string = '';
  private events: Partial<SyncPlayServiceEvents> = {};
  private connectionState: ConnectionState = 'disconnected';

  /**
   * Connect to the SyncPlay WebSocket endpoint.
   * Endpoint is derived from the hub store's effectiveServerUrl.
   */
  connect(memberId: string): void {
    if (this.ws) {
      this.disconnect();
    }

    this.memberId = memberId;
    const serverUrl = this.getWebSocketUrl();

    if (!serverUrl) {
      this.emit('onConnectionStateChange', 'error');
      return;
    }

    this.setConnectionState('connecting');

    try {
      this.ws = new WebSocket(serverUrl);
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onmessage = (event: any) => this.handleMessage(event);
    } catch {
      this.setConnectionState('error');
    }
  }

  /**
   * Disconnect from the SyncPlay WebSocket.
   */
  disconnect(): void {
    this.stopSyncInterval();
    this.stopReconnect();

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }

    this.setConnectionState('disconnected');
    this.timeSync.reset();
    useSyncplayStore.getState().reset();
  }

  /**
   * Register event handlers.
   */
  on<K extends keyof SyncPlayServiceEvents>(event: K, handler: SyncPlayServiceEvents[K]): void {
    this.events[event] = handler;
  }

  off(event: keyof SyncPlayServiceEvents): void {
    delete this.events[event];
  }

  /**
   * Create a new SyncPlay group.
   */
  createGroup(groupName: string, password?: string): void {
    const payload: Record<string, unknown> = {
      type: MSG.GROUP_CREATE,
      protocol_version: 1,
      group_name: groupName,
      member_id: this.memberId,
      member_name: this.getMemberName(),
      timestamp: Date.now(),
    };

    if (password !== undefined) {
      payload.password = password;
    }

    this.send(payload);
  }

  /**
   * Join an existing SyncPlay group.
   */
  joinGroup(groupId: string, password?: string): void {
    const payload: Record<string, unknown> = {
      type: MSG.GROUP_JOIN,
      protocol_version: 1,
      group_id: groupId,
      member_id: this.memberId,
      member_name: this.getMemberName(),
      timestamp: Date.now(),
    };

    if (password !== undefined) {
      payload.password = password;
    }

    this.send(payload);
  }

  /**
   * Leave the current SyncPlay group.
   */
  leaveGroup(): void {
    const store = useSyncplayStore.getState();
    if (!store.currentGroup) {
      return;
    }

    this.send({
      type: MSG.GROUP_LEAVE,
      protocol_version: 1,
      group_id: store.currentGroup.id,
      member_id: this.memberId,
      timestamp: Date.now(),
    });

    useSyncplayStore.getState().setCurrentGroup(null);
    this.stopSyncInterval();
  }

  /**
   * Send a playback play command (host only).
   */
  sendPlay(position: number): void {
    const store = useSyncplayStore.getState();
    if (!store.currentGroup || !store.isHost) {
      return;
    }

    const serverTime = this.getSynchronizedTime();

    this.send({
      type: MSG.PLAYBACK_PLAY,
      protocol_version: 1,
      group_id: store.currentGroup.id,
      member_id: this.memberId,
      position,
      server_time: serverTime,
      timestamp: Date.now(),
    });

    // Optimistically update local state
    useSyncplayStore.getState().updatePlaybackState('playing', position);
  }

  /**
   * Send a playback pause command (host only).
   */
  sendPause(position: number): void {
    const store = useSyncplayStore.getState();
    if (!store.currentGroup || !store.isHost) {
      return;
    }

    const serverTime = this.getSynchronizedTime();

    this.send({
      type: MSG.PLAYBACK_PAUSE,
      protocol_version: 1,
      group_id: store.currentGroup.id,
      member_id: this.memberId,
      position,
      server_time: serverTime,
      timestamp: Date.now(),
    });

    // Optimistically update local state
    useSyncplayStore.getState().updatePlaybackState('paused', position);
  }

  /**
   * Send a playback seek command (host only).
   */
  sendSeek(fromPosition: number, toPosition: number): void {
    const store = useSyncplayStore.getState();
    if (!store.currentGroup || !store.isHost) {
      return;
    }

    const serverTime = this.getSynchronizedTime();

    this.send({
      type: MSG.PLAYBACK_SEEK,
      protocol_version: 1,
      group_id: store.currentGroup.id,
      member_id: this.memberId,
      from_position: fromPosition,
      to_position: toPosition,
      server_time: serverTime,
      timestamp: Date.now(),
    });

    // Optimistically update local state
    useSyncplayStore.getState().updatePlaybackState(
      store.currentGroup.playbackState,
      toPosition
    );
  }

  /**
   * Report current playback position to the group (periodic, all members).
   */
  reportPosition(position: number): void {
    const store = useSyncplayStore.getState();
    if (!store.currentGroup) {
      return;
    }

    // This is a client-side position report for awareness
    // (Server may not require it but it's good for group state)
    this.send({
      type: MSG.INFO,
      protocol_version: 1,
      group_id: store.currentGroup.id,
      member_id: this.memberId,
      data: { position_report: position },
      timestamp: Date.now(),
    });
  }

  /**
   * Request time synchronization with the server.
   */
  requestTimeSync(): void {
    const t1 = Date.now();

    const handler = (msg: WsMessage) => {
      if (msg.type === MSG.TIME_PONG) {
        const t4 = Date.now();
        const msgAny = msg as unknown as { client_time?: number; server_time?: number };
        const t2 = msgAny.client_time ?? t4;
        const serverReceiveTime = msgAny.server_time ?? t4;

        // Server's t3 (response time) - we use server_time as approximate t2
        // and the pong response contains client_time (t1) and server_time (t2)
        // The actual computation: offset = (t2 - t1 - (t3 - t2)) / 2
        // For simplicity we use: offset = serverTime - t1 - (t4 - t1) / 2
        const rtt = t4 - t1;
        const latency = rtt / 2;
        const offset = Math.round(serverReceiveTime - t1 + latency);

        this.timeSync.addSample(t1, serverReceiveTime, serverReceiveTime + latency, t4);

        this.events.onTimeSyncUpdate?.({
          offset: this.timeSync.getOffset(),
          latency: this.timeSync.getLatency(),
          isStable: this.timeSync.isStable(),
        });
      }
    };

    // Use a one-time listener approach via store middleware if needed
    // For now, the message handler routes to handleMessage which calls processPong

    this.send({
      type: MSG.TIME_PING,
      protocol_version: 1,
      client_time: t1,
      timestamp: t1,
    });
  }

  /**
   * Get current synchronized time (local time + offset).
   */
  getSynchronizedTime(): number {
    return Date.now() + this.timeSync.getOffset();
  }

  /**
   * Get TimeSync status.
   */
  getTimeSyncStatus(): { offset: number; latency: number; isStable: boolean } {
    return {
      offset: this.timeSync.getOffset(),
      latency: this.timeSync.getLatency(),
      isStable: this.timeSync.isStable(),
    };
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  private getWebSocketUrl(): string {
    const { effectiveServerUrl, connectionMode } = useHubStore.getState();

    if (!effectiveServerUrl) {
      return '';
    }

    // Build WebSocket URL - use ws:// or wss:// based on http/https
    const protocol = effectiveServerUrl.startsWith('https') ? 'wss' : 'ws';

    if (connectionMode === 'relay') {
      // Relay mode: connect through hub relay
      const { hubUrl } = useHubStore.getState();
      if (!hubUrl) {
        return '';
      }
      const relayBase = hubUrl.replace(/^https?/, protocol);
      return `${relayBase}/api/v1/relay/syncplay`;
    }

    // Direct mode
    const host = effectiveServerUrl.replace(/^https?:\/\//, '');
    return `${protocol}://${host}/api/v1/syncplay/ws`;
  }

  private getMemberName(): string {
    // Could be extended to get from auth store
    return 'Mobile User';
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.events.onConnectionStateChange?.(state);
  }

  private startSyncInterval(): void {
    this.stopSyncInterval();
    this.requestTimeSync();
    this.syncInterval = setInterval(() => {
      if (this.connectionState === 'connected') {
        this.requestTimeSync();
      }
    }, SYNC_INTERVAL_MS);
  }

  private stopSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private scheduleReconnect(): void {
    this.stopReconnect();
    this.reconnectTimeout = setTimeout(() => {
      if (this.memberId) {
        this.connect(this.memberId);
      }
    }, 5000);
  }

  private stopReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private handleOpen(): void {
    this.setConnectionState('connected');
    this.startSyncInterval();

    // Re-join group if we had one
    const { currentGroup } = useSyncplayStore.getState();
    if (currentGroup) {
      this.joinGroup(currentGroup.id);
    }
  }

  private handleClose(): void {
    this.setConnectionState('disconnected');
    this.stopSyncInterval();
    this.scheduleReconnect();
  }

  private handleError(): void {
    this.setConnectionState('error');
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const msg: WsMessage = JSON.parse(event.data as string);
      this.routeMessage(msg);
    } catch {
      // Ignore malformed messages
    }
  }

  private routeMessage(msg: WsMessage): void {
    switch (msg.type) {
      case MSG.GROUP_STATE:
        this.handleGroupState(msg);
        break;

      case MSG.PLAYBACK_PLAY:
        this.handlePlaybackPlay(msg);
        break;

      case MSG.PLAYBACK_PAUSE:
        this.handlePlaybackPause(msg);
        break;

      case MSG.PLAYBACK_SEEK:
        this.handlePlaybackSeek(msg);
        break;

      case MSG.HOST_ELECT:
        this.handleHostElect(msg);
        break;

      case MSG.INFO:
        this.handleInfo(msg);
        break;

      case MSG.ERROR:
        this.handleErrorMsg(msg);
        break;

      case MSG.TIME_PONG:
        this.handleTimePong(msg);
        break;

      default:
        break;
    }
  }

  private handleGroupState(msg: WsMessage): void {
    const groupData = msg.group as Record<string, unknown> | undefined;
    const yourId = msg.your_id as string | undefined;

    if (!groupData) {
      return;
    }

    const members: SyncPlayMember[] = [];
    const rawMembers = (groupData.members as Array<Record<string, unknown>> | undefined) ?? [];

    for (const m of rawMembers) {
      members.push({
        id: m.id as string,
        name: m.name as string,
        isHost: m.id === groupData.host_id,
        joinedAt: (m.joined_at as number) ?? Date.now(),
      });
    }

    const group: SyncPlayGroup = {
      id: groupData.id as string,
      name: groupData.name as string,
      members,
      currentMediaId: (groupData.current_media_id as string) ?? null,
      playbackState: ((groupData.playback_state as string) ?? 'stopped') as SyncPlayGroup['playbackState'],
      playbackPosition: (groupData.playback_position as number) ?? 0,
      hostId: (groupData.host_id as string) ?? '',
      hasPassword: (groupData.has_password as boolean) ?? false,
    };

    useSyncplayStore.getState().setCurrentGroup(group);
    useSyncplayStore.getState().setIsHost(yourId === group.hostId);

    this.events.onGroupStateUpdate?.(group);
  }

  private handlePlaybackPlay(msg: WsMessage): void {
    const position = (msg.position as number) ?? 0;
    const serverTime = (msg.server_time as number) ?? this.getSynchronizedTime();

    useSyncplayStore.getState().updatePlaybackState('playing', position);
    this.events.onPlaybackCommand?.({ type: 'play', position, serverTime });
  }

  private handlePlaybackPause(msg: WsMessage): void {
    const position = (msg.position as number) ?? 0;
    const serverTime = (msg.server_time as number) ?? this.getSynchronizedTime();

    useSyncplayStore.getState().updatePlaybackState('paused', position);
    this.events.onPlaybackCommand?.({ type: 'pause', position, serverTime });
  }

  private handlePlaybackSeek(msg: WsMessage): void {
    const toPosition = (msg.to_position as number) ?? 0;
    const serverTime = (msg.server_time as number) ?? this.getSynchronizedTime();

    useSyncplayStore.getState().updatePlaybackState(
      useSyncplayStore.getState().currentGroup?.playbackState ?? 'paused',
      toPosition
    );
    this.events.onPlaybackCommand?.({ type: 'seek', position: toPosition, serverTime });
  }

  private handleHostElect(msg: WsMessage): void {
    const newHostId = msg.elected_id as string | undefined;

    if (newHostId) {
      useSyncplayStore.getState().setIsHost(newHostId === this.memberId);
      this.events.onHostChanged?.(newHostId);
    }
  }

  private handleInfo(msg: WsMessage): void {
    const data = msg.data as Record<string, unknown> | undefined;
    const memberId = msg.member_id as string | undefined;

    if (data?.member_id && data?.member_name) {
      this.events.onMemberJoined?.({
        id: data.member_id as string,
        name: data.member_name as string,
        isHost: false,
        joinedAt: Date.now(),
      });
    }

    // Detect member left from info messages
    if (memberId && (msg as { message?: string }).message?.includes('left')) {
      this.events.onMemberLeft?.(memberId);
    }
  }

  private handleErrorMsg(msg: WsMessage): void {
    const code = (msg.error_code as string) ?? 'UNKNOWN';
    const message = (msg.message as string) ?? 'Unknown error';

    this.events.onError?.(code, message);
  }

  private handleTimePong(msg: WsMessage): void {
    const t1 = (msg.client_time as number) ?? Date.now();
    const serverTime = (msg.server_time as number) ?? t1;
    const t4 = Date.now();

    // Compute approximate t2/t3 - in practice the server's pong format
    // has client_time and server_time (server receive time)
    // rtt = t4 - t1, latency = rtt/2, offset = serverTime - t1 + latency
    const rtt = t4 - t1;
    const latency = rtt / 2;
    const offset = Math.round(serverTime - t1 + latency);

    this.timeSync.addSample(t1, serverTime, serverTime + latency, t4);

    this.events.onTimeSyncUpdate?.({
      offset: this.timeSync.getOffset(),
      latency: this.timeSync.getLatency(),
      isStable: this.timeSync.isStable(),
    });
  }

  private emit<K extends keyof SyncPlayServiceEvents>(event: K, ...args: Parameters<SyncPlayServiceEvents[K]>): void {
    const handler = this.events[event];
    if (handler) {
      (handler as (...args: Parameters<SyncPlayServiceEvents[K]>) => void)(...args);
    }
  }
}

export const syncPlayService = new SyncPlayService();
export default syncPlayService;
