import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { MediaItem } from '../utils/api';
import { MediaGrid } from '../components/MediaGrid';

export const Library: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      if (!id) return;
      try {
        const response = await api.getLibraryItems(id);
        setItems(response.Items);
      } catch (err) {
        console.error('Failed to fetch library items:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [id]);

  if (loading) {
    return (
      <div className="library-view">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="library-view">
      <h1 className="section-title">Library</h1>
      <MediaGrid items={items} />
    </div>
  );
};

export default Library;
