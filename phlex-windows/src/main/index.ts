import { app, BrowserWindow, Menu, Tray, ipcMain, shell, nativeImage } from 'electron';
import * as path from 'path';
import log from 'electron-log';
import Store from 'electron-store';

const store = new Store();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

log.initialize();
log.info('Phlex Windows starting...');

function createWindow(): void {
  log.info('Creating main window');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#1a1a2e',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Load content
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    log.info('Main window ready');
  });

  // Handle close to tray
  mainWindow.on('close', (event) => {
    if (store.get('minimizeToTray', true)) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createTray(): void {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '../../build/icon.png')
  );

  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Phlex', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Play/Pause', click: () => mainWindow?.webContents.send('media-play-pause') },
    { label: 'Stop', click: () => mainWindow?.webContents.send('media-stop') },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      store.set('minimizeToTray', false);
      app.quit();
    }}
  ]);

  tray.setToolTip('Phlex Media Server');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow?.show();
  });
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Open File...', accelerator: 'CmdOrCtrl+O', click: () => openFile() },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => openSettings() },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Playback',
      submenu: [
        { label: 'Play/Pause', accelerator: 'Space', click: () => mainWindow?.webContents.send('media-play-pause') },
        { label: 'Stop', click: () => mainWindow?.webContents.send('media-stop') },
        { type: 'separator' },
        { label: 'Rewind', accelerator: 'Left', click: () => mainWindow?.webContents.send('media-rewind') },
        { label: 'Fast Forward', accelerator: 'Right', click: () => mainWindow?.webContents.send('media-forward') },
        { type: 'separator' },
        { label: 'Fullscreen', accelerator: 'F11', click: () => toggleFullscreen() }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About Phlex', click: () => showAbout() }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function openFile(): Promise<void> {
  const { dialog } = await import('electron');
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'webm'] },
      { name: 'Audio Files', extensions: ['mp3', 'flac', 'aac', 'ogg', 'wav', 'm4a'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow?.webContents.send('file-opened', result.filePaths[0]);
  }
}

function openSettings(): void {
  mainWindow?.webContents.send('open-settings');
}

function toggleFullscreen(): void {
  if (!mainWindow) return;

  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  } else {
    mainWindow.setFullScreen(true);
  }
}

function showAbout(): void {
  const { dialog } = require('electron');
  dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'About Phlex',
    message: 'Phlex Media Server',
    detail: `Version ${app.getVersion()}\n\nA free media server for your home.`
  });
}

// IPC Handlers
ipcMain.handle('get-app-path', () => app.getPath('userData'));

ipcMain.handle('get-version', () => app.getVersion());

ipcMain.on('set-always-on-top', (_, value: boolean) => {
  mainWindow?.setAlwaysOnTop(value);
});

ipcMain.on('minimize-to-tray', () => {
  mainWindow?.hide();
});

// App lifecycle
app.whenReady().then(() => {
  log.info('App ready');
  createWindow();
  createMenu();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  store.set('minimizeToTray', false);
});

// Global exception handler
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason);
});
