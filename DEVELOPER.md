# Phlix Mobile - Developer Guide

This document provides technical documentation for developers working on Phlix Mobile.

## Architecture Overview

Phlix Mobile follows a **modular architecture** with clear separation of concerns:

```
src/
├── api/           # API communication layer
├── components/    # Reusable UI components
├── navigation/    # Navigation configuration
├── native/        # Native module TypeScript interfaces
├── screens/       # Screen-level components
├── services/      # Business logic services
├── stores/        # Zustand state management
├── types/         # TypeScript type definitions
└── utils/         # Utility functions
```

### Layer Responsibilities

| Layer | Responsibility |
|-------|----------------|
| `api/` | HTTP client, authentication, API endpoints |
| `components/` | Reusable UI components (media cards, player controls) |
| `navigation/` | React Navigation setup and navigator components |
| `screens/` | Full-screen views, screen-specific logic |
| `services/` | Storage, notifications, downloads |
| `stores/` | Application state using Zustand |
| `types/` | TypeScript interfaces and types |
| `utils/` | Formatting, storage helpers |

## Component Structure

### Screen Components

Screens are located in `src/screens/` and represent full-screen views:

- **HomeScreen**: Main dashboard with library overview
- **LibraryScreen**: Browse media by library type
- **MediaDetailScreen**: Detailed view of a movie/series/music
- **PlayerScreen**: Full-screen video/audio playback
- **SearchScreen**: Global search functionality
- **SettingsScreen**: App preferences and user settings
- **DownloadsScreen**: Manage offline content
- **LoginScreen**: Authentication screen

### UI Components

Located in `src/components/`, organized by domain:

**Layout Components**
- `SafeContainer`: Safe area wrapper with consistent styling

**Media Components**
- `MediaCard`: Card view for media items
- `PosterCard`: Poster-style card for series/movies
- `MediaList`: Horizontal scrolling list of media
- `ContinueWatching`: Resume playback component

**Player Components**
- `PlayerControls`: Play/pause, seek controls
- `SeekBar`: Progress bar with scrubbing

**UI Components**
- `SearchBar`: Reusable search input
- `LoadingSpinner`: Loading indicator
- `EmptyState`: Empty list placeholder
- `ErrorView`: Error display component

## Native Module Design

### iOS - PhlixPlayer (Swift)

**Location**: `ios/LocalPods/PhlixPlayer/`

The iOS player is implemented as a local CocoaPod using AVPlayer:

```
ios/LocalPods/PhlixPlayer/
├── PhlixPlayer.podspec       # Pod specification
├── PhlixPlayerView.swift     # Swift UIView implementation
└── PhlixPlayerViewManager.m # React Native bridge (Obj-C)
```

**Key Features**:
- Native AVPlayer for video playback
- Support for HLS streams
- Subtitle rendering via AVPlayerLayer
- Playback rate control

**Integration**:
```typescript
// src/native/types.ts
interface PhlixPlayerViewProps {
  style?: ViewStyle;
  streamUrl: string;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onError?: (error: string) => void;
}
```

### Android - PhlixPlayer (Kotlin)

**Location**: `android/app/src/main/java/com/phlixmobile/player/`

The Android player is implemented as a React Native native module:

```
android/.../player/
├── PhlixPlayerView.kt         # Native view component
└── PhlixPlayerPackage.kt     # React Native package
```

**Key Features**:
- ExoPlayer for video playback
- Support for HLS and DASH streams
- Subtitle track selection
- Quality selection

### TypeScript Interfaces

**Location**: `src/native/types.ts`

```typescript
// Native module type definitions
interface NativePlaybackSession {
  id: string;
  mediaId: string;
  position: number;
  duration: number;
}

interface SubtitleTrack {
  id: string;
  language: string;
  label: string;
  codec: string;
}

interface AudioTrack {
  id: string;
  language: string;
  label: string;
  codec: string;
  channels: number;
}
```

## State Management

Phlix Mobile uses **Zustand** for state management - a lightweight alternative to Redux.

### Store Architecture

| Store | Purpose |
|-------|---------|
| `useAuthStore` | Authentication state, user session |
| `usePlayerStore` | Playback state, current media, tracks |
| `useLibraryStore` | Media libraries, cached content |
| `useSettingsStore` | User preferences, app settings |

### useAuthStore

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}
```

### usePlayerStore

```typescript
interface PlayerState {
  // Current playback
  currentItem: MediaItem | null;
  currentSession: PlaybackSession | null;
  streamInfo: StreamInfo | null;

  // Playback state
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;

  // Tracks
  subtitleTracks: SubtitleTrack[];
  currentSubtitleTrackId: string | null;
  audioTracks: AudioTrack[];
  currentAudioTrackId: string | null;

