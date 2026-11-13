/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/services/DownloadService.ts
import { NativeModules, NativeEventEmitter } from 'react-native';
import type { EmitterSubscription } from 'react-native';
import { MediaItem } from '../types/media';
import { useDownloadStore, DownloadTask } from '../store/downloadStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { playbackManager } from '../api/PlaybackManager';
import { notificationService } from './NotificationService';
import { isCellularNow, onNetworkChange } from '../utils/networkState';
import {
  DOWNLOAD_EVENTS,
  type PhlixDownloaderInterface,
  type DownloadProgressPayload,
  type DownloadCompletePayload,
  type DownloadErrorPayload,
  type DownloadPausedPayload,
} from '../native/types';
import { apiErrorMessage } from '../api/client';

const MAX_CONCURRENT_DOWNLOADS = 2;

// Re-export the native event-name constants so callers/tests share one source.
export { DOWNLOAD_EVENTS };

/* ── MW-045 (review mobile__casualgamer #2): actionable failure copy ───────
 * Native download failures arrive as raw wire/OS strings. The full inventory
 * at the emitting boundary:
 *   - Android PhlixDownloaderModule.kt finishError: "HTTP ${code}",
 *     "Empty response body", and unwrapped OkHttp exception messages;
 *   - iOS PhlixDownloader.swift: URLSession/NSError localizedDescription;
 *   - the JS lane: axios text and the app's own throws.
 * None of it tells a user what to DO — the list used to render verbatim
 * after "Failed: ". `describeDownloadFailure` parses every known shape at
 * this boundary into one short, actionable sentence; unmappable text falls
 * to the generic retry copy instead of echoing machine noise. The raw
 * string survives for field diagnosis in handleNativeError's console line.
 */
const DOWNLOAD_CONNECTIVITY = 'Your connection was interrupted — check the network and try again.';
const DOWNLOAD_DISK_FULL = 'Not enough free storage on this device — make space and try again.';
const DOWNLOAD_LINK_EXPIRED = 'The download link expired — start the download again.';
const DOWNLOAD_ITEM_GONE = 'That item could not be found on this server.';
const DOWNLOAD_SERVER_ERROR = 'The server had a problem delivering the file — try again later.';
const DOWNLOAD_EMPTY_BODY = 'The server sent no data — try again later.';
const DOWNLOAD_GENERIC = 'The download failed — try again.';

const DISK_FULL_SHAPE = /no space left|volume .*is full|not enough space|insufficient storage|ENOSPC/i;
// ORDERING LAW (folded from the w09L1 review; the arm order below ENFORCES
// it, not the narrowness of the gone pattern): connectivity/DNS wording is
// tested BEFORE the "could not be found" item lane. iOS prints "A server
// with the specified hostname could not be found." for dead DNS — a
// connectivity event, not a vanished item — and any future widening of
// RESOURCE_GONE_SHAPE toward a bare /could not be found/ keeps that sentence
// on connectivity copy because CONNECTIVITY_SHAPE is consulted first. The
// inventory pins both shapes matching one sentence to the CONNECTIVITY
// answer (DownloadService.failureCopy suite).
const CONNECTIVITY_SHAPE = /resolve host|hostname|connection|network|offline|timed out|timeout|socket|ECONNRESET|EAI_AGAIN/i;
const RESOURCE_GONE_SHAPE = /resource could not be found|no longer available/i;

