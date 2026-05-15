import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Home } from './pages/Home';
import { Library } from './pages/Library';
import { ItemDetail } from './pages/ItemDetail';
import { Player } from './pages/Player';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import './styles/global.css';

export const App: React.FC = () => {
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      setIsLoading(false);
    };
    init();
  }, []);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <HashRouter>
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <Header />
          <div className="page-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/library/:id" element={<Library />} />
              <Route path="/item/:id" element={<ItemDetail />} />
              <Route path="/player/:id" element={<Player />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </div>
      </div>
    </HashRouter>
  );
};

export default App;