  // Actions
  setCurrentItem: (item: MediaItem | null) => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  // ... more actions
}
```

### useLibraryStore

```typescript
interface LibraryState {
  libraries: Library[];
  movies: MediaItem[];
  series: MediaItem[];
  music: MediaItem[];
  photos: MediaItem[];
  isLoading: boolean;
  fetchLibraries: () => Promise<void>;
  fetchLibraryContent: (libraryId: string) => Promise<void>;
}
```

### useSettingsStore

```typescript
interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  playbackQuality: 'auto' | '480p' | '720p' | '1080p' | '4k';
  subtitlesEnabled: boolean;
  subtitleLanguage: string;
  autoPlay: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
}
```

## API Layer

### Client Architecture

**Location**: `src/api/client.ts`

The API client uses Axios with:

- **Base URL**: Configurable via `BASE_URL` constant
- **Request Interceptor**: Automatically adds auth token to requests
- **Response Interceptor**: Handles 401 errors and token refresh
- **Timeout**: 30 seconds default

### Authentication Flow

1. User submits credentials via `AuthManager.login()`
2. Server returns `access_token` and `refresh_token`
3. Tokens stored in AsyncStorage
4. All subsequent requests include `Authorization: Bearer <token>`
5. On 401 response, interceptor attempts token refresh
6. If refresh fails, user is logged out

### API Managers

| Manager | Purpose |
|---------|---------|
| `AuthManager` | Login, logout, token refresh |
| `LibraryManager` | Fetch libraries, media items |
| `PlaybackManager` | Stream info, playback sessions |

## Building and Testing Guide

### Development Workflow

1. **Start Metro Bundler**
   ```bash
   npm start
   ```

2. **Run on iOS**
   ```bash
   npx react-native run-ios
   ```

3. **Run on Android**
   ```bash
   npx react-native run-android
   ```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific tests
npm test -- --testPathPattern="stores"

# Watch mode
npm test -- --watch
```

### TypeScript

```bash
# Type check without emitting
npm run typecheck

# Or use TypeScript compiler directly
npx tsc --noEmit
```

### Linting

```bash
# Run ESLint
npm run lint

# Fix issues
npm run lint -- --fix
```

### Native Module Development

#### iOS Native Module Updates

1. Modify files in `ios/LocalPods/PhlixPlayer/`
2. Run `pod install` in `ios/` directory
3. Clean and rebuild: `xcodebuild clean`
4. Verify in Xcode that changes compile

#### Android Native Module Updates

1. Modify files in `android/app/src/main/java/com/phlixmobile/player/`
2. Clean Gradle: `./gradlew clean`
3. Rebuild: `./gradlew assembleDebug`

### Debugging

#### JavaScript/React

- Use React DevTools
- Use Chrome DevTools (debugging via Metro)
- Add console.log statements

#### Native Code

**iOS**: Use Xcode's debugger and LLDB

**Android**: Use Android Studio's debugger and Logcat

```bash
# View Android logs
adb logcat | grep PhlixMobile
```

## Project Structure Summary

```
phlix-mobile/
├── src/
│   ├── api/
│   │   ├── client.ts         # Axios client with interceptors
│   │   ├── AuthManager.ts    # Authentication logic
│   │   ├── LibraryManager.ts # Library/media fetching
│   │   ├── PlaybackManager.ts# Playback session management
│   │   └── index.ts         # Re-exports
│   ├── components/
│   │   ├── layout/          # Layout components
│   │   ├── media/           # Media display components
│   │   ├── player/          # Player controls
│   │   └── ui/              # General UI components
│   ├── navigation/
│   │   ├── RootNavigator.tsx# Main navigation setup
│   │   └── index.ts
│   ├── native/
│   │   └── types.ts         # Native module interfaces
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── LibraryScreen.tsx
│   │   ├── MediaDetailScreen.tsx
│   │   ├── PlayerScreen.tsx
│   │   ├── SearchScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   ├── DownloadsScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   └── index.ts
│   ├── services/
│   │   ├── SecureStorage.ts # Secure token storage
│   │   ├── DownloadService.ts# Download management
│   │   ├── NotificationService.ts
│   │   └── index.ts
│   ├── stores/
│   │   ├── useAuthStore.ts  # Auth state
│   │   ├── usePlayerStore.ts# Playback state
│   │   ├── useLibraryStore.ts
│   │   ├── useSettingsStore.ts
│   │   └── index.ts
│   ├── types/
│   │   ├── media.ts         # Media item types
│   │   ├── navigation.ts    # Navigation types
│   │   └── playback.ts      # Playback types
│   ├── utils/
│   │   ├── formatters.ts    # Time, date formatting
│   │   ├── storage.ts       # AsyncStorage helpers
│   │   └── index.ts
│   ├── App.tsx              # Root component
│   └── index.ts             # Entry point
├── ios/
│   └── LocalPods/
│       └── PhlixPlayer/     # Native iOS player
├── android/
│   └── app/src/main/java/com/phlixmobile/player/
│       └── PhlixPlayerView.kt # Native Android player
├── .github/
│   └── workflows/          # CI/CD pipelines
└── assets/                  # Images, fonts
```
