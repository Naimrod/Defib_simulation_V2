import React, { useState, useRef } from 'react';
import { useWebSerial } from '../hooks/useWebSerial';
import { useWebSocket } from '../context/WebSocketContext';

export default function HardwareConnector() {
  const { isConnected, connect, disconnect, error } = useWebSerial();
  const { sendMessage, sessionId } = useWebSocket();
  const [isMocking, setIsMocking] = useState(false);
  const mockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startMockData = () => {
    setIsMocking(true);
    let counter = 0;
    
    mockIntervalRef.current = setInterval(() => {
      const fakeChunk = [];
      for (let i = 0; i < 10; i++) {
        
        // 1 heartbeat every 250 samples (1 second = 60 BPM)
        const cycle = counter % 250; 
        let value = 0;

        if (cycle > 10 && cycle < 30) {
          // P Wave (Small initial bump)
          value = Math.sin((cycle - 10) * Math.PI / 20) * 0.15;
        } else if (cycle > 45 && cycle < 50) {
          // Q Wave (Small dip before the spike)
          value = -0.15;
        } else if (cycle >= 50 && cycle < 55) {
          // R Wave (THE BIG SPIKE)
          value = 1.2;
        } else if (cycle >= 55 && cycle < 65) {
          // S Wave (Deep dip after the spike)
          value = -0.3;
        } else if (cycle > 110 && cycle < 150) {
          // T Wave (Medium bump after the heartbeat)
          value = Math.sin((cycle - 110) * Math.PI / 40) * 0.25;
        } else {
          // Baseline with tiny electrical noise (to look like real hardware)
          value = (Math.random() - 0.5) * 0.04;
        }

        // Add a slow, wandering baseline (simulates the patient breathing)
        value += Math.sin(counter * 0.005) * 0.1;

        fakeChunk.push(value);
        counter++;
      }

      sendMessage({
        type: "live_hardware",
        sensor: "ecg",
        data: fakeChunk,
        session_id: sessionId
      });
    }, 40); // 40ms = 250Hz batching
  };

  const stopMockData = () => {
    setIsMocking(false);
    if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
  };

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-red-500 text-xs">{error}</span>}
      
      {/* Real Hardware Button */}
      {!isConnected ? (
        <button onClick={connect} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs transition-colors">
          USB Électrodes
        </button>
      ) : (
        <button onClick={disconnect} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs transition-colors">
          Déconnecter USB
        </button>
      )}

      {/* Fake Hardware Button */}
      {!isMocking ? (
        <button onClick={startMockData} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded text-xs transition-colors">
          Simuler Data
        </button>
      ) : (
        <button onClick={stopMockData} className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1 rounded text-xs transition-colors">
          Stop Simulation
        </button>
      )}
    </div>
  );
}