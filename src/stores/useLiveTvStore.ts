// src/stores/useLiveTvStore.ts
import { create } from 'zustand';
import { liveTvManager, isNotConfiguredError } from '../api/LiveTvManager';
import type {
  Channel,
  Program,
  Recording,
  SeriesRule,
  CreateRecordingInput,
  UpdateChannelInput,
  GuideQuery,
} from '../types/livetv';

/**
 * Live TV store (slice E8). Holds channels, the per-channel guide, recordings,
 * upcoming recordings and series rules, with section-scoped loading/error flags.
 *
 * Convention (matches useAdminStore):
 *   - LOADERS swallow errors into `error`/`notConfigured` (screens render an
 *     ErrorView or the friendly "not set up" EmptyState).
 *   - MUTATORS set `error` AND rethrow so the calling screen can surface an Alert.
 *
 * `notConfigured` is set when ANY loader hits a 404/500 from the admin Live TV
 * routes (`isNotConfiguredError`) — most servers have no tuner, so the screen
 * must show "Live TV is not set up on this server", NOT a raw error. A clean
 * load clears it.
 */
interface LiveTvState {
  // Channels
  channels: Channel[];
  channelsLoading: boolean;
  channelsError: string | null;

  // Guide (per the most-recently-loaded channel)
  guide: Program[];
  guideChannelId: string | null;
  guideLoading: boolean;
  guideError: string | null;

  // Recordings
  recordings: Recording[];
  upcoming: Recording[];
  recordingsLoading: boolean;
  recordingsError: string | null;

  // Series rules (list-only)
  seriesRules: SeriesRule[];
  seriesRulesLoading: boolean;
  seriesRulesError: string | null;

  // "Live TV is not configured on this server" (404/500 from any loader).
  notConfigured: boolean;

  // Loaders (swallow → error/notConfigured)
  loadChannels: () => Promise<void>;
  loadGuide: (query?: GuideQuery) => Promise<void>;
  loadRecordings: (status?: string) => Promise<void>;
  loadUpcoming: () => Promise<void>;
  loadSeriesRules: () => Promise<void>;

  // Mutators (rethrow)
  updateChannel: (id: string, input: UpdateChannelInput) => Promise<Channel>;
  refreshGuide: () => Promise<void>;
  createRecording: (input: CreateRecordingInput) => Promise<Recording>;
  deleteRecording: (id: string) => Promise<void>;
  getChannelStreamUrl: (id: string) => Promise<string>;

  reset: () => void;
}

const errMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const initialState = {
  channels: [] as Channel[],
  channelsLoading: false,
  channelsError: null as string | null,
  guide: [] as Program[],
  guideChannelId: null as string | null,
  guideLoading: false,
  guideError: null as string | null,
  recordings: [] as Recording[],
  upcoming: [] as Recording[],
  recordingsLoading: false,
  recordingsError: null as string | null,
  seriesRules: [] as SeriesRule[],
  seriesRulesLoading: false,
  seriesRulesError: null as string | null,
  notConfigured: false,
};

export const useLiveTvStore = create<LiveTvState>((set, get) => ({
  ...initialState,

  // ── Loaders ──
  loadChannels: async () => {
    set({ channelsLoading: true, channelsError: null });
    try {
      const channels = await liveTvManager.getChannels();
      set({ channels, channelsLoading: false, notConfigured: false });
    } catch (error) {
      if (isNotConfiguredError(error)) {
        set({ notConfigured: true, channelsLoading: false, channels: [] });
        return;
      }
      set({
        channelsError: errMessage(error, 'Failed to load channels'),
        channelsLoading: false,
      });
    }
  },

  loadGuide: async (query: GuideQuery = {}) => {
    set({ guideLoading: true, guideError: null });
    try {
      const guide = await liveTvManager.getGuide(query);
      set({
        guide,
        guideChannelId: query.channelId ?? null,
        guideLoading: false,
      });
    } catch (error) {
      if (isNotConfiguredError(error)) {
        set({ notConfigured: true, guideLoading: false, guide: [] });
        return;
      }
      set({
        guideError: errMessage(error, 'Failed to load guide'),
        guideLoading: false,
      });
    }
  },

  loadRecordings: async (status?: string) => {
    set({ recordingsLoading: true, recordingsError: null });
    try {
      const recordings = await liveTvManager.getRecordings(status);
      set({ recordings, recordingsLoading: false });
    } catch (error) {
      if (isNotConfiguredError(error)) {
        set({ notConfigured: true, recordingsLoading: false, recordings: [] });
        return;
      }
      set({
        recordingsError: errMessage(error, 'Failed to load recordings'),
        recordingsLoading: false,
      });
    }
  },

  loadUpcoming: async () => {
    set({ recordingsLoading: true, recordingsError: null });
    try {
      const upcoming = await liveTvManager.getUpcomingRecordings();
      set({ upcoming, recordingsLoading: false });
    } catch (error) {
      if (isNotConfiguredError(error)) {
        set({ notConfigured: true, recordingsLoading: false, upcoming: [] });
        return;
      }
      set({
        recordingsError: errMessage(error, 'Failed to load upcoming recordings'),
        recordingsLoading: false,
      });
    }
  },

  loadSeriesRules: async () => {
    set({ seriesRulesLoading: true, seriesRulesError: null });
    try {
      const seriesRules = await liveTvManager.getSeriesRules();
      set({ seriesRules, seriesRulesLoading: false });
    } catch (error) {
      if (isNotConfiguredError(error)) {
        set({ notConfigured: true, seriesRulesLoading: false, seriesRules: [] });
        return;
      }
      set({
        seriesRulesError: errMessage(error, 'Failed to load series rules'),
        seriesRulesLoading: false,
      });
    }
  },

  // ── Mutators (rethrow) ──
  updateChannel: async (id: string, input: UpdateChannelInput) => {
    set({ channelsError: null });
    try {
      const channel = await liveTvManager.updateChannel(id, input);
      set((state) => ({
        channels: state.channels.map((c) => (c.id === id ? channel : c)),
      }));
      return channel;
    } catch (error) {
      set({ channelsError: errMessage(error, 'Failed to update channel') });
      throw error;
    }
  },

  refreshGuide: async () => {
    set({ guideError: null });
    try {
      await liveTvManager.refreshGuide();
      // Re-pull the guide for the currently shown channel, if any.
      const channelId = get().guideChannelId;
      await get().loadGuide(channelId ? { channelId } : {});
    } catch (error) {
      set({ guideError: errMessage(error, 'Failed to refresh guide') });
      throw error;
    }
  },

  createRecording: async (input: CreateRecordingInput) => {
    set({ recordingsError: null });
    try {
      const recording = await liveTvManager.createRecording(input);
      // Refresh upcoming so the new entry appears.
      await get().loadUpcoming();
      return recording;
    } catch (error) {
      set({ recordingsError: errMessage(error, 'Failed to create recording') });
      throw error;
    }
  },

  deleteRecording: async (id: string) => {
    set({ recordingsError: null });
    try {
      await liveTvManager.deleteRecording(id);
      set((state) => ({
        recordings: state.recordings.filter((r) => r.id !== id),
        upcoming: state.upcoming.filter((r) => r.id !== id),
      }));
    } catch (error) {
      set({ recordingsError: errMessage(error, 'Failed to delete recording') });
      throw error;
    }
  },

  getChannelStreamUrl: async (id: string) => {
    return liveTvManager.getChannelStreamUrl(id);
  },

  reset: () => set({ ...initialState }),
}));
