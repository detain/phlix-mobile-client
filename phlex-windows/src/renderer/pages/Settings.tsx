import React from 'react';
import { useAuthStore } from '../stores/authStore';

export const Settings: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <div className="settings-view">
      <h1 className="section-title">Settings</h1>

      <div className="settings-section">
        <h2 className="settings-section-title">Account</h2>
        <div className="setting-item">
          <div className="setting-label">
            <span>Username</span>
            <span className="setting-description">{user?.name || 'Unknown'}</span>
          </div>
        </div>
        <div className="setting-item">
          <button className="play-button" onClick={logout} style={{ background: '#ef4444' }}>
            Sign Out
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h2 className="settings-section-title">Playback</h2>
        <div className="setting-item">
          <div className="setting-label">
            <span>Hardware Acceleration</span>
            <span className="setting-description">Use GPU for video decoding</span>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" defaultChecked />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <div className="setting-item">
          <div className="setting-label">
            <span>Auto-play</span>
            <span className="setting-description">Start playing next item automatically</span>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h2 className="settings-section-title">Application</h2>
        <div className="setting-item">
          <div className="setting-label">
            <span>Minimize to Tray</span>
            <span className="setting-description">Keep running in system tray when closed</span>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" defaultChecked />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <div className="setting-item">
          <div className="setting-label">
            <span>Start with Windows</span>
            <span className="setting-description">Launch automatically on startup</span>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default Settings;
