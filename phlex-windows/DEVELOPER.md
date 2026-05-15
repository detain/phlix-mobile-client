# Phlex Windows - Developer Guide

This document provides detailed information for developers working on the Phlex Windows desktop application.

## Architecture Overview

The Phlex Windows app follows the standard Electron architecture with three distinct processes:

```
┌─────────────────────────────────────────────────────────┐
│                    MAIN PROCESS                         │
│  - Window management                                     │
│  - System tray                                           │
│  - Native menus                                         │
│  - IPC handlers                                         │
│  - App lifecycle                                        │
└─────────────────────────────────────────────────────────┘
                           │
                    contextBridge
                    (preload/index.ts)
                           │
┌─────────────────────────────────────────────────────────┐
│                   RENDERER PROCESS                        │
│  - React application                                     │
│  - Zustand stores                                        │
│  - React Router                                          │
│  - UI components                                         │
└─────────────────────────────────────────────────────────┘
```

### Main Process (`src/main/index.ts`)

The main process is responsible for:

1. **Window Creation and Management**
   - Creates `BrowserWindow` with security settings
   - Handles window events (ready-to-show, close, closed)
   - Manages window state (fullscreen, always-on-top)

2. **System Tray**
   - Creates tray icon with context menu
   - Provides media control shortcuts
   - Click to show/hide main window

3. **Application Menu**
   - File menu (Open File, Settings, Quit)
   - Playback menu (Play/Pause, Stop, Rewind, Forward, Fullscreen)
   - View menu (Reload, DevTools, Zoom, Fullscreen)
   - Help menu (About)

4. **IPC Communication**
   - `get-app-path` - Returns user data directory
   - `get-version` - Returns app version
   - `set-always-on-top` - Toggle window always-on-top
   - `minimize-to-tray` - Hide window to tray

5. **Logging**
   - Uses `electron-log` for comprehensive logging
   - Logs to `%APPDATA%\phlex-windows\logs\`
   - Global exception handlers for uncaught errors

### Preload Script (`src/preload/index.ts`)

The preload script uses `contextBridge` to expose safe APIs to the renderer:

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Window controls
  setAlwaysOnTop: (value: boolean) => ipcRenderer.send('set-always-on-top', value),
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),

  // Media controls (from main to renderer)
  onMediaPlayPause: (callback: () => void) => { ... },
  onMediaStop: (callback: () => void) => { ... },
  onMediaRewind: (callback: () => void) => { ... },
  onMediaForward: (callback: () => void) => { ... },

  // File handling
  onFileOpened: (callback: (filePath: string) => void) => { ... },

  // Settings
  onOpenSettings: (callback: () => void) => { ... }
});
```

### Renderer Process (`src/renderer/`)

The renderer is a standard React 18 application:

```
src/renderer/
├── components/       # Reusable UI components
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   ├── MediaGrid.tsx
│   └── VideoPlayer.tsx
├── pages/           # Route-level components
│   ├── Home.tsx
│   ├── Library.tsx
│   ├── ItemDetail.tsx
│   ├── Player.tsx
│   ├── Settings.tsx
│   └── Login.tsx
├── stores/          # Zustand state stores
│   ├── authStore.ts
│   ├── playbackStore.ts
│   └── uiStore.ts
├── utils/          # Utilities and API client
│   └── api.ts
├── styles/         # Global CSS
│   └── global.css
├── App.tsx         # Root component with routing
└── main.tsx        # React entry point
```

## Component Structure

### Pages (Route Components)

Pages are the top-level components that correspond to routes:

| Page | Route | Purpose |
|------|-------|---------|
| `Home` | `/` | Dashboard with library overview |
| `Library` | `/library/:id` | Browse specific library |
| `ItemDetail` | `/item/:id` | View item details |
| `Player` | `/player/:id` | Full-screen media player |
| `Settings` | `/settings` | App settings |
| `Login` | - | Authentication (shown when not authenticated) |

### Components

**Header** - Top navigation bar with search and user menu

**Sidebar** - Left navigation with:
- Home link
- Library sections
- Settings access

**MediaGrid** - Grid display for media items with thumbnails

