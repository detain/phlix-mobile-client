import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Window controls
  setAlwaysOnTop: (value: boolean) => ipcRenderer.send('set-always-on-top', value),
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),

  // Media controls from main process
  onMediaPlayPause: (callback: () => void) => {
    ipcRenderer.on('media-play-pause', callback);
    return () => ipcRenderer.removeListener('media-play-pause', callback);
  },
  onMediaStop: (callback: () => void) => {
    ipcRenderer.on('media-stop', callback);
    return () => ipcRenderer.removeListener('media-stop', callback);
  },
  onMediaRewind: (callback: () => void) => {
    ipcRenderer.on('media-rewind', callback);
    return () => ipcRenderer.removeListener('media-rewind', callback);
  },
  onMediaForward: (callback: () => void) => {
    ipcRenderer.on('media-forward', callback);
    return () => ipcRenderer.removeListener('media-forward', callback);
  },

  // File handling
  onFileOpened: (callback: (filePath: string) => void) => {
    ipcRenderer.on('file-opened', (_, filePath) => callback(filePath));
    return () => ipcRenderer.removeAllListeners('file-opened');
  },

  // Settings
  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on('open-settings', callback);
    return () => ipcRenderer.removeListener('open-settings', callback);
  }
});
