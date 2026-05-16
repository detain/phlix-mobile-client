declare module 'react-native-push-notification' {
  interface Notification {
    title?: string;
    message: string;
    subText?: string;
    tag?: string;
    group?: string;
    userInfo?: object;
    playSound?: boolean;
    soundName?: string;
    vibrate?: boolean;
    vibration?: number;
    priority?: 'max' | 'high' | 'normal' | 'low' | 'min';
    importance?: 'max' | 'high' | 'normal' | 'low' | 'min' | 'none' | 'unspecified';
    actions?: string[];
    fireDate?: Date;
    repeatType?: 'week' | 'day' | 'hour' | 'minute' | 'time';
    repeatTime?: number;
    number?: number;
    ledColor?: string;
    ledOnMs?: number;
    ledOffMs?: number;
    bigText?: string;
    subText?: string;
    ticker?: string;
    autoCancel?: boolean;
    largeIcon?: string;
    smallIcon?: string;
    bigPictureUrl?: string;
    shortcutId?: string;
    channelId?: string;
    onlyAlertOnce?: boolean;
    id?: string | number;
    data?: object;
  }

  interface Permissions {
    alert?: boolean;
    badge?: boolean;
    sound?: boolean;
  }

  export class PushNotification {
    constructor(options?: Notification);
    static configure(options: {
      onRegister?: (token: { token: string }) => void;
      onNotification?: (notification: Notification) => void;
      onAction?: (notification: Notification) => void;
      onRegistrationError?: (error: Error) => void;
      permissions?: Permissions;
      popInitialNotification?: boolean;
      requestPermissions?: boolean | string[];
    }): PushNotification;
    static requestPermissions(): Promise<Permissions>;
    static checkPermissions(): Promise<Permissions>;
    static abandonPermissions(): void;
    static getInitialNotification(): Promise<Notification | null>;
    static createChannel(channel: {
      id: string;
      channelName: string;
      channelDescription?: string;
      playSound?: boolean;
      soundName?: string;
      importance?: number;
      vibrate?: boolean;
      vibration?: number;
    }): void;
    static deleteChannel(channelId: string): void;
    static subscribe(topic: string, handler: (notification: Notification) => void): void;
    static unsubscribe(topic: string): void;
    requestPermissions(permissions?: string[]): Promise<Permissions>;
    checkPermissions(): Promise<Permissions>;
    abandonPermissions(): void;
    getScheduledLocalNotifications(): Promise<Notification[]>;
    cancelNotifications(): void;
    cancelLocalNotification(id: string | number): void;
    clearNotifications(): void;
    setApplicationIconBadgeNumber(number: number): void;
    getApplicationIconBadgeNumber(): Promise<number>;
    popInitialNotification(): Promise<Notification | null>;
    localNotification(notification: Notification): void;
    localNotificationSchedule(notification: Notification): void;
    scheduleNotification(notification: Notification): void;
    showNotification(id: string | number, title: string, message: string, options?: Notification): void;
    destroyNotification(id: string | number): void;
    getChannels(): Promise<string[]>;
    getChannelsSync(): string[];
    channelNotification(channelId: string, notification: Notification): void;
    deleteChannelNotification(channelId: string, notificationId: string | number): void;
  }

  export default {
    configure: PushNotification.configure,
    requestPermissions: PushNotification.requestPermissions,
    checkPermissions: PushNotification.checkPermissions,
    abandonPermissions: PushNotification.abandonPermissions,
    getInitialNotification: PushNotification.getInitialNotification,
    createChannel: PushNotification.createChannel,
    deleteChannel: PushNotification.deleteChannel,
    subscribe: PushNotification.subscribe,
    unsubscribe: PushNotification.unsubscribe,
  };
}
