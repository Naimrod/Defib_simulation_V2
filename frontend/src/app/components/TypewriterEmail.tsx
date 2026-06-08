import React, { useState, useEffect } from 'react';

const TypewriterEmail = () => {
  const emails = [
    { label: "Collaborations", email: "sami.ellouze@aphp.fr" },
    { label: "Développeur", email: "marius.gal05@gmail.com" }
  ];

  const [currentEmailIndex, setCurrentEmailIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const currentEmail = emails[currentEmailIndex];
    const fullText = ` ${currentEmail.label}: ${currentEmail.email}`;

    const typeSpeed = isDeleting ? 30 : 80;
    const pauseTime = isDeleting ? 500 : 2500;

    if (isPaused) {
      const pauseTimer = setTimeout(() => {
        setIsPaused(false);
        if (!isDeleting) {
          setIsDeleting(true);
        } else {
          setIsDeleting(false);
          setCurrentEmailIndex((prev) => (prev + 1) % emails.length);
        }
      }, pauseTime);

      return () => clearTimeout(pauseTimer);
    }

    const timer = setTimeout(() => {
      if (!isDeleting) {
        if (displayText.length < fullText.length) {
          setDisplayText(fullText.substring(0, displayText.length + 1));
        } else {
          setIsPaused(true);
        }
      } else {
        if (displayText.length > 0) {
          setDisplayText(displayText.substring(0, displayText.length - 1));
        } else {
          setIsPaused(true);
        }
      }
    }, typeSpeed);

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, isPaused, currentEmailIndex, emails]);

  const handleEmailClick = () => {
    const currentEmail = emails[currentEmailIndex];
    window.location.href = `mailto:${currentEmail.email}`;
  };

  return (
    <div className="flex flex-col items-center mt-12 mb-6 px-4">
      <div className="text-center">
        <div className="w-16 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 mx-auto mb-8"></div>

        <h3 className="text-lg md:text-xl font-semibold text-white mb-5">Questions ? Contactez-nous</h3>
      </div>
      
      <div 
        className="group relative bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-md border border-gray-700/50 rounded-2xl px-4 md:px-8 py-4 md:py-6 min-h-[60px] md:min-h-[80px] w-full max-w-[400px] md:min-w-[400px] flex items-center justify-center cursor-pointer transition-all duration-500 hover:scale-105 hover:border-cyan-500/30 shadow-xl hover:shadow-cyan-500/10"
        onClick={handleEmailClick}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-blue-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
        
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"></div>
        
        <div className="relative z-10 text-center">
          <span className="text-white font-mono text-sm md:text-base tracking-wide block break-words md:break-normal md:whitespace-nowrap">
            {displayText}
            <span className="animate-pulse text-cyan-400 ml-1 font-bold">▌</span>
          </span>
        </div>
        
      </div>
      
      <div className="flex items-center gap-2 mt-4 text-gray-400 text-xs md:text-sm">
        <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="opacity-70 hover:opacity-100 transition-opacity text-center">
          Cliquez pour envoyer un email
        </span>
      </div>
    </div>
  );
};

export default TypewriterEmail;