**VideoPlayer** - Video playback with controls (play/pause, seek, volume, fullscreen)

### State Management with Zustand

The app uses Zustand for state management with three stores:

#### authStore (`stores/authStore.ts`)

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}
```

#### playbackStore (`stores/playbackStore.ts`)

Manages media playback state:
- Currently playing item
- Play/pause state
- Volume
- Progress

#### uiStore (`stores/uiStore.ts`)

Manages UI state:
- Sidebar expanded/collapsed
- Active modals
- Loading states

## Building and Testing

### Development Workflow

1. **Start development mode:**
   ```bash
   npm run dev
   ```

2. **Code changes:**
   - Main process: Electron auto-launches via `wait-on`
   - Renderer: Vite hot reloads automatically

3. **Debug:**
   - Open DevTools (View > Toggle Developer Tools)
   - Main process logs in terminal
   - Renderer logs in DevTools console

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm test -- --watch

# Run with coverage report
npm test -- --coverage
```

### Test Structure

Tests use Vitest with TypeScript:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('ApiClient', () => {
  beforeEach(() => {
    // Setup before each test
    localStorage.removeItem('auth_token');
  });

  it('should store token when setToken is called', () => {
    api.setToken('test-token');
    expect(localStorage.getItem('auth_token')).toBe('test-token');
  });
});
```

### TypeScript Configuration

The project uses separate TypeScript configs:

- **tsconfig.json** - Renderer/Node targets ES2020 with DOM libs
- **tsconfig.main.json** - Main process targets CommonJS for Electron compatibility

### Build Pipeline

1. **Vite build** (`npm run build:vite`)
   - Bundles React app with TypeScript
   - Outputs to `dist/renderer/`

2. **Electron build** (`npm run build:electron`)
   - Compiles main process TypeScript
   - Compiles preload script
   - Outputs to `dist/main/`

3. **Package** (`npm run package`)
   - Uses electron-builder
   - Creates NSIS installer and APPX package
   - Output in `release/`

## Security Considerations

### Context Isolation

The app enables context isolation and disables node integration:

```typescript
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false
}
```

### IPC Security

- All IPC uses `invoke`/`send` pattern
- Preload exposes only necessary APIs via `contextBridge`
- No direct `ipcRenderer` access in renderer

### Content Security

- External links open in default browser via `shell.openExternal()`
- Renderer loads local content in production

## Adding New Features

### Adding a New IPC Handler

1. **Main process** (`src/main/index.ts`):
   ```typescript
   ipcMain.handle('my-handler', async (event, ...args) => {
     // Handle the request
     return result;
   });
   ```

2. **Preload** (`src/preload/index.ts`):
   ```typescript
   myHandler: (...args) => ipcRenderer.invoke('my-handler', ...args),
   ```

3. **Renderer** - Use via `window.electronAPI.myHandler()`

### Adding a New Store

1. Create `src/renderer/stores/myStore.ts`:
   ```typescript
   import { create } from 'zustand';

   interface MyState {
     value: string;
     setValue: (value: string) => void;
   }

   export const useMyStore = create<MyState>((set) => ({
     value: '',
     setValue: (value) => set({ value }),
   }));
   ```

2. Import and use in components:
   ```typescript
   import { useMyStore } from './stores/myStore';

   const MyComponent = () => {
     const { value, setValue } = useMyStore();
     // ...
   };
   ```

### Adding New Routes

1. Add route in `App.tsx`:
   ```typescript
   <Route path="/new-page" element={<NewPage />} />
   ```

2. Create the page component in `pages/`

3. Add navigation link in `Sidebar.tsx`

## Troubleshooting

### Main process not reloading

Main process requires full app restart. Run:
```bash
npm run dev
```

### Preload script errors

Ensure `tsconfig.main.json` includes preload files and outputs to correct location.

### Renderer not loading

Check:
- Vite server is running on port 5173
- Main process `isDev` detection is correct
- Preload path is correct in production

### Tests failing with localStorage

Wrap tests with jsdom environment or mock localStorage in tests.

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [Zustand Documentation](https://zustand.docs.pmnd.rs)
- [Vite Documentation](https://vitejs.dev)
- [Vitest Documentation](https://vitest.dev)
