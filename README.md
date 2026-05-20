# Phlix Mobile

A cross-platform mobile application for media playback, built with React Native. Phlix connects to your media server to provide a seamless experience for watching movies, TV shows, listening to music, and browsing photos.

## Project Overview

Phlix Mobile is a React Native application designed to interface with media servers (such as Jellyfin, Emby, or compatible APIs). It provides a native mobile experience with:

- **Movies & TV Series**: Browse, search, and play media content
- **Music Playback**: Listen to your music library with full playback controls
- **Photo Albums**: View your photo collections
- **Offline Downloads**: Download content for offline viewing
- **Cross-Platform**: Available on both iOS and Android

## Features

### Core Features

- **User Authentication**: Secure login with token-based authentication and automatic token refresh
- **Media Library**: Browse movies, series, music, and photos organized by library
- **Media Playback**: Full-featured video player with seek, volume, playback speed controls
- **Subtitle Support**: Multiple subtitle tracks and audio tracks
- **Search**: Global search across all media types
- **User Preferences**: Customizable playback settings and app preferences
- **Continue Watching**: Resume playback from where you left off
- **Downloads**: Download media for offline playback

### Hub Mode

Phlix Mobile supports **Hub Mode** for remote access to your media servers:

- **Sign in to Hub**: Authenticate with a Phlix Hub to access your claimed servers
- **Multi-Server Support**: View and manage multiple claimed servers from a single app
- **Server Switching**: Quickly switch between servers with the Server Switcher
- **Direct Mode**: Connect directly to your server over LAN when on the same network
- **Relay Mode**: Connect to your server remotely via the Hub relay when away from home

#### Hub Connection Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Direct** | Connects directly to server hostname (e.g., `https://192.168.1.100:32400`) | Same network as server |
| **Via Hub Relay** | Routes traffic through Hub relay endpoint | Remote access when not on same network |

Hub session data is persisted securely using `AsyncStorage`, allowing seamless reconnection across app restarts.

### Technical Features

- **React Native** with TypeScript for type safety
- **Zustand** for lightweight state management
- **React Navigation** for navigation flows
- **Native Modules** for optimal video playback performance
- **Secure Storage** for authentication tokens
- **CI/CD Pipeline** with GitHub Actions

## Prerequisites

Before you begin, ensure you have the following installed:

### Common Requirements

- **Node.js** (v18.x or later)
- **npm** (v9.x or later) or **yarn** (v1.22.x or later)
- **Git** (v2.x or later)

### iOS Development

- **Xcode** (v15.0 or later)
- **CocoaPods** (`sudo gem install cocoapods`)
- **macOS** (required for iOS development)
- **Apple Developer Account** (for device deployment)

### Android Development

- **Android Studio** (latest stable version)
- **Android SDK** (API level 24 or higher)
- **Java Development Kit** (JDK 17 or higher)
- **Gradle** (included via Android Studio)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/phlix-mobile.git
cd phlix-mobile
```

### 2. Install Dependencies

```bash
# Using npm
npm install

# Or using yarn
yarn install
```

### 3. Install iOS Dependencies (macOS only)

```bash
cd ios && pod install && cd ..
```

### 4. Configure Environment

Create a `.env` file in the root directory (optional for development):

```env
API_BASE_URL=https://api.phlix.app
```

## Configuration

### API Configuration

The app connects to a media server API. Configure the base URL in:

- **Development**: Uses default `https://api.phlix.app`
- **Self-hosted**: Update `BASE_URL` in `src/api/client.ts`

### Native Module Configuration

#### iOS (PhlixPlayer)

The iOS player is implemented as a local CocoaPod in `ios/LocalPods/PhlixPlayer/`. It provides native video playback using AVPlayer.

#### Android (PhlixPlayer)

The Android player is implemented as a native module in `android/app/src/main/java/com/phlixmobile/player/`. It uses ExoPlayer for video playback.

### Building for iOS

#### Prerequisites

1. Ensure CocoaPods dependencies are installed
2. Open `ios/PhlixMobile.xcworkspace` in Xcode
3. Select your target device or simulator
4. Configure signing (if deploying to a real device)

#### Build Commands

```bash
# Using xcodebuild (requires macOS)
xcodebuild -workspace ios/PhlixMobile.xcworkspace \
  -scheme PhlixMobile \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  build

# Or build for release
xcodebuild -workspace ios/PhlixMobile.xcworkspace \
  -scheme PhlixMobile \
  -configuration Release \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  build
```

#### Running the App

```bash
# Start Metro bundler
npm start

# In another terminal, run on iOS simulator
npx react-native run-ios

# Or specify a device
npx react-native run-ios --device "iPhone 15"
```

### Building for Android

#### Prerequisites

1. Ensure Android SDK is properly configured
2. Set `ANDROID_HOME` environment variable
3. Add platform tools to PATH

#### Build Commands

```bash
# Debug build
cd android && ./gradlew assembleDebug

# Release build
cd android && ./gradlew assembleRelease
```

The APK will be generated at:
- Debug: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release: `android/app/build/outputs/apk/release/app-release.apk`

#### Running the App

```bash
# Start Metro bundler
npm start

# In another terminal, run on Android
npx react-native run-android
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- --testPathPattern="src/stores"
```

### Test Structure

Tests are located alongside source files with the naming convention:

```
src/
├── stores/
│   ├── __tests__/
│   │   └── usePlayerStore.test.ts
│   └── usePlayerStore.ts
├── api/
│   ├── __tests__/
│   │   └── client.test.ts
│   └── client.ts
```

### Linting

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

### Type Checking

```bash
# Run TypeScript type checking
npm run typecheck
```

## Deployment

### iOS

1. **TestFlight**: Use Xcode to archive and upload to App Store Connect
2. **App Store**: Create a new app in App Store Connect, then archive and distribute
3. **Enterprise**: Build for enterprise distribution as needed

### Android

1. **Google Play Store**: Sign the release APK and upload to Google Play Console
2. **Direct APK**: Distribute the unsigned or signed APK directly
3. **FDroid**: Build a release and publish to F-Droid repository

### CI/CD

The project includes GitHub Actions workflows for automated:

- **Testing**: Runs on every push and PR
- **iOS Build**: Builds iOS app (requires macOS runner, manual trigger)
- **Android Build**: Builds Android debug APK on every push

## Troubleshooting

### Common Issues

#### iOS Build Failures

- Ensure Xcode and Command Line Tools are up to date
- Run `cd ios && pod install` to refresh dependencies
- Clean build folder in Xcode: `Cmd + Shift + K`

#### Android Build Failures

- Verify Android SDK path: `echo $ANDROID_HOME`
- Clean Gradle cache: `cd android && ./gradlew clean`
- Ensure JDK 17 is being used

#### Metro Bundler Issues

- Reset cache: `npm start -- --reset-cache`
- Delete node_modules and reinstall

## Support

For issues and feature requests, please open an issue on the GitHub repository.

## License

This project is licensed under the MIT License.
