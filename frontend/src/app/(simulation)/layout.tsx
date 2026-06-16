"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { AudioProvider } from '../context/AudioContext';
import { WebSocketProvider } from '../context/WebSocketContext';

export default function SimulationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Extract deviceId from path (e.g., /remote -> remote, /defibrilator -> defibrilator)
  const deviceId = pathname.split('/').filter(Boolean).pop() || 'unknown';
  
  // In a real scenario, the sessionId would come from a URL param or a state
  // For Phase 0 pilot, we use a fixed session ID.
  return (
    <AudioProvider>
      <WebSocketProvider sessionId="pilot_session" deviceId={deviceId}>
        <div className="simulation-layout">
          {children}
        </div>
      </WebSocketProvider>
    </AudioProvider>
  );
}
