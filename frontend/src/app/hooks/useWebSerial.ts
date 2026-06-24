import { useState, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export const useWebSerial = (bufferSize = 300) => {
  const { sendMessage, sessionId } = useWebSocket();

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const keepReadingRef = useRef(false);

  const connect = async () => {
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 }); // Must match the Pico!
      portRef.current = port;

      setIsConnected(true);
      keepReadingRef.current = true;

      readerRef.current = port.readable.getReader();
      
      let broadcastChunk: number[] = [];
      let byteBuffer = new Uint8Array(0); // Stores incoming raw bytes

      // The Unified Binary Reading Loop
      while (keepReadingRef.current) {
        try {
          const { value, done } = await readerRef.current.read(); // value is a Uint8Array
          
          if (done) break; 

          // Add the newly arrived bytes to our buffer
          const newBuffer = new Uint8Array(byteBuffer.length + value.length);
          newBuffer.set(byteBuffer);
          newBuffer.set(value, byteBuffer.length);
          byteBuffer = newBuffer;

          // Process the buffer looking for our 5-byte frames
          while (byteBuffer.length >= 5) {
            
            // Find the start byte (0xC0 which is 192 in decimal)
            const startIndex = byteBuffer.indexOf(0xC0);
            
            if (startIndex === -1) {
              // No start byte found anywhere. The data is garbage. Clear the buffer.
              byteBuffer = new Uint8Array(0);
              break;
            }

            if (startIndex > 0) {
              // We found a start byte, but there is garbage before it. Slice off the garbage
              byteBuffer = byteBuffer.slice(startIndex);
            }

            // After slicing, if we don't have a full 5-byte frame yet, wait for the next USB read
            if (byteBuffer.length < 5) break;

            // --- full 5 byte frame---
            const statusByte = byteBuffer[1];
            const highByte = byteBuffer[2];
            const lowByte = byteBuffer[3];
            // byteBuffer[4] is the unused byte

            let ecgValue = 0;
            let realValue = 0;

            if (statusByte === 1) {
              // Lead is off! Send a flatline.
              ecgValue = 0; 
            } else {
              // Lead is on! Glue the two 8-bit pieces back into a 16-bit number
              ecgValue = (highByte << 8) | lowByte;
              realValue = (ecgValue - 32768) / 33000.0;
            }

            broadcastChunk.push(realValue);

            // Send a batch every 10 data points
            if (broadcastChunk.length >= 10) {
              sendMessage({
                type: "live_hardware",
                sensor: "ecg", 
                data: broadcastChunk,
                session_id: sessionId
              });
              broadcastChunk = []; 
            }

            // Remove the 5 bytes we just processed from the front of the buffer
            byteBuffer = byteBuffer.slice(5);
          }

        } catch (error) {
          console.error("Error reading data:", error);
          break; // Exit on physical disconnect
        }
      }
    } catch (error) {
      console.error("Connection failed:", error);
      setError("Échec de la connexion au port série.");
    } finally {
      // Safe cleanup
      if (readerRef.current) {
        try { readerRef.current.releaseLock(); } catch(e) {}
        readerRef.current = null;
      }
      if (portRef.current) {
        try { 
          await portRef.current.close(); 
          console.log("Port USB fermé avec succès.");
        } catch(e) {}
        portRef.current = null;
      }
      setIsConnected(false);
    }
  };

  const disconnectHardware = async () => {
    console.log("Initialisation de la déconnexion du hardware...");
    keepReadingRef.current = false;

    if (readerRef.current) {
      try {
        await readerRef.current.cancel(); 
      } catch (err) {
        console.warn("Reader cancel error (safe to ignore):", err);
      }
    }
  };

  return { isConnected, connect, disconnectHardware, error };
};