/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/useLiveTvStore.test.ts
import { useLiveTvStore } from '../useLiveTvStore';
import { liveTvManager, isNotConfiguredError } from '../../api/LiveTvManager';
import type { Channel, Program, Recording, SeriesRule } from '../../types/livetv';

jest.mock('../../api/LiveTvManager', () => ({
  liveTvManager: {
    getChannels: jest.fn(),
    getChannel: jest.fn(),
    updateChannel: jest.fn(),
    getChannelStreamUrl: jest.fn(),
    getGuide: jest.fn(),
    getProgram: jest.fn(),
    refreshGuide: jest.fn(),
    getRecordings: jest.fn(),
    getUpcomingRecordings: jest.fn(),
    getRecording: jest.fn(),
    createRecording: jest.fn(),
    deleteRecording: jest.fn(),
    getSeriesRules: jest.fn(),
  },
  isNotConfiguredError: jest.fn(),
}));

const mocked = liveTvManager as jest.Mocked<typeof liveTvManager>;
const mockedNotConfigured = isNotConfiguredError as jest.MockedFunction<
  typeof isNotConfiguredError
>;

const channel: Channel = {
  id: 'c1',
  name: 'BBC One',
  number: 101,
  type: 'tv',
  visibility: 'visible',
};
const program: Program = {
  id: 'p1',
  channel_id: 'c1',
  title: 'News',
  start_time: 1000,
  end_time: 2000,
};
const recording: Recording = {
  id: 'r1',
  channel_id: 'c1',
  title: 'News',
  start_time: 1000,
  end_time: 2000,
  status: 'pending',
};
const rule: SeriesRule = { id: 'sr1', title: 'Doctor Who' };

const resetStore = () => {
  useLiveTvStore.getState().reset();
};

