import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VideoPlayer } from '../components/VideoPlayer';
import { usePlaybackStore } from '../stores/playbackStore';

export const Player: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playbackInfo, loadItem, stop } = usePlaybackStore();

  useEffect(() => {
    if (id) {
      loadItem(id);
    }
    return () => {
      stop();
    };
  }, [id]);

  const handleBack = () => {
    navigate(-1);
  };

  if (!playbackInfo) {
    return (
      <div className="video-player-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="video-player-container">
      <button className="player-back" onClick={handleBack}>
        ← Back
      </button>
      <VideoPlayer itemId={id!} playbackInfo={playbackInfo} />
    </div>
  );
};

export default Player;
