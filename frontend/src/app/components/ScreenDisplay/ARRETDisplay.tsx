import React from 'react';

interface ARRETDisplayProps {
  deviceId?: string;
}

const ARRETDisplay: React.FC<ARRETDisplayProps> = ({ deviceId }) => {
  const shortId = deviceId ? (deviceId.includes('_') ? deviceId.split('_')[1] : deviceId) : '';

  return (
    <div className="absolute inset-3 bg-[#050505] rounded-lg flex flex-col items-center justify-center relative overflow-hidden group select-none">
      {/* Device ID Badge */}
      {shortId && (
        <div className="text-9xl font-mono font-bold text-white/20 group-hover:text-white group-focus:text-white group-active:text-white transition-colors duration-300">
          {shortId}
        </div>
      )}
    </div>
  );
};

export default ARRETDisplay; 