describe('useLiveTvStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedNotConfigured.mockReturnValue(false);
    resetStore();
  });

  // ── Loaders ──
  it('loadChannels populates channels and clears notConfigured', async () => {
    mocked.getChannels.mockResolvedValue([channel]);
    await useLiveTvStore.getState().loadChannels();
    const s = useLiveTvStore.getState();
    expect(s.channels).toEqual([channel]);
    expect(s.channelsLoading).toBe(false);
    expect(s.notConfigured).toBe(false);
  });

  it('loadChannels sets notConfigured on a 404/500 (isNotConfiguredError true)', async () => {
    mocked.getChannels.mockRejectedValue(new Error('500'));
    mockedNotConfigured.mockReturnValue(true);
    await useLiveTvStore.getState().loadChannels();
    const s = useLiveTvStore.getState();
    expect(s.notConfigured).toBe(true);
    expect(s.channels).toEqual([]);
    expect(s.channelsError).toBeNull();
  });

  it('loadChannels sets channelsError on a real failure (not notConfigured)', async () => {
    mocked.getChannels.mockRejectedValue(new Error('boom'));
    mockedNotConfigured.mockReturnValue(false);
    await useLiveTvStore.getState().loadChannels();
    const s = useLiveTvStore.getState();
    expect(s.channelsError).toBe('boom');
    expect(s.notConfigured).toBe(false);
  });

  it('loadGuide stores programs and the channel id', async () => {
    mocked.getGuide.mockResolvedValue([program]);
    await useLiveTvStore.getState().loadGuide({ channelId: 'c1' });
    const s = useLiveTvStore.getState();
    expect(s.guide).toEqual([program]);
    expect(s.guideChannelId).toBe('c1');
  });

  it('loadGuide sets notConfigured on a 404/500', async () => {
    mocked.getGuide.mockRejectedValue(new Error('404'));
    mockedNotConfigured.mockReturnValue(true);
    await useLiveTvStore.getState().loadGuide();
    expect(useLiveTvStore.getState().notConfigured).toBe(true);
  });

  it('loadRecordings stores recordings', async () => {
    mocked.getRecordings.mockResolvedValue([recording]);
    await useLiveTvStore.getState().loadRecordings('pending');
    expect(mocked.getRecordings).toHaveBeenCalledWith('pending');
    expect(useLiveTvStore.getState().recordings).toEqual([recording]);
  });

  it('loadUpcoming stores upcoming', async () => {
    mocked.getUpcomingRecordings.mockResolvedValue([recording]);
    await useLiveTvStore.getState().loadUpcoming();
    expect(useLiveTvStore.getState().upcoming).toEqual([recording]);
  });

  it('loadSeriesRules stores rules', async () => {
    mocked.getSeriesRules.mockResolvedValue([rule]);
    await useLiveTvStore.getState().loadSeriesRules();
    expect(useLiveTvStore.getState().seriesRules).toEqual([rule]);
  });

  // ── Mutators (rethrow) ──
  it('updateChannel replaces the channel in state', async () => {
    useLiveTvStore.setState({ channels: [channel] });
    const updated = { ...channel, name: 'BBC Two' };
    mocked.updateChannel.mockResolvedValue(updated);
    const result = await useLiveTvStore.getState().updateChannel('c1', { name: 'BBC Two' });
    expect(result).toEqual(updated);
    expect(useLiveTvStore.getState().channels[0].name).toBe('BBC Two');
  });

  it('updateChannel rethrows and sets channelsError on failure', async () => {
    mocked.updateChannel.mockRejectedValue(new Error('nope'));
    await expect(
      useLiveTvStore.getState().updateChannel('c1', { name: 'x' })
    ).rejects.toThrow('nope');
    expect(useLiveTvStore.getState().channelsError).toBe('nope');
  });

  it('refreshGuide calls the manager then reloads the current guide', async () => {
    useLiveTvStore.setState({ guideChannelId: 'c1' });
    mocked.refreshGuide.mockResolvedValue(undefined);
    mocked.getGuide.mockResolvedValue([program]);
    await useLiveTvStore.getState().refreshGuide();
    expect(mocked.refreshGuide).toHaveBeenCalled();
    expect(mocked.getGuide).toHaveBeenCalledWith({ channelId: 'c1' });
  });

  it('refreshGuide rethrows on failure', async () => {
    mocked.refreshGuide.mockRejectedValue(new Error('refresh fail'));
    await expect(useLiveTvStore.getState().refreshGuide()).rejects.toThrow('refresh fail');
    expect(useLiveTvStore.getState().guideError).toBe('refresh fail');
  });

  it('createRecording calls the manager and reloads upcoming', async () => {
    mocked.createRecording.mockResolvedValue(recording);
    mocked.getUpcomingRecordings.mockResolvedValue([recording]);
    const result = await useLiveTvStore.getState().createRecording({
      channel_id: 'c1',
      title: 'News',
      start_time: 1000,
      end_time: 2000,
    });
    expect(result).toEqual(recording);
    expect(mocked.getUpcomingRecordings).toHaveBeenCalled();
    expect(useLiveTvStore.getState().upcoming).toEqual([recording]);
  });

  it('createRecording rethrows on failure', async () => {
    mocked.createRecording.mockRejectedValue(new Error('cannot'));
    await expect(
      useLiveTvStore.getState().createRecording({
        channel_id: 'c1',
        title: 'x',
        start_time: 1,
        end_time: 2,
      })
    ).rejects.toThrow('cannot');
    expect(useLiveTvStore.getState().recordingsError).toBe('cannot');
  });

  it('deleteRecording removes it from recordings and upcoming', async () => {
    useLiveTvStore.setState({ recordings: [recording], upcoming: [recording] });
    mocked.deleteRecording.mockResolvedValue(undefined);
    await useLiveTvStore.getState().deleteRecording('r1');
    const s = useLiveTvStore.getState();
    expect(s.recordings).toEqual([]);
    expect(s.upcoming).toEqual([]);
  });

  it('deleteRecording rethrows on failure', async () => {
    mocked.deleteRecording.mockRejectedValue(new Error('locked'));
    await expect(useLiveTvStore.getState().deleteRecording('r1')).rejects.toThrow('locked');
    expect(useLiveTvStore.getState().recordingsError).toBe('locked');
  });

  it('getChannelStreamUrl delegates to the manager', async () => {
    mocked.getChannelStreamUrl.mockResolvedValue('https://tuner/hls.m3u8');
    const url = await useLiveTvStore.getState().getChannelStreamUrl('c1');
    expect(mocked.getChannelStreamUrl).toHaveBeenCalledWith('c1');
    expect(url).toBe('https://tuner/hls.m3u8');
  });
});
