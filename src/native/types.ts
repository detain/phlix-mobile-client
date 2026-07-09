/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

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

/**
 * Native download module surface. Method signatures + event names + payload keys
 * MUST stay byte-for-byte aligned across this TS interface, the iOS module
 * (`ios/LocalPods/PhlixPlayer/PhlixDownloader.swift` + `.m`) and the Android
 * module (`android/.../download/PhlixDownloaderModule.kt`).
 *
 * NOTE(E4-native): the native iOS/Android implementations are UNTESTED in CI —
 * there is no device/simulator build that runs in this environment. The JS layer
 * (DownloadService) falls back to a simulated downloader when this module is
 * absent (Jest + before the native side is built), so the app stays functional.
 */
export interface PhlixDownloaderInterface extends NativeModule {
  /**
   * Begin (or resume) a background download of `url` to `localPath`.
   * @param taskId          Caller-owned id echoed back on every event.
   * @param url             Signed direct-play stream URL (E2 getStreamUrl).
   * @param localPath       Absolute destination path in the app's files dir.
   * @param resumeOffset    Bytes already on disk to resume from (0 = fresh).
   * @param totalBytesHint  Expected total size, or 0 if unknown (native reports
   *                        the real size from Content-Length as it streams).
   */
  startDownload(
    taskId: string,
    url: string,
    localPath: string,
    resumeOffset: number,
    totalBytesHint: number,
  ): void;
  pauseDownload(taskId: string): void;
  resumeDownload(taskId: string): void;
  cancelDownload(taskId: string): void;
  /** Delete a downloaded file from disk. Resolves even if the file is absent. */
  deleteFile(localPath: string): Promise<boolean>;
  /** Absolute path to the app's documents/files dir, exposed as a constant. */
  documentsPath?: string;
}

/**
 * Native download event names. Shared CONCEPTUALLY with the iOS/Android modules —
 * keep these strings identical to the event names emitted natively.
 */
export const DOWNLOAD_EVENTS = {
  progress: 'PhlixDownloadProgress',
  complete: 'PhlixDownloadComplete',
  error: 'PhlixDownloadError',
  paused: 'PhlixDownloadPaused',
} as const;

/** Payload of a `PhlixDownloadProgress` event. */
export interface DownloadProgressPayload {
  taskId: string;
  downloadedBytes: number;
  totalBytes: number;
}

/** Payload of a `PhlixDownloadComplete` event. */
export interface DownloadCompletePayload {
  taskId: string;
  localPath: string;
}

/** Payload of a `PhlixDownloadError` event. */
export interface DownloadErrorPayload {
  taskId: string;
  error: string;
}

/** Payload of a `PhlixDownloadPaused` event. */
export interface DownloadPausedPayload {
  taskId: string;
  downloadedBytes: number;
}

/**
 * Native WebAuthn / passkey authenticator surface (slice E10e).
 *
 * Method signatures MUST stay byte-for-byte aligned across this TS interface,
 * the iOS module (`ios/LocalPods/PhlixPlayer/PhlixWebAuthn.swift` + `.m`,
 * `ASAuthorizationPlatformPublicKeyCredentialProvider`, iOS 15+) and the Android
 * module (`android/.../webauthn/PhlixWebAuthnModule.kt`, AndroidX Credential
 * Manager).
 *
 * The bridge is intentionally THIN: it takes the server's WebAuthn options as a
 * JSON STRING and returns the authenticator's attestation/assertion as a JSON
 * STRING the server's verify endpoint expects. All base64url <-> binary encoding
 * happens natively, so JS never decodes anything.
 *
 * NOTE(E10e-native): the native iOS/Android implementations are UNTESTED in CI —
 * there is no device/simulator build that runs in this environment, and the
 * passkey ceremony itself can ONLY run on a real device (the platform shows the
 * system biometric/PIN sheet). The JS wrapper (`src/native/PhlixWebAuthn.ts`)
 * throws a clear "passkeys unavailable" error when this module is absent, so
 * Jest + non-native runs stay functional.
 */
export interface PhlixWebAuthnInterface extends NativeModule {
  /**
   * Whether platform passkeys are available (iOS 15+ / Android with Credential
   * Manager + a configured screen lock). Resolves false rather than rejecting on
   * unsupported platforms.
   */
  isSupported(): Promise<boolean>;
  /**
   * Run the registration (attestation) ceremony.
   * @param optionsJson The raw `PublicKeyCredentialCreationOptions` JSON string
   *                    from `POST /auth/webauthn/register/options`.
   * @returns A JSON string of the attestation credential:
   *          `{ id, rawId, type:'public-key', response:{ clientDataJSON,
   *          attestationObject } }` with base64url-encoded binary fields.
   *          Rejects on user cancel / error.
   */
  register(optionsJson: string): Promise<string>;
  /**
   * Run the authentication (assertion) ceremony.
   * @param optionsJson The raw `PublicKeyCredentialRequestOptions` JSON string
   *                    from `POST /auth/webauthn/login/options`.
   * @returns A JSON string of the assertion:
   *          `{ id, rawId, type, response:{ clientDataJSON, authenticatorData,
   *          signature, userHandle } }` with base64url-encoded binary fields.
   *          Rejects on user cancel / error.
   */
  authenticate(optionsJson: string): Promise<string>;
}
