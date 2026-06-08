import { useState } from 'react';

export const useElectrodeValidation = () => {
  const [isElectrodeValidated, setIsElectrodeValidated] = useState(false);

  const validateElectrodes = () => {
    setIsElectrodeValidated(true);
  };

  const resetElectrodeValidation = () => {
    setIsElectrodeValidated(false);
  };

  return {
    isElectrodeValidated,
    validateElectrodes,
    resetElectrodeValidation,
  };
}; 