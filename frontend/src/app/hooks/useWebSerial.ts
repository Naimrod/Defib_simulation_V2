import { useState, useRef, useCallback } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export const useWebSerial = (bufferSize = 300) => {
    const { sendMessage , sessionId } = useWebSocket();

    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const portRef = useRef<any>(null);
    const readerRef = useRef<any>(null);

    const connect = async() => {
        if (!('serial' in navigator)) {
            setError("Web Serial API not supported - Try another supported navigator"); return; // Verify if navigator supports webSerial
        }
        try {
            const port = await (navigator as any).serial.requestPort();
            await port.open({baudRate: 115200});
            portRef.current = port;
            setIsConnected(true);
            setError(null);
            readLoop(port);
        } catch (err: any){
            if (err.name === 'NotFoundError') {
            console.log("L'utilisateur a annulé la sélection du port.");
            setError(null); // Just clear the error, no harm done
        } else {
            setError("Erreur de connexion : " + err.message);
        }
    }
  };

    const readLoop = async (port:any) => {
        const textDecoder = new window.TextDecoderStream();
        port.readable.pipeTo(textDecoder.writable);
        const reader = textDecoder.readable.getReader();
        readerRef.current = reader;

        let textBuffer = '';
        let broadcastChunk: number[] = [];    //Array where the info gets batched up

        try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        textBuffer += value;
        const lines = textBuffer.split('\n');
        textBuffer = lines.pop() || '';

        for (const line of lines) {
          const num = parseFloat(line.trim());
          if (!isNaN(num)) {
            broadcastChunk.push(num);
            
            // Send a batch every 10 data points (keeps the network healthy)
            if (broadcastChunk.length >= 10) {
              sendMessage({
                type: "live_hardware",
                sensor: "ecg", // Can be "pleth" or "ecg"
                data: broadcastChunk,
                session_id: sessionId
              });
              broadcastChunk = []; // Reset the chunk after sending
            }
          }
        }
      }
    } catch (error) {
      disconnect();
    }
  };

  const disconnect = useCallback(async () => { /* ... existing disconnect logic ... */ }, []);

  return { isConnected, connect, disconnect, error };
};