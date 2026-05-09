import React, { useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './RouteTransition.css';

const getSkeletonVariant = (pathname, role) => {
  if (pathname === '/login' || pathname === '/register') return 'auth';
  if (pathname.startsWith('/dashboard')) {
    if (role === 'admin') return 'dashboard-admin';
    if (role === 'vendor') return 'dashboard-vendor';
    return 'dashboard-organizer';
  }
  if (pathname.startsWith('/vendors')) return 'vendors';
  if (pathname.startsWith('/bookings')) return 'bookings';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/events')) return 'event';
  return 'default';
};

const getSkeletonDensity = (variant) => {
  switch (variant) {
    case 'dashboard-admin':
      return { cardCount: 4, listCount: 4 };
    case 'dashboard-vendor':
      return { cardCount: 2, listCount: 2 };
    case 'dashboard-organizer':
      return { cardCount: 3, listCount: 3 };
    case 'auth':
      return { cardCount: 1, listCount: 0 };
    case 'vendors':
      return { cardCount: 3, listCount: 3 };
    case 'bookings':
      return { cardCount: 2, listCount: 4 };
    case 'profile':
      return { cardCount: 1, listCount: 2 };
    case 'event':
      return { cardCount: 2, listCount: 3 };
    default:
      return { cardCount: 2, listCount: 3 };
  }
};

const RouteTransition = ({ children }) => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const [isRouteLoading, setIsRouteLoading] = useState(true);
  const variant = getSkeletonVariant(location.pathname, user?.role);
  const { cardCount, listCount } = getSkeletonDensity(variant);

  useEffect(() => {
    setIsRouteLoading(true);
    const timer = window.setTimeout(() => {
      setIsRouteLoading(false);
    }, 230);

    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  return (
    <>
      {isRouteLoading ? (
        <div className={`route-loading-skeleton route-loading-skeleton-${variant}`} aria-hidden="true">
          <div className="route-loading-line route-loading-line-1" />
          <div className="route-loading-line route-loading-line-2" />

          <div className="route-loading-card-grid">
            {Array.from({ length: cardCount }).map((_, index) => (
              <div key={`card-${variant}-${index}`} className="route-loading-card" />
            ))}
          </div>

          <div className="route-loading-list">
            {Array.from({ length: listCount }).map((_, index) => (
              <div key={`list-${variant}-${index}`} className="route-loading-list-item" />
            ))}
          </div>
        </div>
      ) : null}
      <div key={location.pathname} className={`route-transition-shell${isRouteLoading ? ' route-hidden' : ''}`}>
        {children}
      </div>
    </>
  );
};

export default RouteTransition;
