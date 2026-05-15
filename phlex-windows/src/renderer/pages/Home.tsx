import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { Library } from '../utils/api';
import { MediaGrid } from '../components/MediaGrid';

export const Home: React.FC = () => {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLibraries = async () => {
      try {
        const libs = await api.getLibraries();
        setLibraries(libs);
      } catch (err) {
        console.error('Failed to fetch libraries:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLibraries();
  }, []);

  if (loading) {
    return (
      <div className="home-view">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="home-view">
      <section>
        <h1 className="section-title">My Library</h1>
        <div className="media-grid">
          {libraries.map((library) => (
            <Link to={`/library/${library.id}`} key={library.id} className="media-card">
              <div className="media-card-placeholder">📁</div>
              <div className="media-card-info">
                <div className="media-card-title">{library.name}</div>
                <div className="media-card-subtitle">{library.type}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
