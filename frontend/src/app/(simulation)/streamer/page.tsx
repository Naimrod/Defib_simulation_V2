'use client';

import { useState, useRef, useCallback } from 'react';
import { useWebSocket } from '../../context/WebSocketContext';

// -- Constantes du protocole binaire --
const MESSAGE_LENGTH = 5;
const START_BYTE = 0xC0;
const LEAD_STATUS_OFF = 0x01;

// -- Normalisation : convertit les valeurs brutes du Pico --
// Le Pico envoie des entiers qui peuvent aller jusqu'à 70000, baselin ~33000
// ECGDisplay.tsx attend des floats centrés autour de 0
// (même format que le mock de HardwareConnector.tsx)
function normalize(raw: number): number {
    return (raw - 33000) / 32760;
}

export default function StreamerPage() {
    // Ce qui va s'afficher -> useState
    const [isConnected, setIsConnected] = useState(false);
    const [leadVisible, setLeadVisible] = useState(true);
    const [leadOn, setLeadOn] = useState(false);
    const [status, setStatus] = useState('Statut : Déconnecté');

    // Ce qui ne s'affiche pas -> useRef
    const portRef = useRef<any>(null);
    const readerRef = useRef<any>(null);
    const byteBufferRef = useRef<number[]>([]);  // accumule les octets bruts
    const batchRef = useRef<number[]>([]);       // accumule les floats à envoyer

    // sendMessage vient du WebSocketContext déjà fourni par le layout
    const { sendMessage } = useWebSocket();

    const Lead_status = () => {
        const buf = byteBufferRef.current;

        while (buf.length >= MESSAGE_LENGTH) {
            if (buf[0] !== START_BYTE) { buf.shift(); continue; }

            // Lookahead check to ensure the next byte at packet boundary is also START_BYTE
            if (buf.length >= MESSAGE_LENGTH + 1) {
                if (buf[MESSAGE_LENGTH] !== START_BYTE) {
                    buf.shift();
                    continue;
                }
            } else {
                break; // Wait for more data to confirm alignment
            }

            const statusByte = buf[1];
            buf.splice(0, MESSAGE_LENGTH);

            const isLeadOn = (statusByte !== LEAD_STATUS_OFF);
            setLeadOn(prev => prev !== isLeadOn ? isLeadOn : prev);
        }
    };

    // Connexion Série
    const connectSerial = useCallback(async () => {
        if (!('serial' in navigator)) {
            alert('Web Serial non supporté - utilisez Chrome, Edge ou Opera');
            return;
        }
        try {
            const port = await (navigator as any).serial.requestPort();
            await port.open({ baudRate: 115200});
            portRef.current = port;
            
            setIsConnected(true);
            setLeadVisible(true);
            setStatus('Statut : Connecté ✅');

            // Lecture binaire brute (pas de TextDecoder comme dans useWebSerial.ts)
            const reader = port.readable.getReader();
            readerRef.current = reader;

            while(true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    sendMessage({
                        type: 'live_hardware',
                        sensor: 'ecg',
                        data: Array.from(value),
                    });
                    for (const byte of value) byteBufferRef.current.push(byte);
                    Lead_status();
                }
            }
        } catch (err: any) {
            if (err.name !== 'NotFoundError') {
                setStatus('Erreur : ' + err.message);
            }
        }
    }, [])

    // Déconnexion
    const disconnectSerial = useCallback(async () => {
        try {
            if (readerRef.current) { await readerRef.current.cancel(); readerRef.current = null; }
            if (portRef.current) {await portRef.current.close(); portRef.current = null; }
        } catch (e) { console.warn(e); }

        byteBufferRef.current = [];
        batchRef.current = [];
        setIsConnected(false);
        setLeadVisible(false);
        setStatus('Statut : Déconnecté');
    }, [])

    // Rendu
    return (
        <div
        className="bg-black text-white min-h-screen p-6 flex flex-col"
        style={{ fontFamily: "'Courier New', monospace" }}
        >
        <header className="flex items-center justify-between mb-5">
            <h1
            className="text-3xl tracking-wider"
            style={{ color: '#00ff88', fontWeight: 'normal' }}
            >
            ECG — Signal brut : Streamer
            </h1>

            <div className="flex items-center gap-3">
            {leadVisible && (
                <span
                className="text-lg font-bold px-2 py-1 rounded tracking-widest"
                style={leadOn
                    ? { background: '#00ff88', color: '#1e1e1e' }
                    : { background: '#ff4444', color: '#fff' }
                }
                >
                {leadOn ? 'LEAD ON' : 'LEAD OFF'}
                </span>
            )}

            <button
                onClick={isConnected ? disconnectSerial : connectSerial}
                style={{
                fontFamily:     'inherit',
                fontSize:       '1.25rem',
                padding:        '7px 16px',
                background:     'transparent',
                border:         `1px solid ${isConnected ? '#ff4444' : '#00ff88'}`,
                color:          isConnected ? '#ff4444' : '#00ff88',
                borderRadius:   '3px',
                cursor:         'pointer',
                letterSpacing:  '0.06em',
                transition:     'background 0.15s',
                }}
            >
                {isConnected ? 'SE DÉCONNECTER' : 'SE CONNECTER'}
            </button>
            </div>
        </header>

        <div className="text-lg tracking-wide">{status}</div>
        </div>
    );
}