import React, { useContext } from 'react';
import { Layout, Button, Dropdown, Avatar, Tag } from 'antd';
import { UserOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Header.css';

const Header = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

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
          <Link to="/vendors">Vendors</Link>
          <Link to="/bookings">Bookings</Link>
        </>
      );
    }

    if (role === 'organizer' || role === 'customer') {
      return (
        <>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/vendors">Vendors</Link>
          <Link to="/bookings">My Bookings</Link>
        </>
      );
    }

    if (role === 'vendor') {
      return (
        <>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/bookings">My Bookings</Link>
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
          EventOS
        </Link>

        {user ? (
          <div className="header-right">
            <nav className="nav-menu">
              {getNavLinks()}
            </nav>

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
