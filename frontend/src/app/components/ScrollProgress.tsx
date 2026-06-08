"use client";

import { useEffect, useState } from "react";

const ScrollProgress = () => {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const updateScrollProgress = () => {
      const currentScroll = window.pageYOffset;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      
      if (scrollHeight > 0) {
        const progress = (currentScroll / scrollHeight) * 100;
        setScrollProgress(Math.min(progress, 100));
      }
    };

    window.addEventListener("scroll", updateScrollProgress);
    updateScrollProgress(); 

    return () => window.removeEventListener("scroll", updateScrollProgress);
  }, []);

  return (
    <div className="fixed top-0 left-0 w-full z-50 h-1 bg-gray-800/50 backdrop-blur-sm">
      <div
        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-150 ease-out shadow-lg"
        style={{
          width: `${scrollProgress}%`,
          boxShadow: "0 0 10px rgba(59, 130, 246, 0.5)",
        }}
      />
    </div>
  );
};

export default ScrollProgress; 