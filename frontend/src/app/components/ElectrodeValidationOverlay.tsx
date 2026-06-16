import React from 'react';

//ModifcodeSam
import { emit } from "@/lib/eventBus";
//ModifcodeSam

interface ElectrodeValidationOverlayProps {
  onValidate: () => void;
}

const ElectrodeValidationOverlay: React.FC<ElectrodeValidationOverlayProps> = ({ onValidate }) => {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-black text-white">
      <div className="flex flex-col items-center justify-center space-y-8">
        <h2 className="text-xl font-bold text-center mb-4 mt-6">
          Placez les électrodes comme indiqué
        </h2>

        <div className="flex items-center justify-center">
          <img
            src="/images/placement_electrodes.jpg"
            alt="Placement des électrodes"
            className="max-w-md h-auto"
          />
        </div>

        <button

        onClick={onValidate}
        
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-5 rounded-lg text-xl transition-colors duration-200 mb-7"
        >
          Valider
        </button>
      </div>
    </div>
  );
};

export default ElectrodeValidationOverlay; 