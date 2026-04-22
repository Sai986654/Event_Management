import React, { useContext, useEffect, useState, useCallback } from 'react';
import { Layout, Button, Dropdown, Avatar, Tag, Badge } from 'antd';
import { UserOutlined, LogoutOutlined, BellOutlined, SettingOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { appNotificationService } from '../services/appNotificationService';
import './Header.css';

const Header = () => {
  const { user, logout } = useContext(AuthContext);
  const socketCtx = useContext(SocketContext);
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!user) return;
    try {
      const data = await appNotificationService.list({ limit: 1 });
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      setUnreadCount(0);
    }
  }, [user]);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  useEffect(() => {
    if (!socketCtx?.onNotificationNew) return undefined;
    const unsub = socketCtx.onNotificationNew(() => refreshUnread());
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [socketCtx, refreshUnread]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'role',
      label: <Tag color="blue">{user?.role}</Tag>,
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'profile',
      icon: <SettingOutlined />,
      label: 'My Profile',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
    },
  ];

  const getNavLinks = () => {
    if (!user) return null;
    const role = user.role;

    if (role === 'admin') {
      return (
        <>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/notifications">Alerts</Link>
          <Link to="/vendors">Vendors</Link>
          <Link to="/bookings">Bookings</Link>
          <Link to="/surprises">Surprises ✨</Link>
        </>
      );
    }

    if (role === 'organizer' || role === 'customer') {
      return (
        <>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/notifications">Alerts</Link>
          <Link to="/vendors">Vendors</Link>
          <Link to="/bookings">My Bookings</Link>
          <Link to="/surprises">Surprises ✨</Link>
        </>
      );
    }

    if (role === 'vendor') {
      return (
        <>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/notifications">Alerts</Link>
          <Link to="/bookings">My Bookings</Link>
          <Link to="/surprises">Surprises ✨</Link>
        </>
      );
    }

    // guest role
    return <Link to="/vendors">Vendors</Link>;
  };

  return (
    <Layout.Header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <img src="/icon.jpeg" alt="Vedika 360" className="logo-icon" />
          Vedika 360
        </Link>

        {user ? (
          <div className="header-right">
            <nav className="nav-menu">
              {getNavLinks()}
            </nav>

            <Badge count={unreadCount} size="small" offset={[-2, 2]}>
              <Button
                type="text"
                icon={<BellOutlined style={{ fontSize: 18 }} />}
                aria-label="Notifications"
                onClick={() => navigate('/notifications')}
                style={{ marginRight: 8 }}
              />
            </Badge>

            <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
              <Avatar icon={<UserOutlined />} className="user-avatar" />
            </Dropdown>
          </div>
        ) : (
          <div className="header-right">
            <Button type="text" onClick={() => navigate('/login')}>
              Login
            </Button>
            <Button type="primary" onClick={() => navigate('/register')}>
              Register
            </Button>
          </div>
        )}
      </div>
    </Layout.Header>
  );
};

export default Header;
