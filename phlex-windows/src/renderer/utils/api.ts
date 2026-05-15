import axios, { AxiosInstance, AxiosError } from 'axios';

export interface DeviceProfile {
  Name: string;
  MaxStreamingBitrate: number;
  MaxStaticBitrate: number;
  SupportedMediaTypes: string[];
  DirectPlayProfiles: Array<{
    Container: string;
    Type: string;
    VideoCodec?: string;
    AudioCodec?: string;
  }>;
  TranscodingProfiles: Array<{
    Container: string;
    Type: string;
    VideoCodec: string;
    AudioCodec: string;
  }>;
}

export interface ApiClientConfig {
  baseUrl: string;
  deviceId: string;
  deviceName: string;
}

export interface User {
  id: string;
  name: string;
  email?: string;
}

export interface AuthResult {
  token: string;
  session_id: string;
  user: User;
}

export interface Session {
  id: string;
  device_id: string;
  user_id: string;
}

export interface Library {
  id: string;
  name: string;
  type: string;
  item_count?: number;
}

export interface MediaItem {
  Id: string;
  Name: string;
  Type: string;
  Overview?: string;
  BackdropImageTags?: string[];
  PrimaryImageAspectRatio?: number;
  ParentId?: string;
  GenreItems?: Array<{ Name: string }>;
  MediaSources?: Array<{
    Id: string;
    Path: string;
    Container: string;
    Size?: number;
  }>;
}

export interface MediaItemsResponse {
  Items: MediaItem[];
  TotalRecordCount: number;
  StartIndex: number;
}

export interface PlaybackInfoResponse {
  item: MediaItem;
  playback_info: {
    url: string;
    container: string;
    mime_type: string;
  };
}

