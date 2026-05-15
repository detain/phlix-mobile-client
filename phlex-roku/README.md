# Phlex Media Server - Roku Application

A native Roku application for the Phlex Media Server platform.

## Features

- **Authentication**: Secure login with device registration
- **Library Browsing**: Browse movies, TV shows, and collections
- **Video Playback**: Stream video content with HLS support
- **Remote Control**: Full playback control via Roku remote
- **Progress Tracking**: Syncs watch progress with server

## Requirements

- Roku device with developer mode enabled
- Phlex Media Server running on your network
- Roku developer account

## Development Setup

### 1. Enable Developer Mode on Roku

1. Home: Press Home 5 times
2. Up: Press Up 2 times
3. Right: Press Right
4. Left: Press Left
5. Right: Press Left
6. Right: Press Left

Note the IP address shown and enable dev mode via the web interface.

### 2. Install BrightScript Extension

For VS Code, install the "BrightScript" extension by彩虹.

### 3. Configure Connection

Edit the server URL in the app or set via the settings screen.

## Project Structure

```
phlex-roku/
├── source/
│   ├── main.brs              # Main entry point
│   ├── lib/                  # Core libraries
│   │   ├── ApiClient.brs     # API client
│   │   ├── Storage.brs       # Persistent storage
│   │   ├── AuthManager.brs   # Authentication
│   │   ├── SessionManager.brs # Session management
│   │   ├── LibraryManager.brs # Library browsing
│   │   ├── TaskManager.brs    # Background tasks
│   │   └── Utilities.brs      # Helper functions
│   ├── components/           # Scene components
│   │   ├── PhlexApp.brs      # Main app
│   │   ├── HomeScene.brs      # Home screen
│   │   ├── LibraryScene.brs   # Library browser
│   │   ├── DetailScene.brs    # Item detail
│   │   ├── PlayerScene.brs    # Video player
│   │   ├── LoginScene.brs     # Login screen
│   │   └── GridItem.brs        # Grid item
│   ├── pages/                # Page controllers
│   └── data/                  # Theme and constants
├── images/                   # App assets
├── tests/                     # Test files
├── manifest                   # App manifest
└── Makefile                   # Build tools
```

## Building

```bash
# Create package
make package

# Install to device
make install ROKU_IP=192.168.1.100 ROKU_DEV=rokudev

# Or use rokupkg
rokupkg --install phlex.zip
```

## Testing

Unit tests are located in `tests/unit/`. Deploy to device for testing.

## API Endpoints

The app communicates with these Phlex API endpoints:

- `POST /api/v1/Auth/Login` - User authentication
- `DELETE /api/v1/Sessions/{id}` - Session management
- `GET /api/v1/Library/VirtualFolders` - List libraries
- `GET /api/v1/Items/{id}` - Get item details
- `GET /api/v1/Items/{id}/PlaybackInfo` - Get playback info
- `POST /api/v1/Playstate` - Playback control

## Remote Control

| Button | Action |
|--------|--------|
| Select/Play | Play/Pause |
| Back | Go back |
| Left/Right | Seek -30s/+30s |
| Rewind/Forward | Seek -10s/+10s |

## License

MIT License