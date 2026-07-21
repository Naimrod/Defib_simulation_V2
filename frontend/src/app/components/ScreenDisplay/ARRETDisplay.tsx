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
        <div className="text-9xl  flex-grow flex-col pb-0 gap-1.5 opacity-2 pb-500 group-hover:opacity-100 transition-opacity duration-300 group-focus:opacity-100 transition-opacity duration-300 group-active:opacity-100 transition-opacity duration-300">
          
          {shortId}
        </div>
      )}
    </div>
  );
};

export default ARRETDisplay; 