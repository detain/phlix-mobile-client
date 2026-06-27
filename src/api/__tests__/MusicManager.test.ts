// src/api/__tests__/MusicManager.test.ts
import { musicManager } from '../MusicManager';
import apiClient from '../client';
import type { Artist, Album, Track, NowPlaying } from '../../types/music';

jest.mock('../client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const sampleArtist: Artist = {
  name: 'Pink Floyd',
  album_count: 2,
  track_count: 20,
  albums: ['The Wall', 'Animals'],
};

const sampleTrack: Track = {
  id: 't1',
  name: 'Money',
  artist: 'Pink Floyd',
  album: 'The Dark Side of the Moon',
  album_artist: 'Pink Floyd',
  year: 1973,
  genre: 'Rock',
  track_number: 6,
  disc_number: 1,
  duration_secs: 382,
  composer: 'Roger Waters',
  path: '/music/money.flac',
};

const sampleAlbum: Album = {
  name: 'The Dark Side of the Moon',
  artist: 'Pink Floyd',
  year: 1973,
  track_count: 10,
  tracks: [{ id: 't1', name: 'Money', metadata: { track_number: 6 } }],
};

const sampleNowPlaying: NowPlaying = {
  track: sampleTrack,
  position: 1000,
  state: 'playing',
  session_id: 's1',
};

describe('MusicManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getArtists GETs /music/artists and unwraps .artists', async () => {
    mockedClient.get.mockResolvedValue({ artists: [sampleArtist] });
    const result = await musicManager.getArtists();
    expect(mockedClient.get).toHaveBeenCalledWith('/music/artists');
    expect(result).toEqual([sampleArtist]);
  });

  it('getArtist GETs /music/artists/{name} (encoded) and unwraps .artist', async () => {
    mockedClient.get.mockResolvedValue({ artist: sampleArtist });
    const result = await musicManager.getArtist('AC/DC');
    expect(mockedClient.get).toHaveBeenCalledWith('/music/artists/AC%2FDC');
    expect(result).toEqual(sampleArtist);
  });

  it('getAlbums GETs /music/albums and unwraps .albums', async () => {
    mockedClient.get.mockResolvedValue({ albums: [sampleAlbum] });
    const result = await musicManager.getAlbums();
    expect(mockedClient.get).toHaveBeenCalledWith('/music/albums');
    expect(result).toEqual([sampleAlbum]);
  });

  it('getAlbum GETs /music/albums/{name} (encoded) and unwraps .album', async () => {
    mockedClient.get.mockResolvedValue({ album: sampleAlbum });
    const result = await musicManager.getAlbum('The Dark Side of the Moon');
    expect(mockedClient.get).toHaveBeenCalledWith(
      '/music/albums/The%20Dark%20Side%20of%20the%20Moon'
    );
    expect(result).toEqual(sampleAlbum);
  });

  it('getTracks GETs /music/tracks with limit/offset and returns the whole envelope', async () => {
    const envelope = { tracks: [sampleTrack], total: 1, limit: 50, offset: 0 };
    mockedClient.get.mockResolvedValue(envelope);
    const result = await musicManager.getTracks({ limit: 50, offset: 0 });
    expect(mockedClient.get).toHaveBeenCalledWith('/music/tracks', {
      limit: 50,
      offset: 0,
    });
    expect(result).toEqual(envelope);
  });

  it('getTracks with no opts sends an empty params object', async () => {
    mockedClient.get.mockResolvedValue({
      tracks: [],
      total: 0,
      limit: 100,
      offset: 0,
    });
    await musicManager.getTracks();
    expect(mockedClient.get).toHaveBeenCalledWith('/music/tracks', {});
  });

  it('getTrack GETs /music/tracks/{id} and unwraps .track', async () => {
    mockedClient.get.mockResolvedValue({ track: sampleTrack });
    const result = await musicManager.getTrack('t1');
    expect(mockedClient.get).toHaveBeenCalledWith('/music/tracks/t1');
    expect(result).toEqual(sampleTrack);
  });

  it('getNowPlaying GETs /music/now-playing and unwraps .now_playing', async () => {
    mockedClient.get.mockResolvedValue({ now_playing: sampleNowPlaying });
    const result = await musicManager.getNowPlaying();
    expect(mockedClient.get).toHaveBeenCalledWith('/music/now-playing');
    expect(result).toEqual(sampleNowPlaying);
  });

  it('getNowPlaying returns null when now_playing is null', async () => {
    mockedClient.get.mockResolvedValue({ now_playing: null });
    const result = await musicManager.getNowPlaying();
    expect(result).toBeNull();
  });
});
