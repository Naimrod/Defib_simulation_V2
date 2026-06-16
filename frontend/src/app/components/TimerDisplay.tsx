import React from 'react';

interface TimerDisplayProps {
  className?: string;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

const TimerDisplay: React.FC<TimerDisplayProps> = ({
  className = "text-white text-3xl font-bold font-mono",
  minutes,
  seconds,
  totalSeconds
}) => {
  // Format: MM:SS always, with a fallback for undefined values
  const formatTime = () => {
    const m = typeof minutes === 'number' ? minutes : 0;
    const s = typeof seconds === 'number' ? seconds : 0;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Couleur selon la durée
  const getTimerColor = () => {
    if (totalSeconds < 300) return 'text-green-400';    // Vert les 5 premières minutes
    if (totalSeconds < 900) return 'text-orange-400';   // Orange de 5 à 15 minutes  
    if (totalSeconds < 1500) return 'text-red-400';     // Rouge de 15 à 25 minutes
    return 'text-red-500 animate-pulse';                // Rouge clignotant les 5 dernières minutes
  };

  return (
    <div className="flex items-center justify-center">
      <div className={`${className} ${getTimerColor()}`}>
        {formatTime()}
      </div>

      {/* Indicateur visuel simple */}
      <div className="ml-2 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
    </div>
  );
};

export default TimerDisplay;
