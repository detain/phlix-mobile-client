import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { MediaItem } from '../utils/api';

export const ItemDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItem = async () => {
      if (!id) return;
      try {
        const result = await api.getItem(id);
        setItem(result);
      } catch (err) {
        console.error('Failed to fetch item:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [id]);

  const handlePlay = () => {
    if (item) {
      navigate(`/player/${item.Id}`);
    }
  };

  if (loading) {
    return (
      <div className="item-detail-view">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!item) {
    return <div>Item not found</div>;
  }

  return (
    <div className="item-detail">
      <div className="item-detail-poster">
        <div className="media-card-placeholder" style={{ width: '100%', aspectRatio: '2/3' }}>🎬</div>
      </div>
      <div className="item-detail-info">
        <h1 className="item-detail-title">{item.Name}</h1>
        <div className="item-detail-meta">
          <span>{item.Type}</span>
        </div>
        {item.Overview && (
          <p className="item-detail-overview">{item.Overview}</p>
        )}
        <div className="item-detail-actions">
          <button className="play-button" onClick={handlePlay}>
            ▶ Play
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemDetail;