export const describeDownloadFailure = (raw: string): string => {
  const text = raw.trim();
  if (text === '') {
    return DOWNLOAD_GENERIC;
  }
  const http = /^HTTP (\d{3})$/.exec(text);
  if (http) {
    const code = Number(http[1]);
    if (code === 401 || code === 403) {
      return DOWNLOAD_LINK_EXPIRED;
    }
    if (code === 404 || code === 410) {
      return DOWNLOAD_ITEM_GONE;
    }
    if (code >= 500) {
      return DOWNLOAD_SERVER_ERROR;
    }
    return `The server rejected the download (HTTP ${code}).`;
  }
  if (DISK_FULL_SHAPE.test(text)) {
    return DOWNLOAD_DISK_FULL;
  }
  if (text === 'Empty response body') {
    return DOWNLOAD_EMPTY_BODY;
  }
  if (CONNECTIVITY_SHAPE.test(text)) {
    return DOWNLOAD_CONNECTIVITY;
  }
  if (RESOURCE_GONE_SHAPE.test(text)) {
    return DOWNLOAD_ITEM_GONE;
  }
  return DOWNLOAD_GENERIC;
};

function getNativeDownloader(): PhlixDownloaderInterface | undefined {
  return NativeModules.PhlixDownloader as PhlixDownloaderInterface | undefined;
}

class DownloadService {
  private activeDownloads: Set<string> = new Set();
  private listeners: Set<(task: DownloadTask) => void> = new Set();
  private resumeData: Map<string, { downloadedBytes: number }> = new Map();
  private eventSubscriptions: EmitterSubscription[] = [];
  // M3 (deferred lane): wifi-gate subscriptions + pump coalescing state.
  private networkUnsubscribe: (() => void) | undefined;
  private settingsUnsubscribe: (() => void) | undefined;
  private queuePumpRunning = false;
  private queuePumpRerun = false;

  constructor() {
    useDownloadStore.getState().loadPersistedTasks();
    this.initNativeEvents();
    this.armWifiGateWatchers();
  }

  /**
   * M3 (deferred lane): data-plan gate wiring. Every connectivity change (and
   * every flip of `downloadOverWifiOnly`) re-runs the queue, so tasks that
   * were held on cellular auto-start the moment the connection leaves it —
   * no user action, no polling. The NetInfo listener contract also fires the
   * callback once with the CURRENT state on subscribe; a queue-empty pump is
   * a cheap no-op there.
   */
  private armWifiGateWatchers(): void {
    this.networkUnsubscribe = onNetworkChange(() => this.processQueue());
    try {
      this.settingsUnsubscribe = useSettingsStore.subscribe((state, prev) => {
        if (state.downloadOverWifiOnly !== prev.downloadOverWifiOnly) {
          this.processQueue();
        }
      });
    } catch {
      // Subscription is a nicety; the NetInfo arm + normal event pumps still
      // cover the common paths if the store shape ever changes.
      this.settingsUnsubscribe = undefined;
    }
  }

  /**
   * Subscribe to the native PhlixDownloader event stream. Guarded so it is a
   * no-op when the native module is absent (Jest), which keeps module load
   * harmless before the native side is built — the download START itself
   * fails loudly in that state (MW-027), it is never simulated.
   */
  private initNativeEvents(): void {
    const downloader = getNativeDownloader();
    if (!downloader) {
      return;
    }
    let emitter: NativeEventEmitter;
    try {
      emitter = new NativeEventEmitter(
        downloader as unknown as ConstructorParameters<typeof NativeEventEmitter>[0],
      );
    } catch {
      // NativeEventEmitter can throw if the module isn't a real emitter —
      // degrade to no live progress events rather than crashing the service.
      return;
    }
    this.eventSubscriptions = [
      emitter.addListener(DOWNLOAD_EVENTS.progress, (payload: object) => {
        const p = payload as DownloadProgressPayload;
        this.handleNativeProgress(p.taskId, p.downloadedBytes, p.totalBytes);
      }),
      emitter.addListener(DOWNLOAD_EVENTS.complete, (payload: object) => {
        const p = payload as DownloadCompletePayload;
        this.handleNativeComplete(p.taskId, p.localPath);
      }),
      emitter.addListener(DOWNLOAD_EVENTS.error, (payload: object) => {
        const p = payload as DownloadErrorPayload;
        this.handleNativeError(p.taskId, p.error);
      }),
      emitter.addListener(DOWNLOAD_EVENTS.paused, (payload: object) => {
        const p = payload as DownloadPausedPayload;
        this.handleNativePaused(p.taskId, p.downloadedBytes);
      }),
    ];
  }

