import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';

interface WebSocketContextType {
  lastMessage: any;
  isConnected: boolean;
  sendMessage: (message: Record<string, any>) => void;
  getInterpolatedTime: () => number;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Determine the WS base URL based on the current host to handle different dev environments
const getWsUrl = () => {
    if (typeof window === 'undefined') return 'ws://localhost:8000';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    // In dev, the backend is likely on 8000 while frontend is on 3000
    // If we are on port 3000, we point to 8000. Otherwise, we use current host.
    const port = window.location.port === '3000' ? ':8000' : (window.location.port ? `:${window.location.port}` : '');
    return `${protocol}//${host}${port}`;
};

export const WebSocketProvider: React.FC<{ children: ReactNode, sessionId: string, deviceId: string }> = ({ children, sessionId, deviceId }) => {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Time Sync Refs (Still useful for smooth graphing if global_time is provided)
  const lastServerTimeRef = useRef<number>(0);
  const arrivalTimeRef = useRef<number>(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const baseUrl = getWsUrl();
    const url = `${baseUrl}/sessionId?username=${encodeURIComponent(sessionId)}&deviceId=${encodeURIComponent(deviceId)}`;
    console.log(`[WebSocket] Connecting to ${url}`);
    
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log(`[WebSocket] Connected as ${deviceId} to session ${sessionId}`);
      setIsConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        
        // Update time sync markers if the packet contains a timestamp
        if (data.global_time || data.timestamp) {
            lastServerTimeRef.current = data.global_time || (new Date(data.timestamp).getTime() / 1000);
            arrivalTimeRef.current = performance.now();
        }
      } catch (err) {
        console.error('[WebSocket] Failed to parse message', err);
      }
    };

    ws.onclose = (event) => {
      console.log(`[WebSocket] Disconnected: ${event.reason || 'No reason'}`);
      setIsConnected(false);
      wsRef.current = null;
      // Auto-reconnect
      reconnectTimeoutRef.current = setTimeout(connect, 2000);
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error', error);
      // Let onclose handle reconnection
    };

    wsRef.current = ws;
  }, [sessionId, deviceId]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
          wsRef.current.onclose = null; // Prevent reconnect on intentional unmount
          wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: Record<string, any>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn(`[WebSocket] Cannot send message, not connected.`);
    }
  }, []);

  /**
   * Returns the server time extrapolated based on the time passed since the last packet.
   * This allows the frontend to run at 60fps even though the server broadcasts at 10Hz.
   */
  const getInterpolatedTime = useCallback(() => {
    if (!lastServerTimeRef.current) return performance.now() / 1000;
    const timeSincePacketMs = performance.now() - arrivalTimeRef.current;
    return lastServerTimeRef.current + (timeSincePacketMs / 1000);
  }, []);

  return (
    <WebSocketContext.Provider value={{ lastMessage, isConnected, sendMessage, getInterpolatedTime }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
