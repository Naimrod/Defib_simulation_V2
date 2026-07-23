import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';

interface WebSocketContextType {
  lastMessage: any;
  isConnected: boolean;
  sendMessage: (message: Record<string, any>) => void;
  subscribeMessage: (callback: (data: any) => void) => () => void;
  getInterpolatedTime: () => number;
  deviceId: string;
  sessionId: string;
  activeDevices: string[];
  isHardwareConnected: boolean;
  sendHardwareBytes: (bytes: Uint8Array) => void;
  subscribeHardwareData: (callback: (bytes: Uint8Array) => void) => () => void;
  connectionRejected: boolean;
  rejectionMessage: string | null;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Determine the WS base URL based on the current host to handle different dev environments
const getWsUrl = () => {
    if (typeof window === 'undefined') return 'ws://localhost:8000';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port === '3000' ? ':8000' : (window.location.port ? `:${window.location.port}` : '');
    
    return `${protocol}//${host}${port}`;
};

export const WebSocketProvider: React.FC<{ children: ReactNode, sessionId: string, deviceId: string }> = ({ children, sessionId, deviceId }) => {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionRejected, setConnectionRejected] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const rejectedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [activeDevices, setActiveDevices] = useState<string[]>([]);

  // Queue d'envoi hors-ligne et auditeurs d'événements entrants
  const outgoingQueueRef = useRef<Record<string, any>[]>([]);
  const messageListenersRef = useRef<Set<(data: any) => void>>(new Set());

