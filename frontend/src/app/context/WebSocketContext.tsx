import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';

interface WebSocketContextType {
  lastMessage: any;
  isConnected: boolean;
  sendMessage: (message: Record<string, any>) => void;
  getInterpolatedTime: () => number;
  deviceId: string;
  sessionId: string;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Determine the WS base URL based on the current host to handle different dev environments
const getWsUrl = () => {
    if (typeof window === 'undefined') return 'ws://localhost:8000';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    
    // In dev, the backend is likely on 8000 while frontend is on 3000
    // If we are on port 3000, we point to 8000.
    // Otherwise, we use current port (for production unified deployment)
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
    
    // Don't connect if we are still in the initial phase (before client mount is ready) to avoid double-connected confusion
    if (deviceId.includes('_init')) {
        console.log(`[WebSocket] Waiting for stable identity (sid: ${sessionId}, did: ${deviceId})...`);
        return;
    }

    const baseUrl = getWsUrl();
    const url = `${baseUrl}/sessionId?username=${encodeURIComponent(sessionId)}&deviceId=${encodeURIComponent(deviceId)}`;
    console.log(`[WebSocket] Attempting connection to ${url}`);
    
    try {
        const ws = new WebSocket(url);

        ws.onopen = () => {
          console.log(`[WebSocket] 🟢 Connected as ${deviceId} to session ${sessionId}`);
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
          console.log(`[WebSocket] ⚪ Disconnected: ${event.reason || 'No reason'} (Code: ${event.code})`);
          setIsConnected(false);
          wsRef.current = null;
          // Auto-reconnect
          if (!reconnectTimeoutRef.current) {
              reconnectTimeoutRef.current = setTimeout(connect, 3000);
          }
        };

        ws.onerror = (error) => {
          console.error('[WebSocket] 🔴 Connection Error:', error);
          // onclose will handle reconnection
        };

        wsRef.current = ws;
    } catch (err) {
        console.error('[WebSocket] 🔴 Failed to create WebSocket instance:', err);
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
    }
  }, [sessionId, deviceId]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
          console.log('[WebSocket] Cleaning up connection...');
          wsRef.current.onclose = null; 
          wsRef.current.close();
          wsRef.current = null;
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
    <WebSocketContext.Provider value={{ lastMessage, isConnected, sendMessage, getInterpolatedTime, deviceId, sessionId }}>
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
