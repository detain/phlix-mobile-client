// src/native/types.ts
import { NativeModule, NativeSyntheticEvent } from 'react-native';

export interface PlaybackEvent {
  event: 'ready' | 'play' | 'pause' | 'ended' | 'buffering';
  currentTime?: number;
  duration?: number;
}

export interface DownloadEvent {
  taskId: string;
  status: 'progress' | 'completed' | 'failed' | 'paused';
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  error?: string;
}

// Native player view props
export interface PhlixPlayerViewProps {
  src?: string;
  autoPlay?: boolean;
  startPosition?: number;
  volume?: number;
  muted?: boolean;
  /**
   * Absolute signed URL of the selected subtitle track (WebVTT), or empty/undefined
   * for "off". The native players side-load this VTT alongside `src`.
   * NOTE(E3-native): the native rendering side (iOS AVMediaSelection sidecar +
   * Android ExoPlayer SubtitleConfiguration) is UNTESTED in CI — there is no
   * device/simulator build that runs in this environment. The JS seam (selection
   * + this prop) is fully wired; verify on-device before relying on it.
   */
  subtitleUrl?: string;
  onPlaybackEvent?: (event: NativeSyntheticEvent<PlaybackEvent>) => void;
  onProgress?: (event: NativeSyntheticEvent<{ currentTime: number; duration: number }>) => void;
  onError?: (event: NativeSyntheticEvent<{ error: string }>) => void;
}

export interface PhlixPlayerInterface extends NativeModule {
  play(): void;
  pause(): void;
  seekTo(position: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  getCurrentPosition(callback: (position: number) => void): void;
  getDuration(callback: (duration: number) => void): void;
}

export interface PhlixDownloaderInterface extends NativeModule {
  startDownload(taskId: string, url: string, localPath: string): void;
  pauseDownload(taskId: string): void;
  resumeDownload(taskId: string): void;
  cancelDownload(taskId: string): void;
  getDownloadProgress(taskId: string, callback: (progress: number) => void): void;
}
