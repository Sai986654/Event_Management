import React from 'react';
import './AppSplashScreen.css';

const AppSplashScreen = ({ visible }) => {
  if (!visible) {
    return null;
  }

  return (
    <div className="app-splash" role="status" aria-live="polite" aria-label="Loading Vedika 360">
      <div className="app-splash-orb" />
      <div className="app-splash-card">
        <img src="/icon.jpeg" alt="Vedika 360" className="app-splash-logo" />
        <h1>Vedika 360</h1>
        <p>Rely on us for everything</p>
        <div className="app-splash-loader" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
};

export default AppSplashScreen;
