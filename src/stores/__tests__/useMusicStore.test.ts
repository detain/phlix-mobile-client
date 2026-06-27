// src/stores/__tests__/useMusicStore.test.ts
import { useMusicStore } from '../useMusicStore';
import { musicManager } from '../../api/MusicManager';
import type { Artist, Album, Track, NowPlaying } from '../../types/music';

jest.mock('../../api/MusicManager', () => ({
  musicManager: {
    getArtists: jest.fn(),
    getArtist: jest.fn(),
    getAlbums: jest.fn(),
    getAlbum: jest.fn(),
    getTracks: jest.fn(),
    getTrack: jest.fn(),
    getNowPlaying: jest.fn(),
  },
}));

const mocked = musicManager as jest.Mocked<typeof musicManager>;

const artist: Artist = {
  name: 'Pink Floyd',
  album_count: 2,
  track_count: 20,
  albums: ['The Wall'],
};
const album: Album = {
  name: 'The Wall',
  artist: 'Pink Floyd',
  year: 1979,
  track_count: 26,
  tracks: [],
};
const track: Track = {
  id: 't1',
  name: 'Money',
  artist: 'Pink Floyd',
  album: 'DSOTM',
  album_artist: 'Pink Floyd',
  year: 1973,
  genre: 'Rock',
  track_number: 6,
  disc_number: 1,
  duration_secs: 382,
  composer: null,
  path: '/x.flac',
};
const nowPlaying: NowPlaying = {
  track,
  position: 100,
  state: 'playing',
  session_id: 's1',
};

describe('useMusicStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMusicStore.getState().reset();
  });

  it('loadArtists populates artists', async () => {
    mocked.getArtists.mockResolvedValue([artist]);
    await useMusicStore.getState().loadArtists();
    const s = useMusicStore.getState();
    expect(s.artists).toEqual([artist]);
    expect(s.artistsLoading).toBe(false);
    expect(s.artistsError).toBeNull();
  });

  it('loadArtists sets artistsError on failure', async () => {
    mocked.getArtists.mockRejectedValue(new Error('boom'));
    await useMusicStore.getState().loadArtists();
    const s = useMusicStore.getState();
    expect(s.artistsError).toBe('boom');
    expect(s.artistsLoading).toBe(false);
  });

  it('loadAlbums populates albums', async () => {
    mocked.getAlbums.mockResolvedValue([album]);
    await useMusicStore.getState().loadAlbums();
    expect(useMusicStore.getState().albums).toEqual([album]);
  });

  it('loadAlbums sets albumsError on failure', async () => {
    mocked.getAlbums.mockRejectedValue(new Error('nope'));
    await useMusicStore.getState().loadAlbums();
    expect(useMusicStore.getState().albumsError).toBe('nope');
  });

  it('loadTracks populates tracks from the envelope', async () => {
    mocked.getTracks.mockResolvedValue({
      tracks: [track],
      total: 1,
      limit: 100,
      offset: 0,
    });
    await useMusicStore.getState().loadTracks();
    expect(useMusicStore.getState().tracks).toEqual([track]);
  });

  it('loadTracks sets tracksError on failure', async () => {
    mocked.getTracks.mockRejectedValue(new Error('fail'));
    await useMusicStore.getState().loadTracks();
    expect(useMusicStore.getState().tracksError).toBe('fail');
  });

  it('loadNowPlaying stores the session (and tolerates null)', async () => {
    mocked.getNowPlaying.mockResolvedValue(nowPlaying);
    await useMusicStore.getState().loadNowPlaying();
    expect(useMusicStore.getState().nowPlaying).toEqual(nowPlaying);

    mocked.getNowPlaying.mockResolvedValue(null);
    await useMusicStore.getState().loadNowPlaying();
    expect(useMusicStore.getState().nowPlaying).toBeNull();
  });

  it('loadNowPlaying sets nowPlayingError on failure', async () => {
    mocked.getNowPlaying.mockRejectedValue(new Error('np'));
    await useMusicStore.getState().loadNowPlaying();
    expect(useMusicStore.getState().nowPlayingError).toBe('np');
  });
});
