import { useState, useEffect } from 'react';

interface DeviceOrientation {
  isMobile: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  orientation: 'portrait' | 'landscape' | 'unknown';
}

export const useDeviceOrientation = (): DeviceOrientation => {
  const [orientation, setOrientation] = useState<DeviceOrientation>({
    isMobile: false,
    isPortrait: false,
    isLandscape: false,
    orientation: 'unknown'
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateOrientation = () => {
      // Détection mobile basée sur la taille d'écran
      const isMobile = window.innerWidth <= 768;

      // Détection de l'orientation fiable avec matchMedia
      let currentOrientation: 'portrait' | 'landscape' | 'unknown' = 'unknown';
      let isPortrait = false;
      let isLandscape = false;

      if (window.matchMedia) {
        if (window.matchMedia('(orientation: portrait)').matches) {
          currentOrientation = 'portrait';
        } else if (window.matchMedia('(orientation: landscape)').matches) {
          currentOrientation = 'landscape';
        }
      } else if (window.screen?.orientation) {
        const angle = window.screen.orientation.angle;
        currentOrientation = (angle === 0 || angle === 180) ? 'portrait' : 'landscape';
      } else if (window.orientation !== undefined) {
        const angle = window.orientation;
        currentOrientation = (angle === 0 || angle === 180) ? 'portrait' : 'landscape';
      } else {
        currentOrientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
      }

      isPortrait = currentOrientation === 'portrait';
      isLandscape = currentOrientation === 'landscape';

      setOrientation({
        isMobile,
        isPortrait,
        isLandscape,
        orientation: currentOrientation
      });
    };

    // Initialisation
    updateOrientation();

    // Event listeners pour les changements
    const handleOrientationChange = () => {
      setTimeout(updateOrientation, 100);
    };
    const handleResize = () => {
      updateOrientation();
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleResize);
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
    }

    // Cleanup
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange);
      }
    };
  }, []);

  return orientation;
};