import { useEffect } from 'react';

const usePullToRefreshGuard = (enabled) => {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let startY = 0;

    const onTouchStart = (event) => {
      if (!event.touches || event.touches.length === 0) {
        return;
      }
      startY = event.touches[0].clientY;
    };

    const onTouchMove = (event) => {
      if (!event.touches || event.touches.length === 0) {
        return;
      }

      const deltaY = event.touches[0].clientY - startY;
      const isPullingDown = deltaY > 8;

      if (window.scrollY <= 0 && isPullingDown) {
        event.preventDefault();
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, [enabled]);
};

export default usePullToRefreshGuard;
