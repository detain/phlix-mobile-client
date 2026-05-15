import React from 'react';
import { NavLink } from 'react-router-dom';
import { useUiStore } from '../stores/uiStore';

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed } = useUiStore();

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <span className="sidebar-logo">📺</span>
        {!sidebarCollapsed && <span className="sidebar-logo-text">Phlex</span>}
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
          <span className="nav-icon">🏠</span>
          {!sidebarCollapsed && <span>Home</span>}
        </NavLink>
        <NavLink to="/library/movies" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">🎬</span>
          {!sidebarCollapsed && <span>Movies</span>}
        </NavLink>
        <NavLink to="/library/shows" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">📺</span>
          {!sidebarCollapsed && <span>TV Shows</span>}
        </NavLink>
        <NavLink to="/library/music" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">🎵</span>
          {!sidebarCollapsed && <span>Music</span>}
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">⚙️</span>
          {!sidebarCollapsed && <span>Settings</span>}
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;
