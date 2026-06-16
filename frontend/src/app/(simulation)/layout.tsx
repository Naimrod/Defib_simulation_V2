"use client";

import React, { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { AudioProvider } from '../context/AudioContext';
import { WebSocketProvider } from '../context/WebSocketContext';

export default function SimulationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // 1. Resolve Session ID (Username)
  const sessionId = useMemo(() => {
    if (typeof window === 'undefined') return 'anonymous';
    
    // Priority: URL Param > SessionStorage > Default
    return searchParams.get('username') || 
           sessionStorage.getItem('username') || 
           'anonymous';
  }, [searchParams]);

  // 2. Resolve Device ID (Unique Instance)
  const deviceId = useMemo(() => {
    const deviceType = pathname.split('/').filter(Boolean).pop() || 'unknown';
    
    const manualId = searchParams.get('id');
    if (manualId) return `${deviceType}_${manualId}`;

    const storageKey = `defib_instance_id_${deviceType}`;
    if (typeof window === 'undefined') return `${deviceType}_init`;

    let salt = sessionStorage.getItem(storageKey);
    if (!salt) {
      salt = Math.random().toString(36).substring(2, 7).toUpperCase();
      sessionStorage.setItem(storageKey, salt);
    }

    return `${deviceType}_${salt}`;
  }, [pathname, searchParams]);

  return (
    <AudioProvider>
      <WebSocketProvider sessionId={sessionId} deviceId={deviceId}>
        <div className="simulation-layout">
          {children}
        </div>
      </WebSocketProvider>
    </AudioProvider>
  );
}
