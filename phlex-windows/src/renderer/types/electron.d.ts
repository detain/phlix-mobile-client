export {};

declare global {
  interface Window {
    electronAPI: {
      getAppPath: () => Promise<string>;
      getVersion: () => Promise<string>;
      setAlwaysOnTop: (value: boolean) => void;
      minimizeToTray: () => void;
      onMediaPlayPause: (callback: () => void) => () => void;
      onMediaStop: (callback: () => void) => () => void;
      onMediaRewind: (callback: () => void) => () => void;
      onMediaForward: (callback: () => void) => () => void;
      onFileOpened: (callback: (filePath: string) => void) => () => void;
      onOpenSettings: (callback: () => void) => () => void;
    };
  }
}
