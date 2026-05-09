import React, { useContext, useMemo } from 'react';
import {
  AppstoreOutlined,
  CalendarOutlined,
  HomeOutlined,
  LoginOutlined,
  ShopOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './MobileAppDock.css';

const MobileAppDock = () => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const items = useMemo(() => {
    if (!isAuthenticated) {
      return [
        { key: '/', label: 'Home', icon: <HomeOutlined /> },
        { key: '/vendors', label: 'Vendors', icon: <ShopOutlined /> },
        { key: '/login', label: 'Login', icon: <LoginOutlined /> },
      ];
    }

    const dashboardPath = user?.role === 'vendor' ? '/vendor/workspace' : '/dashboard';

    return [
      { key: '/', label: 'Home', icon: <HomeOutlined /> },
      { key: dashboardPath, label: 'Dashboard', icon: <AppstoreOutlined /> },
      { key: '/vendors', label: 'Vendors', icon: <ShopOutlined /> },
      { key: '/bookings', label: 'Bookings', icon: <CalendarOutlined /> },
      { key: '/profile', label: 'Profile', icon: <UserOutlined /> },
    ];
  }, [isAuthenticated, user]);

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <nav className="mobile-app-dock" aria-label="Primary navigation">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`mobile-app-dock-item${isActive(item.key) ? ' active' : ''}`}
          onClick={() => navigate(item.key)}
        >
          <span className="mobile-app-dock-icon">{item.icon}</span>
          <span className="mobile-app-dock-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default MobileAppDock;
