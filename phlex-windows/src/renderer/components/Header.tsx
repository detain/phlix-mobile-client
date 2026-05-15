import React from 'react';
import { useLocation } from 'react-router-dom';

export const Header: React.FC = () => {
  const location = useLocation();

  const getTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Home';
    if (path.startsWith('/library/')) return 'Library';
    if (path.startsWith('/item/')) return 'Item Details';
    if (path.startsWith('/player/')) return 'Now Playing';
    if (path === '/settings') return 'Settings';
    return 'Phlex';
  };

  return (
    <header className="header">
      <h1 className="header-title">{getTitle()}</h1>
      <div className="header-actions">
        <button className="header-button" title="Search">
          🔍
        </button>
        <button className="header-button" title="Notifications">
          🔔
        </button>
      </div>
    </header>
  );
};

export default Header;