  /**
   * Remove all native event subscriptions. Not used in the normal app lifecycle
   * (the service is an app-lifetime singleton) but provided for completeness /
   * tests so listeners can be torn down deterministically.
   */
  dispose(): void {
    this.eventSubscriptions.forEach((sub) => sub.remove());
    this.eventSubscriptions = [];
    this.networkUnsubscribe?.();
    this.settingsUnsubscribe?.();
  }

  async startDownload(item: MediaItem, quality = 'original'): Promise<string> {
    const store = useDownloadStore.getState();
    const existingTask = Object.values(store.tasks).find(
      (t) => t.itemId === item.id && t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'failed'
    );
    if (existingTask) {
      return existingTask.id;
    }

    const taskId = await store.addDownload(item, quality);
    this.processQueue();
    return taskId;
  }

  pauseDownload(taskId: string): void {
    const store = useDownloadStore.getState();
    const task = store.tasks[taskId];
    if (!task || task.status !== 'downloading') {
      return;
    }

    const PhlixDownloader = getNativeDownloader();
    if (PhlixDownloader?.pauseDownload) {
      PhlixDownloader.pauseDownload(taskId);
    } else {
      store.updateTaskStatus(taskId, 'paused');
    }
    this.activeDownloads.delete(taskId);
    this.processQueue();
  }

  resumeDownload(taskId: string): void {
    const store = useDownloadStore.getState();
    const task = store.tasks[taskId];
    if (!task || task.status !== 'paused') {
      return;
    }
    store.updateTaskStatus(taskId, 'queued');
    this.processQueue();
  }

  async cancelDownload(taskId: string): Promise<void> {
    const store = useDownloadStore.getState();
    const PhlixDownloader = getNativeDownloader();
    if (PhlixDownloader?.cancelDownload) {
      PhlixDownloader.cancelDownload(taskId);
    }
    this.activeDownloads.delete(taskId);
    this.resumeData.delete(taskId);
    await store.removeDownload(taskId);
    this.processQueue();
  }

  retryDownload(taskId: string): void {
    useDownloadStore.getState().retryDownload(taskId);
    this.processQueue();
  }

