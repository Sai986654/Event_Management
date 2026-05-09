const isLocalhost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/);

export function register() {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
    return;
  }

  const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

  window.addEventListener('load', () => {
    if (isLocalhost) {
      navigator.serviceWorker
        .register(swUrl)
        .then(() => {
          console.log('Service worker registered in localhost mode.');
        })
        .catch((error) => {
          console.error('Service worker registration failed:', error);
        });
      return;
    }

    navigator.serviceWorker.register(swUrl).catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

export function unregister() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.ready
    .then((registration) => {
      registration.unregister();
    })
    .catch((error) => {
      console.error(error.message);
    });
}