export interface PlaybackStartResponse {
  session_id: string;
  start_position_ticks: number;
}

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;
  private sessionId: string | null = null;
  private user: User | null = null;

  private deviceProfile: DeviceProfile = {
    Name: 'Windows Desktop',
    MaxStreamingBitrate: 100000000,
    MaxStaticBitrate: 100000000,
    SupportedMediaTypes: ['Video', 'Audio', 'Photo'],
    DirectPlayProfiles: [{
      Container: '*',
      Type: 'Video',
      VideoCodec: '*',
      AudioCodec: '*'
    }],
    TranscodingProfiles: [{
      Container: 'mp4',
      Type: 'Video',
      VideoCodec: 'h264',
      AudioCodec: 'aac'
    }]
  };

  constructor(config: ApiClientConfig) {
    this.client = axios.create({
      baseURL: `${config.baseUrl}/api/v1`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Phlex-Device-ID': config.deviceId,
        'X-Phlex-Device-Name': config.deviceName,
        'X-Phlex-Device-Type': 'windows'
      }
    });

    // Request interceptor
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      if (this.sessionId) {
        config.headers['X-Phlex-Session-ID'] = this.sessionId;
      }
      return config;
    });

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth methods
  setToken(token: string | null): void {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  setSession(sessionId: string | null): void {
    this.sessionId = sessionId;
    if (sessionId) {
      localStorage.setItem('session_id', sessionId);
    } else {
      localStorage.removeItem('session_id');
    }
  }

  async restoreSession(): Promise<boolean> {
    const token = localStorage.getItem('auth_token');
    const sessionId = localStorage.getItem('session_id');

    if (token) {
      this.token = token;
      if (sessionId) this.sessionId = sessionId;

      try {
        const result = await this.request<User>('GET', '/Users/Me');
        this.user = result;
        return true;
      } catch {
        this.setToken(null);
        this.setSession(null);
      }
    }
    return false;
  }

  async login(username: string, password: string): Promise<AuthResult> {
    const result = await this.request<AuthResult>('POST', '/Auth/Login', {
      username,
      password,
      device_id: this.getDeviceId(),
      device_name: this.deviceProfile.Name,
      device_type: 'windows'
    });

    this.setToken(result.token);
    this.setSession(result.session_id);
    this.user = result.user;
    return result;
  }

  logout(): void {
    try {
      if (this.sessionId) {
        this.request('DELETE', `/Sessions/${this.sessionId}`, {});
      }
    } finally {
      this.setToken(null);
      this.setSession(null);
      this.user = null;
    }
  }

  // Session methods
  async createSession(): Promise<Session> {
    const result = await this.request<Session>('POST', '/Sessions', {
      device_id: this.getDeviceId(),
      device_name: this.deviceProfile.Name,
      device_type: 'windows',
      capabilities: this.deviceProfile
    });
    this.setSession(result.id);
    return result;
  }

  // Library methods
  async getLibraries(): Promise<Library[]> {
    return this.request<Library[]>('GET', '/Library/VirtualFolders', {});
  }

  async getLibraryItems(
    libraryId: string,
    options: {
      type?: string;
      limit?: number;
      startIndex?: number;
    } = {}
  ): Promise<MediaItemsResponse> {
    const params = new URLSearchParams({
      parentId: libraryId,
      includeItemTypes: options.type || 'Movie,Series',
      limit: String(options.limit || 50),
      startIndex: String(options.startIndex || 0),
      sortBy: 'SortName',
      sortOrder: 'Ascending'
    });

    return this.request<MediaItemsResponse>('GET', `/Items?${params}`, {});
  }

  async getItem(itemId: string): Promise<MediaItem> {
    return this.request<MediaItem>('GET', `/Items/${itemId}`, {});
  }

  async getItemPlaybackInfo(itemId: string): Promise<PlaybackInfoResponse> {
    const params = new URLSearchParams({
      deviceProfile: 'windows',
      maxStreamingBitrate: String(this.deviceProfile.MaxStreamingBitrate)
    });

    return this.request<PlaybackInfoResponse>(
      'GET',
      `/Items/${itemId}/PlaybackInfo?${params}`,
      {}
    );
  }

  // Playback control
  async playItem(
    itemId: string,
    options: { startPosition?: number } = {}
  ): Promise<PlaybackStartResponse> {
    return this.request<PlaybackStartResponse>('POST', '/Sessions/Play', {
      item_id: itemId,
      start_position_ticks: options.startPosition || 0,
      device_profile: 'windows'
    });
  }

  async stopPlayback(): Promise<void> {
    await this.request('POST', '/Playstate', {
      session_id: this.sessionId,
      command: 'stop'
    });
  }

  async pausePlayback(): Promise<void> {
    await this.request('POST', '/Playstate', {
      session_id: this.sessionId,
      command: 'pause'
    });
  }

  async resumePlayback(): Promise<void> {
    await this.request('POST', '/Playstate', {
      session_id: this.sessionId,
      command: 'play'
    });
  }

  async seekPlayback(positionTicks: number): Promise<void> {
    await this.request('POST', '/Playstate', {
      session_id: this.sessionId,
      command: 'seek',
      data: { position_ticks: positionTicks }
    });
  }

  async reportProgress(positionTicks: number, isPaused: boolean): Promise<void> {
    await this.request('POST', '/Playstate/Progress', {
      session_id: this.sessionId,
      position_ticks: positionTicks,
      is_paused: isPaused
    });
  }

  // Helper methods
  private async request<T>(
    method: string,
    path: string,
    data?: unknown
  ): Promise<T> {
    const response = await this.client.request<T>({ method, url: path, data });
    return response.data;
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = `windows-${crypto.randomUUID()}`;
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  private handleUnauthorized(): void {
    this.setToken(null);
    this.setSession(null);
    this.user = null;
  }

  // Getters
  get isAuthenticated(): boolean {
    return this.token !== null;
  }

  get currentUser(): User | null {
    return this.user;
  }
}

export const api = new ApiClient({
  baseUrl: import.meta.env.VITE_PHLEX_SERVER_URL || 'http://localhost:8096',
  deviceId: '',
  deviceName: 'Windows Desktop'
});

export default api;
