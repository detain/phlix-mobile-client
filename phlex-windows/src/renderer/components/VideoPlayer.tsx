import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PlaybackInfoResponse } from '../utils/api';
import './VideoPlayer.css';

interface VideoPlayerProps {
  itemId: string;
  playbackInfo: PlaybackInfoResponse;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ itemId, playbackInfo }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const hideControlsTimeout = useRef<NodeJS.Timeout>();

  // Initialize playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackInfo?.playback_info?.url) return;

    video.src = playbackInfo.playback_info.url;
    video.volume = volume;

    const startPlayback = async () => {
      try {
        await video.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Playback failed:', error);
      }
    };

    startPlayback();

    return () => {
      video.pause();
      video.src = '';
    };
  }, [itemId, playbackInfo]);

  // Auto-hide controls
  useEffect(() => {
    if (isPlaying && showControls) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }

    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, [isPlaying, showControls]);

  // Event handlers
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
  }, []);

  const handleProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.buffered.length) return;
    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
    setBuffered((bufferedEnd / video.duration) * 100);
  }, []);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleEnded = useCallback(() => setIsPlaying(false), []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = newVolume;
    setVolume(newVolume);
  }, []);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
  }, []);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, []);

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case ' ':
        case 'k':
          isPlaying ? video.pause() : video.play();
          break;
        case 'ArrowLeft':
          handleSeek(Math.max(0, video.currentTime - 10));
          break;
        case 'ArrowRight':
          handleSeek(Math.min(duration, video.currentTime + 10));
          break;
        case 'ArrowUp':
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          handleVolumeChange(volume > 0 ? 0 : 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, volume, duration]);

  return (
    <div
      ref={containerRef}
      className="video-player"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="video-element"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onProgress={handleProgress}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onClick={() => isPlaying ? videoRef.current?.pause() : videoRef.current?.play()}
      />

      <div className={`controls-overlay ${showControls ? 'visible' : ''}`}>
        <div className="controls-top">
          <span className="video-title">{playbackInfo.item?.Name}</span>
        </div>

        <div className="controls-center">
          <button
            className="control-btn skip-btn"
            onClick={() => handleSeek(Math.max(0, currentTime - 10))}
          >
            ⏪ 10s
          </button>

          <button
            className="control-btn play-btn"
            onClick={() => isPlaying ? videoRef.current?.pause() : videoRef.current?.play()}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          <button
            className="control-btn skip-btn"
            onClick={() => handleSeek(Math.min(duration, currentTime + 10))}
          >
            10s ⏩
          </button>
        </div>

        <div className="controls-bottom">
          <div className="progress-container">
            <div
              className="progress-bar"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                handleSeek(percent * duration);
              }}
            >
              <div className="progress-buffered" style={{ width: `${buffered}%` }} />
              <div className="progress-current" style={{ width: `${(currentTime / duration) * 100}%` }} />
            </div>
          </div>

          <div className="controls-row">
            <span className="time-display">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="controls-right">
              <select
                className="playback-rate-select"
                value={playbackRate}
                onChange={(e) => handlePlaybackRateChange(Number(e.target.value))}
              >
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
              </select>

              <button
                className="control-btn volume-btn"
                onClick={() => handleVolumeChange(volume > 0 ? 0 : 1)}
              >
                {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
              </button>

              <input
                type="range"
                className="volume-slider"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
              />

              <button className="control-btn fullscreen-btn" onClick={toggleFullscreen}>
                {isFullscreen ? '⛶' : '⛶'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
