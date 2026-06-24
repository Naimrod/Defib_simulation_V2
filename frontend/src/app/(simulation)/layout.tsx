"use client";

import React, { useMemo, useState, useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { AudioProvider } from '../context/AudioContext';
import { WebSocketProvider } from '../context/WebSocketContext';

function SimulationLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  // Use useEffect to prevent hydration mismatch for client-only data (sessionStorage)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Save username to localStorage if provided via query param to persist across pages
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    const urlUsername = searchParams.get('username');
    if (urlUsername) {
      localStorage.setItem('username', urlUsername);
    }
  }, [searchParams, mounted]);
  
  // 1. Resolve Session ID (Username)
  const sessionId = useMemo(() => {
    if (!mounted || typeof window === 'undefined') return 'anonymous';
    
    // Priority: URL Param > LocalStorage > Default
    return searchParams.get('username') || 
           localStorage.getItem('username') || 
           'anonymous';
  }, [searchParams, mounted]);

  // 2. Resolve Device ID (Unique Instance)
  const deviceId = useMemo(() => {
    const deviceType = pathname.split('/').filter(Boolean).pop() || 'unknown';
    
    if (!mounted || typeof window === 'undefined') return `${deviceType}_init`;

    const manualId = searchParams.get('id');
    if (manualId) return `${deviceType}_${manualId}`;

    const storageKey = `defib_instance_id_${deviceType}`;

    let salt = sessionStorage.getItem(storageKey);
    if (!salt) {
      salt = Math.random().toString(36).substring(2, 7).toUpperCase();
      sessionStorage.setItem(storageKey, salt);
    }

    return `${deviceType}_${salt}`;
  }, [pathname, searchParams, mounted]);

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

export default function SimulationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div style={{ color: '#fff', padding: '20px' }}>Chargement de la simulation...</div>}>
      <SimulationLayoutContent>
        {children}
      </SimulationLayoutContent>
    </Suspense>
  );
}

