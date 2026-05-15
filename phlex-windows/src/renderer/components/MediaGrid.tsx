import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MediaItem } from '../utils/api';

interface MediaGridProps {
  items: MediaItem[];
}

export const MediaGrid: React.FC<MediaGridProps> = ({ items }) => {
  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
        No items found
      </div>
    );
  }

  return (
    <div className="media-grid">
      {items.map((item) => (
        <Link to={`/item/${item.Id}`} key={item.Id} className="media-card">
          <div className="media-card-placeholder">🎬</div>
          <div className="media-card-info">
            <div className="media-card-title">{item.Name}</div>
            <div className="media-card-subtitle">{item.Type}</div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default MediaGrid;
