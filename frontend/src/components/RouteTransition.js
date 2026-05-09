import React from 'react';
import { useLocation } from 'react-router-dom';
import './RouteTransition.css';

const RouteTransition = ({ children }) => {
  const location = useLocation();

  return (
    <div key={location.pathname} className="route-transition-shell">
      {children}
    </div>
  );
};

export default RouteTransition;