  // --- Canal binaire dédié au flux ECG live hardware ---
  const hardwareWsRef = useRef<WebSocket | null>(null);
  const hardwareReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isHardwareConnected, setIsHardwareConnected] = useState(false);
  const hardwareListenersRef = useRef<Set<(bytes: Uint8Array) => void>>(new Set());

  // Time Sync & Smooth EMA Offset Refs
  const lastServerTimeRef = useRef<number>(0);
  const arrivalTimeRef = useRef<number>(0);
  const smoothOffsetRef = useRef<number | null>(null);
  const lastInterpolatedTimeRef = useRef<number>(0);

  const subscribeMessage = useCallback((callback: (data: any) => void) => {
    messageListenersRef.current.add(callback);
    return () => {
      messageListenersRef.current.delete(callback);
    };
  }, []);

  const connect = useCallback(() => {
    if (rejectedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
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

          // Vider la file d'attente des messages envoyés hors-ligne
          while (outgoingQueueRef.current.length > 0) {
            const queuedMsg = outgoingQueueRef.current.shift();
            if (queuedMsg) {
              try {
                ws.send(JSON.stringify(queuedMsg));
              } catch (err) {
                console.error('[WebSocket] Failed to send queued message', err);
              }
            }
          }

          // Demander immédiatement une synchronisation d'état au serveur
          try {
            ws.send(JSON.stringify({ type: "request_sync" }));
          } catch (err) {
            console.error('[WebSocket] Failed to send request_sync on open', err);
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "connection_rejected") {
              rejectedRef.current = true;
              setConnectionRejected(true);
              setRejectionMessage(data.message || null);
              return;
            }

            // Traitement silencieux des time_sync pour éviter les re-renders inutiles
            if (data.global_time || data.timestamp) {
              const serverSec = data.global_time || (new Date(data.timestamp).getTime() / 1000);
              lastServerTimeRef.current = serverSec;
              arrivalTimeRef.current = performance.now();

              const measuredOffsetSec = serverSec - (performance.now() / 1000);
              if (smoothOffsetRef.current === null) {
                smoothOffsetRef.current = measuredOffsetSec;
              } else {
                // Filtre EMA (factor 0.1) pour lisser les variations de latence réseau
                smoothOffsetRef.current += (measuredOffsetSec - smoothOffsetRef.current) * 0.1;
              }

              if (data.type === "time_sync") {
                return; // Ne pas propager aux composants UI
              }
            }

            if (data.type === "device_list_update") {
              setActiveDevices(data.devices);
            }

            setLastMessage(data);

            // Distribution séquentielle à tous les auditeurs inscrits
            messageListenersRef.current.forEach((listener) => {
              try {
                listener(data);
              } catch (err) {
                console.error('[WebSocket] Error in message listener', err);
              }
            });
          } catch (err) {
            console.error('[WebSocket] Failed to parse message', err);
          }
        };

        ws.onclose = (event) => {
          console.log(`[WebSocket] ⚪ Disconnected: ${event.reason || 'No reason'} (Code: ${event.code})`);
          setIsConnected(false);
          wsRef.current = null;
          if (rejectedRef.current) return;
          if (!reconnectTimeoutRef.current) {
              reconnectTimeoutRef.current = setTimeout(connect, 3000);
          }
        };

        ws.onerror = (error) => {
          console.error('[WebSocket] 🔴 Connection Error:', error);
        };

        wsRef.current = ws;
    } catch (err) {
        console.error('[WebSocket] 🔴 Failed to create WebSocket instance:', err);
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
    }
  }, [sessionId, deviceId]);

  const connectHardware = useCallback(() => {
    if (hardwareWsRef.current?.readyState === WebSocket.OPEN) return;

    if (deviceId.includes('_init')) return;

    const baseUrl = getWsUrl();
    const url = `${baseUrl}/ws/hardware?sessionId=${encodeURIComponent(sessionId)}`;
    console.log(`[HardwareWS] Attempting connection to ${url}`);

    try {
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        console.log(`[HardwareWS] 🟢 Connected to session ${sessionId}`);
        setIsHardwareConnected(true);
        if (hardwareReconnectTimeoutRef.current) {
          clearTimeout(hardwareReconnectTimeoutRef.current);
          hardwareReconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        const bytes = new Uint8Array(event.data as ArrayBuffer);
        // Ignore 1-byte keep-alive ping frames
        if (bytes.length === 1 && bytes[0] === 0x00) return;
        hardwareListenersRef.current.forEach((callback) => callback(bytes));
      };

      ws.onclose = (event) => {
        console.log(`[HardwareWS] ⚪ Disconnected: ${event.reason || 'No reason'} (Code: ${event.code})`);
        setIsHardwareConnected(false);
        hardwareWsRef.current = null;
        if (!hardwareReconnectTimeoutRef.current) {
          hardwareReconnectTimeoutRef.current = setTimeout(connectHardware, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error(`[HardwareWS] 🔴 Connection Error:`, error);
      };

      hardwareWsRef.current = ws;
    } catch (err) {
      console.error(`[HardwareWS] 🔴 Failed to create WebSocket instance:`, err);
      hardwareReconnectTimeoutRef.current = setTimeout(connectHardware, 5000);
    }
  }, [sessionId, deviceId]);

  // Keep-alive heartbeat interval pour préserver le canal binaire /ws/hardware sur Render
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (hardwareWsRef.current?.readyState === WebSocket.OPEN) {
        try {
          hardwareWsRef.current.send(new Uint8Array([0x00]));
        } catch {}
      }
    }, 15000);

    return () => clearInterval(pingInterval);
  }, []);

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

  useEffect(() => {
    connectHardware();
    return () => {
      if (hardwareReconnectTimeoutRef.current) {
        clearTimeout(hardwareReconnectTimeoutRef.current);
        hardwareReconnectTimeoutRef.current = null;
      }
      if (hardwareWsRef.current) {
        console.log('[HardwareWS] Cleaning up connection...');
        hardwareWsRef.current.onclose = null;
        hardwareWsRef.current.close();
        hardwareWsRef.current = null;
      }
    };
  }, [connectHardware]);

  const sendMessage = useCallback((message: Record<string, any>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn(`[WebSocket] Not connected. Queuing message for transmission...`);
      outgoingQueueRef.current.push(message);
    }
  }, []);

  const sendHardwareBytes = useCallback((bytes: Uint8Array) => {
    if (hardwareWsRef.current && hardwareWsRef.current.readyState === WebSocket.OPEN) {
      hardwareWsRef.current.send(bytes as BufferSource);
    } else {
      console.warn(`[HardwareWS] Cannot send bytes, not connected.`);
    }
  }, []);

  const subscribeHardwareData = useCallback((callback: (bytes: Uint8Array) => void) => {
    hardwareListenersRef.current.add(callback);
    return () => {
      hardwareListenersRef.current.delete(callback);
    };
  }, []);

  /**
   * Horloge interpolée strictement monotonique et lissée.
   */
  const getInterpolatedTime = useCallback(() => {
    const nowSec = performance.now() / 1000;
    const offsetSec = smoothOffsetRef.current !== null ? smoothOffsetRef.current : (lastServerTimeRef.current ? lastServerTimeRef.current - (arrivalTimeRef.current / 1000) : 0);
    const calculatedTime = nowSec + offsetSec;

    // Garantit que le temps ne recule jamais (mouvement toujours monotonique)
    if (calculatedTime > lastInterpolatedTimeRef.current) {
      lastInterpolatedTimeRef.current = calculatedTime;
    }
    return lastInterpolatedTimeRef.current;
  }, []);

  return (
    <WebSocketContext.Provider value={{ 
      lastMessage, isConnected, sendMessage, subscribeMessage, getInterpolatedTime, deviceId, sessionId, activeDevices,
      isHardwareConnected, sendHardwareBytes, subscribeHardwareData, connectionRejected, rejectionMessage
    }}>
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
