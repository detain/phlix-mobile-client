/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/services/NotificationService.ts
/* eslint-disable no-void -- `void` marks intentional fire-and-forget notifee promises */
import notifee, {
  AndroidImportance,
  EventType,
  type Event,
} from '@notifee/react-native';
import { Platform } from 'react-native';

const GENERAL_CHANNEL_ID = 'phlix-general';
const PLAYBACK_CHANNEL_ID = 'phlix-playback';
// notifee identifies notifications by id; reuse a stable id for the ongoing
// playback notification so it can be updated / cancelled.
const PLAYBACK_NOTIFICATION_ID = 'phlix-playback';

// notifee's `data` field only accepts string | number | object values.
type NotificationData = Record<string, string | number | object>;

interface LocalNotificationInput {
  title: string;
  message: string;
  type?: string;
  data?: NotificationData;
}

class NotificationService {
  private initialized = false;

  constructor() {
    void this.configure();
  }

  /**
   * Request permission, create the Android channels and wire the foreground
   * event handler. Safe to call more than once (guarded).
   */
  private async configure(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    try {
      // M-MOBILE-72 (review mobile__casualgamer Minor 2): the OS permission
      // prompt used to fire from the CONSTRUCTOR — a cold-launch popup
      // before login, at the worst possible moment. Permission is now asked
      // only where it means something: the Notifications toggle (Settings)
      // and the first download that actually wants to notify
      // (DownloadService). Everything below is boot-safe — it never prompts.
      if (Platform.OS === 'android') {
        await notifee.createChannel({
          id: GENERAL_CHANNEL_ID,
          name: 'General',
          description: 'General notifications',
          importance: AndroidImportance.HIGH,
          vibration: true,
        });

        await notifee.createChannel({
          id: PLAYBACK_CHANNEL_ID,
          name: 'Playback',
          description: 'Media playback notifications',
          importance: AndroidImportance.LOW,
          vibration: false,
        });
      }

      notifee.onForegroundEvent(this.handleForegroundEvent);
    } catch (error) {
      console.error('Failed to configure notifications:', error);
    }
  }

  private handleForegroundEvent = ({ type, detail }: Event): void => {
    if (type !== EventType.PRESS) {
      return;
    }

    const data: NotificationData = detail.notification?.data ?? {};
    const notificationType =
      typeof data.type === 'string' ? data.type : undefined;

    switch (notificationType) {
      case 'library_update':
        this.handleLibraryUpdate(data);
        break;
      case 'new_content':
        this.handleNewContent(data);
        break;
      case 'sync_complete':
        this.handleSyncComplete(data);
        break;
      case 'download_complete':
        this.handleDownloadComplete(data);
        break;
      default:
        console.log('Unknown notification type:', notificationType);
    }
  };

  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    try {
      const settings = await notifee.requestPermission();
      // authorizationStatus >= 1 (AUTHORIZED / PROVISIONAL) means granted.
      return settings.authorizationStatus >= 1;
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return false;
    }
  }

  // Local notification
  showLocalNotification(notification: LocalNotificationInput): void {
    void notifee.displayNotification({
      title: notification.title,
      body: notification.message,
      data: {
        ...(notification.type ? { type: notification.type } : {}),
        ...(notification.data ?? {}),
      },
      android: {
        channelId: GENERAL_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
      },
    });
  }

  // Playback notification (Android)
  showPlaybackNotification(title: string, isPlaying: boolean): void {
    void notifee.displayNotification({
      id: PLAYBACK_NOTIFICATION_ID,
      title,
      body: isPlaying ? 'Now Playing' : 'Paused',
      android: {
        channelId: PLAYBACK_CHANNEL_ID,
        importance: AndroidImportance.LOW,
        ongoing: true,
        autoCancel: false,
      },
    });
  }

  // Cancel playback notification
  cancelPlaybackNotification(): void {
    void notifee.cancelNotification(PLAYBACK_NOTIFICATION_ID);
  }

  // M-MOBILE-85 (review mobile__crossfe Minor 22 + secnet m3): these four
  // handlers used to print their WHOLE payload data bags — library ids, titles
  // and download state readable by any on-device log reader (adb logcat /
  // sysdiagnose). Log the EVENT, never the payload.
  // Handle library update notification
  private handleLibraryUpdate(_data: NotificationData): void {
    // Navigate to library or refresh content
    console.log('[notifications] library_update');
  }

  // Handle new content notification
  private handleNewContent(_data: NotificationData): void {
    // Navigate to new content
    console.log('[notifications] new_content');
  }

  // Handle sync complete notification
  private handleSyncComplete(_data: NotificationData): void {
    console.log('[notifications] sync_complete');
  }

  // Handle download-complete notification (wired production call site:
  // DownloadService.handleNativeComplete, review mobile__crossfe M3).
  // Press-to-Downloads navigation needs a navigation ref at the service
  // layer — the same open seam as the sibling stubs above.
  private handleDownloadComplete(_data: NotificationData): void {
    console.log('[notifications] download_complete_pressed');
  }

  // Badges
  setBadgeCount(count: number): void {
    void notifee.setBadgeCount(count);
  }

  // Cancel all notifications
  cancelAll(): void {
    void notifee.cancelAllNotifications();
  }
}

export const notificationService = new NotificationService();
export default notificationService;
