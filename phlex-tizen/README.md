# Phlex Tizen TV App

Samsung Smart TV client application for Phlex Media Server.

## Features

- **Library Browsing**: Browse movies, TV shows, and other media
- **Video Playback**: Support for direct play and HLS streaming
- **Remote Control**: Full Samsung remote control support
- **User Authentication**: Login with Phlex account
- **Progress Tracking**: Resume playback from last position

## Requirements

- Samsung TV with Tizen OS (2016+)
- Phlex Media Server v4.8+
- Node.js 18+ (for development)
- Tizen Studio 4.0+ (for deployment)

## Development

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run serve

# Build for production
npm run build
```

### Project Structure

```
phlex-tizen/
├── app/
│   ├── index.html           # Main entry point
│   ├── config.xml           # Tizen configuration
│   ├── js/
│   │   ├── main.js         # Application entry
│   │   ├── api/            # API client modules
│   │   ├── player/         # Video player components
│   │   ├── remote/         # Remote control handling
│   │   ├── ui/             # User interface views
│   │   └── utils/          # Utility functions
│   └── css/                # Stylesheets
├── scripts/                # Build scripts
└── tests/                  # Unit and integration tests
```

## Remote Control

| Button | Action |
|--------|--------|
| Arrow keys | Navigate |
| OK | Select |
| Back | Go back |
| Play/Pause | Toggle playback |
| Stop | Stop playback |
| Fast Forward/Rewind | Seek |
| Color buttons | Subtitle/audio/quality |
| Info | Show/hide info panel |

## Building for Production

```bash
# Build production bundle
npm run build

# Package for Tizen
node scripts/package.js
```

## Tizen Studio Deployment

1. Open Tizen Studio
2. Import the `phlex-tizen` project
3. Connect your Samsung TV
4. Run or debug on device

## Supported Codecs

- **Video**: H.264, H.265/HEVC, VP9
- **Audio**: AAC, AC3, EAC3, DTS, FLAC, MP3
- **Containers**: MP4, MKV, WebM, TS
- **Streaming**: HLS, MPEG-DASH, Progressive HTTP

## License

MIT License
