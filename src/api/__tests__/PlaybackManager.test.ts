// src/api/__tests__/PlaybackManager.test.ts
import { playbackManager } from '../PlaybackManager';
import apiClient, { setActiveSessionId } from '../client';
import { libraryManager } from '../LibraryManager';

jest.mock('../client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  setActiveSessionId: jest.fn(),
}));
jest.mock('../LibraryManager', () => ({
  libraryManager: { getMediaItem: jest.fn() },
}));

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;
const mockedSetSession = setActiveSessionId as jest.Mock;
const mockedLibrary = libraryManager as jest.Mocked<typeof libraryManager>;

describe('PlaybackManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createSession POSTs /sessions with snake_case body and records session id', async () => {
    mockedClient.post.mockResolvedValue({ session_id: 'sess-1' });

    const id = await playbackManager.createSession({
      deviceId: 'dev-1',
      deviceName: 'Phlix Mobile (ios)',
      deviceType: 'ios',
    });

    expect(mockedClient.post).toHaveBeenCalledWith('/sessions', {
      device_id: 'dev-1',
      device_name: 'Phlix Mobile (ios)',
      device_type: 'ios',
    });
    expect(id).toBe('sess-1');
    expect(mockedSetSession).toHaveBeenCalledWith('sess-1');
  });

  it('reportProgress POSTs /sessions/{id}/progress with tick fields', async () => {
    mockedClient.post.mockResolvedValue({ message: 'ok' });

    await playbackManager.reportProgress('sess-1', {
      mediaItemId: 'm1',
      positionTicks: 12340000,
      durationTicks: 99990000,
      isPaused: false,
    });

    expect(mockedClient.post).toHaveBeenCalledWith('/sessions/sess-1/progress', {
      media_item_id: 'm1',
      position_ticks: 12340000,
      duration_ticks: 99990000,
      is_paused: false,
    });
  });

  it('endSession DELETEs /sessions/{id} and clears the active session id', async () => {
    mockedClient.delete.mockResolvedValue({ message: 'ok' });

    await playbackManager.endSession('sess-1');

    expect(mockedClient.delete).toHaveBeenCalledWith('/sessions/sess-1');
    expect(mockedSetSession).toHaveBeenCalledWith(null);
  });

  it('getStreamUrl resolves the signed stream_url from media detail', async () => {
    mockedLibrary.getMediaItem.mockResolvedValue({
      id: 'm1',
      name: 'A',
      type: 'movie',
      stream_url: 'https://srv/media/m1/stream?sig=abc',
    });

    const url = await playbackManager.getStreamUrl('m1');

    expect(mockedLibrary.getMediaItem).toHaveBeenCalledWith('m1');
    expect(url).toBe('https://srv/media/m1/stream?sig=abc');
  });
});
