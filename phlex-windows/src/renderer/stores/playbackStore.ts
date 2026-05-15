import { create } from 'zustand';
import api, { MediaItem, PlaybackInfoResponse } from '../utils/api';

interface PlaybackState {
  currentItem: MediaItem | null;
  playbackInfo: PlaybackInfoResponse | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  loadItem: (itemId: string) => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  setFullscreen: (isFullscreen: boolean) => void;
  updateTime: (time: number) => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  currentItem: null,
  playbackInfo: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  playbackRate: 1,
  isFullscreen: false,

  loadItem: async (itemId: string) => {
    try {
      const [item, playbackInfo] = await Promise.all([
        api.getItem(itemId),
        api.getItemPlaybackInfo(itemId)
      ]);
      set({
        currentItem: item,
        playbackInfo,
        currentTime: 0,
        duration: 0,
        isPlaying: false
      });
    } catch (error) {
      console.error('Failed to load item:', error);
    }
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  stop: () => set({ isPlaying: false, currentItem: null, playbackInfo: null }),

  seek: (time: number) => {
    set({ currentTime: time });
    const positionTicks = Math.floor(time * 10000000);
    api.seekPlayback(positionTicks);
  },

  setVolume: (volume: number) => set({ volume, isMuted: volume === 0 }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setPlaybackRate: (rate: number) => set({ playbackRate: rate }),
  setFullscreen: (isFullscreen: boolean) => set({ isFullscreen }),
  updateTime: (time: number) => set({ currentTime: time })
}));
