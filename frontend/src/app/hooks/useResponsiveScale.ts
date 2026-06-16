import { useState, useEffect } from "react";

export const useResponsiveScale = (referenceWidth: number, referenceHeight: number): number => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      // Check if window is defined (to prevent errors during server-side rendering)
      if (typeof window !== 'undefined') {
        const { innerWidth: viewportWidth, innerHeight: viewportHeight } = window;

        // Calculate the scale factor for both width and height
        const scaleX = viewportWidth / referenceWidth;
        const scaleY = viewportHeight / referenceHeight;

        // Use the smaller of the two scale factors to ensure the component
        // fits entirely within the viewport without distortion.
        const newScale = Math.min(scaleX, scaleY);

        setScale(newScale);
      }
    };

    // Set the initial scale when the component mounts
    handleResize();

    // Add event listener to handle window resizing
    window.addEventListener('resize', handleResize);

    // Cleanup function to remove the event listener
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [referenceWidth, referenceHeight]); // Rerun effect if reference dimensions change

  return scale;
};
