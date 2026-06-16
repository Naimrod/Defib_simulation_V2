import { useRef } from 'react';

export const usePlethAnimation = () => {
  const scanXRef = useRef(0);
  const sampleIndexRef = useRef(0);
  const lastYRef = useRef<number | null>(null);

  const getScanX = () => scanXRef.current;
  const setScanX = (value: number) => {
    scanXRef.current = value;
  };

  const getSampleIndex = () => sampleIndexRef.current;
  const setSampleIndex = (value: number) => {
    sampleIndexRef.current = value;
  };

  const getLastY = () => lastYRef.current;
  const setLastY = (value: number | null) => {
    lastYRef.current = value;
  };

  return {
    getScanX,
    setScanX,
    getSampleIndex,
    setSampleIndex,
    getLastY,
    setLastY
  };
}; 