  subscribe(callback: (task: DownloadTask) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getAllDownloads(): DownloadTask[] {
    return Object.values(useDownloadStore.getState().tasks);
  }

  getCompletedDownloads(): DownloadTask[] {
    return useDownloadStore.getState().getCompletedDownloads();
  }

  getDownloadForItem(itemId: string): DownloadTask | undefined {
    return useDownloadStore.getState().getDownloadForItem(itemId);
  }

  isItemDownloaded(itemId: string): boolean {
    return useDownloadStore.getState().isItemDownloaded(itemId);
  }

  getItemLocalPath(itemId: string): string | null {
    return useDownloadStore.getState().getItemLocalPath(itemId);
  }

  async deleteDownload(taskId: string): Promise<void> {
    const store = useDownloadStore.getState();
    const task = store.tasks[taskId];
    if (!task || task.status !== 'completed') {
      return;
    }

    const PhlixDownloader = getNativeDownloader();
    if (PhlixDownloader?.deleteFile) {
      try { await PhlixDownloader.deleteFile(task.localPath); } catch {}
    }
    await store.removeDownload(taskId);
  }

  /**
   * Queue pump. Kept a synchronous-void entry point (every existing call
   * site treats it as fire-and-forget); the async body runs at most once at
   * a time, and a kick that arrives mid-pump is COALESCED into one re-run so
   * a state change during the network probe can never be swallowed.
   */
  processQueue(): void {
    if (this.queuePumpRunning) {
      this.queuePumpRerun = true;
      return;
    }
    this.queuePumpRunning = true;
    this.pumpQueue().finally(() => {
      this.queuePumpRunning = false;
      if (this.queuePumpRerun) {
        this.queuePumpRerun = false;
        this.processQueue();
      }
    });
  }

  private async pumpQueue(): Promise<void> {
    const store = useDownloadStore.getState();
    const tasks = Object.values(store.tasks);
    const activeCount = tasks.filter((t) => t.status === 'downloading').length;
    if (activeCount >= MAX_CONCURRENT_DOWNLOADS) {
      return;
    }
    const queued = tasks.filter((t) => t.status === 'queued');
    if (queued.length === 0) {
      return;
    }
    // M3 (deferred lane): the Wi-Fi-only gate, made real by netinfo. Held
    // tasks STAY 'queued' (visible as waiting in the list) and start via the
    // watcher the moment the connection leaves cellular.
    if (useSettingsStore.getState().downloadOverWifiOnly && (await isCellularNow())) {
      return;
    }
    // The probe above is async — re-read the slot; it may have been
    // cancelled or started by a concurrent event while we awaited.
    const fresh = useDownloadStore.getState().tasks[queued[0].id];
    if (!fresh || fresh.status !== 'queued') {
      return;
    }
    this.beginDownload(fresh);
  }

  private async beginDownload(task: DownloadTask): Promise<void> {
    const taskId = task.id;
    this.activeDownloads.add(taskId);

    const store = useDownloadStore.getState();
    store.updateTaskStatus(taskId, 'downloading');

    try {
      // MW-027 (review mobile__crossfe #14): with the native downloader
      // unregistered this device CANNOT produce a playable file — the old
      // lane ran a simulator that faked progress to 100% and marked the task
      // 'completed' over a path never written: a phantom-complete offline
      // promise. Fail the task LOUDLY with the named missing-module reason,
      // and fail BEFORE the stream-URL dial, which is wasted network for
      // work this build cannot do.
      const PhlixDownloader = getNativeDownloader();
      if (!PhlixDownloader?.startDownload) {
        throw new Error(
          'Downloads are unavailable in this build: the PhlixDownloader native module is not registered'
        );
      }

      // E2: getStreamUrl resolves the signed direct-play URL from media detail.
      // The total size is not known up front (no transcode probe here) — pass 0
      // and let the native downloader report the real size as it streams.
      // TODO(E3): use the transcode probe / Content-Length for an accurate total.
      const streamUrl = await playbackManager.getStreamUrl(task.itemId);
      if (!streamUrl) {
        throw new Error('No downloadable stream available for this item');
      }
      const localPath = this.getLocalPath(task.item);
      store.updateTaskProgress(taskId, task.resumeOffset ?? 0, 0);

      // 5-arg shape (taskId, url, localPath, resumeOffset, totalBytesHint) —
      // identical across the TS interface and both native modules.
      PhlixDownloader.startDownload(taskId, streamUrl, localPath, task.resumeOffset ?? 0, 0);
    } catch (err) {
      // MW-098's sibling on this surface (review mobile__casualgamer #1/#2):
      // the app's own throws above ("No downloadable stream available…") are
      // already user prose and ride through quarantine unchanged; axios junk
      // is replaced by the door's catalog/transport/fallback precedence.
      store.updateTaskStatus(taskId, 'failed', apiErrorMessage(err, 'The download could not be started — try again.'));
      this.activeDownloads.delete(taskId);
      this.processQueue();
    }
  }

  // (MW-027 removed the `downloadSimulated` lane that once lived here: with
  // no native writer it could only ever fabricate completion. beginDownload
  // now refuses the work up front instead.)

  private getLocalPath(item: MediaItem): string {
    // BOTH wire-supplied parts are sanitized, not just the title: `item.id` is
    // server content, and an unsanitized id smuggles path separators
    // ('../../etc/x') or bare dots ('..') into the filename, escaping the
    // download directory (review M-MOBILE-30). Server ids are UUIDs, so the
    // class-preserving replace is a no-op on honest input.
    const safeId = item.id.replace(/[^a-z0-9]/gi, '_');
    const safeName = item.name.replace(/[^a-z0-9]/gi, '_');
    const filename = `${safeId}_${safeName}.mp4`;
    // BOTH platforms consume the native-published `documentsPath` constant
    // (review mobile__crossfe M1). The Android arm used to return a hardcoded
    // a shared-storage Downloads path: at targetSdk 36, enforced
    // scoped storage forbids raw File creation in shared external storage
    // (no MANAGE_EXTERNAL_STORAGE is declared and the legacy
    // WRITE_EXTERNAL_STORAGE is a no-op at this target), while the native
    // module already exported its private `reactContext.filesDir` as
    // `documentsPath` — which the JS side simply ignored. The Kotlin side
    // writes exactly the path JS hands it, so the JS↔native contract is now
    // ONE constant on both platforms. Since MW-027 the module-absent build
    // fails in `beginDownload` before reaching here, so every destination
    // this returns is handed to a REGISTERED native writer; the `|| ''` tier
    // stays as the published-constant-not-present degrade.
    const docsPath = getNativeDownloader()?.documentsPath || '';
    return `${docsPath}/${filename}`;
  }

  handleNativeProgress(taskId: string, downloadedBytes: number, totalBytes: number): void {
    const store = useDownloadStore.getState();
    store.updateTaskProgress(taskId, downloadedBytes, totalBytes);
    this.resumeData.set(taskId, { downloadedBytes });
    const updated = store.tasks[taskId];
    if (updated) {
      this.notifyListeners(updated);
    }
  }

  handleNativeComplete(taskId: string, localPath: string): void {
    const store = useDownloadStore.getState();
    store.updateTaskLocalPath(taskId, localPath);
    store.updateTaskStatus(taskId, 'completed');
    this.activeDownloads.delete(taskId);
    this.resumeData.delete(taskId);
    const updated = store.tasks[taskId];
    if (updated) {
      this.notifyListeners(updated);
      // Review mobile__crossfe M3: the notification subsystem used to be
      // dead-wired (zero production call sites). Download completion is the
      // one user-visible event this app can emit locally; the settings gate
      // is what makes the enableNotifications toggle real (M-01 theater).
      if (useSettingsStore.getState().enableNotifications) {
        // M-MOBILE-72 (review mobile__casualgamer Minor 2): the ask now
        // happens HERE — the first moment a notification would matter —
        // instead of a cold-boot popup. After an earlier denial the OS does
        // not re-show a dialog; requestPermissions just re-reads status, so
        // this is never a nag.
        notificationService.requestPermissions().then((granted) => {
          if (!granted) {
            return;
          }
          notificationService.showLocalNotification({
            title: 'Download complete',
            message: `${updated.item.name} is ready for offline playback.`,
            type: 'download_complete',
            data: { itemId: updated.itemId },
          });
        }).catch(() => undefined);
      }
    }
    this.processQueue();
  }

  handleNativeError(taskId: string, error: string): void {
    // MW-045: the user gets the mapped prose; the raw native/OS string stays
    // in the console for field diagnosis (it is never user-facing copy).
    console.warn(`[DownloadService] native failure for ${taskId}: ${error}`);
    const store = useDownloadStore.getState();
    store.updateTaskStatus(taskId, 'failed', describeDownloadFailure(error));
    this.activeDownloads.delete(taskId);
    this.processQueue();
  }

  handleNativePaused(taskId: string, downloadedBytes: number): void {
    const store = useDownloadStore.getState();
    this.resumeData.set(taskId, { downloadedBytes });
    store.updateTaskStatus(taskId, 'paused');
    this.activeDownloads.delete(taskId);
    this.processQueue();
  }

  private notifyListeners(task: DownloadTask): void {
    this.listeners.forEach((cb) => cb(task));
  }
}

export const downloadService = new DownloadService();
export default downloadService;
