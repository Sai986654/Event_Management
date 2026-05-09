import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Space } from 'antd';

const DISMISS_KEY = 'pwa-install-prompt-dismissed';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const { isIOS, isSafari, isStandalone } = useMemo(() => {
    const userAgent = window.navigator.userAgent || '';
    const ios = /iphone|ipad|ipod/i.test(userAgent);
    const android = /android/i.test(userAgent);
    const safari = /safari/i.test(userAgent) && !/crios|fxios|edgios|opr\//i.test(userAgent);
    const chrome = /chrome|chromium/i.test(userAgent) && !/edg|opr\//i.test(userAgent);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    return {
      isIOS: ios,
      isAndroid: android,
      isSafari: safari,
      isChrome: chrome,
      isStandalone: standalone,
    };
  }, []);

  if (dismissed || isStandalone) {
    return null;
  }

  const isIOSPrompt = isIOS && isSafari;
  const isAndroidPrompt = isAndroid && isChrome;
  const canInstall = !!deferredPrompt;

  if (!isIOSPrompt && !isAndroidPrompt && !canInstall) {
    return null;
  }

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div style={{ margin: '16px 16px 0' }}>
      <Alert
        type="info"
        showIcon
        message="Install Vedika 360"
        description={
          isIOSPrompt
            ? 'On iPhone/iPad: tap Share in Safari, then choose Add to Home Screen.'
            : isAndroidPrompt && !canInstall
            ? 'On Android Chrome: open the browser menu and choose Install app or Add to Home screen.'
            : 'Install Vedika 360 for a faster full-screen app experience.'
        }
        action={
          <Space>
            {canInstall && (
              <Button type="primary" size="small" onClick={handleInstall}>
                Install
              </Button>
            )}
            <Button size="small" onClick={handleDismiss}>
              Dismiss
            </Button>
          </Space>
        }
      />
    </div>
  );
};

export default PWAInstallPrompt;
