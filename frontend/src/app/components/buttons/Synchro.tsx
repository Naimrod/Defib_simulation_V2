import React from 'react';

interface SynchroProps {
  onClick?: () => void;
  isActive?: boolean; 
}

const Synchro = ({ onClick, isActive = false }: SynchroProps) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <button 
      className="flex items-center gap-4 p-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 cursor-pointer relative"
      onClick={handleClick}
    >
      <div className="flex-row">
        <div className={`ml-7 rounded-md flex items-center justify-center w-8 h-6 rounded-lg relative transition-all duration-400 ${
          isActive 
            ? 'bg-white border-4 border-blue-800 shadow-[0_0_15px_rgba(59,130,246,0.8)]' 
            : 'bg-white'
        }`}>
        </div>
      </div>
      <span className="text-white text-xs font-bold">Synchro</span>
    </button>
  );
};

export default Synchro;