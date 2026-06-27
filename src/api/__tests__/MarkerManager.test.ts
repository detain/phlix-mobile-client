// src/api/__tests__/MarkerManager.test.ts
import { markerManager, isWithinMarker } from '../MarkerManager';
import apiClient from '../client';

jest.mock('../client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  setActiveSessionId: jest.fn(),
}));

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

describe('MarkerManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getPlaybackInfo GETs /media/{id}/playback-info and returns the server shape', async () => {
    mockedClient.get.mockResolvedValue({
      item_id: 'm1',
      intro_marker: { start_seconds: 30, end_seconds: 90 },
      outro_marker: null,
      chapters: [{ start_seconds: 0, end_seconds: 600, title: 'Chapter 1' }],
      skip_button_spec: { label: 'Skip' },
    });

    const info = await markerManager.getPlaybackInfo('m1');

    expect(mockedClient.get).toHaveBeenCalledWith('/media/m1/playback-info');
    expect(info.item_id).toBe('m1');
    expect(info.intro_marker).toEqual({ start_seconds: 30, end_seconds: 90 });
    expect(info.outro_marker).toBeNull();
    expect(info.chapters[0].title).toBe('Chapter 1');
  });

  it('getMarkers GETs /media/{id}/markers and unwraps the markers array', async () => {
    mockedClient.get.mockResolvedValue({
      markers: [
        { type: 'intro', start_seconds: 10, end_seconds: 40 },
        { type: 'outro', start_seconds: 1200, end_seconds: 1260 },
      ],
    });

    const markers = await markerManager.getMarkers('m1');

    expect(mockedClient.get).toHaveBeenCalledWith('/media/m1/markers');
    expect(markers).toHaveLength(2);
    expect(markers[0].type).toBe('intro');
  });

  it('getMarkers returns [] when the server omits the markers key', async () => {
    mockedClient.get.mockResolvedValue({});
    await expect(markerManager.getMarkers('m1')).resolves.toEqual([]);
  });
});

describe('isWithinMarker', () => {
  const marker = { start_seconds: 30, end_seconds: 90 };

  it('returns false for a null marker', () => {
    expect(isWithinMarker(50, null)).toBe(false);
  });

  it('returns true at the bounds (inclusive)', () => {
    expect(isWithinMarker(30, marker)).toBe(true);
    expect(isWithinMarker(90, marker)).toBe(true);
  });

  it('returns true inside and false outside the window', () => {
    expect(isWithinMarker(60, marker)).toBe(true);
    expect(isWithinMarker(29, marker)).toBe(false);
    expect(isWithinMarker(91, marker)).toBe(false);
  });
});
