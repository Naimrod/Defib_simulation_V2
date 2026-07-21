'use client';

import { useState, useRef, useCallback } from 'react';
import { useWebSocket } from '../../context/WebSocketContext';
import PageHeader from '../../components/PageHeader';

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
    const batchRef = useRef<Uint8Array[]>([]);       // accumule la liste des chunks Uint8Array reçus
    const nbTrames = 10;                         // nombre de trames

    // sendMessage vient du WebSocketContext déjà fourni par le layout
    const { sendHardwareBytes } = useWebSocket();

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
                    for (const byte of value) byteBufferRef.current.push(byte);
                    Lead_status();

                    batchRef.current.push(value);

                    if (batchRef.current.length >= nbTrames) {
                        // Calcul de la taille totale nécessaire pour fusionner tous les Uint8Array
                        const totalLength = batchRef.current.reduce((acc, arr) => acc + arr.length, 0);
                        const mergedArray = new Uint8Array(totalLength);

                        // Copie de chaque Uint8Array à la suite dans le tableau unifié
                        let offset = 0;
                        for (const arr of batchRef.current) {
                            mergedArray.set(arr, offset);
                            offset += arr.length;
                        }

                        // Envoi du bloc unifié via le WebSocket dédié
                        sendHardwareBytes(mergedArray);

                        // On vide le batch pour les prochaines réceptions
                        batchRef.current = [];
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'NotFoundError') {
                setStatus('Erreur : ' + err.message);
            }
        }
    }, []);

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
    }, []);

    // Rendu
    return (
        <div className="min-h-screen bg-black text-white flex flex-col font-sans">
            <PageHeader 
                title="ECG — Signal brut : Streamer" 
                
            />

            <div className="p-8 max-w-5xl mx-auto w-full flex flex-col gap-6">
                <div className="flex items-center justify-between bg-[#111] px-5 py-3 rounded-lg border border-gray-800">
                    <span className="text-sm font-semibold text-gray-300">{status}</span>
                    <span className="text-xs text-gray-500"> {leadVisible && (
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full tracking-wider uppercase transition-colors ${leadOn ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'
                            }`}>
                            {leadOn ? 'LEAD ON' : 'LEAD OFF'}
                        </span>
                    )}</span>
                    
                       

                        <button
                            onClick={isConnected ? disconnectSerial : connectSerial}
                            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 cursor-pointer shadow-md border ${isConnected
                                    ? 'bg-red-600/20 hover:bg-red-600 text-red-400 border-red-500/40 hover:text-white'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                                }`}
                        >
                            {isConnected ? 'SE DÉCONNECTER' : 'SE CONNECTER'}
                        </button>
                   
                    
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mt-2 flex items-center gap-3 text-amber-300 text-sm font-semibold">
                    <span className="text-lg">⚠️</span>
                    <span>IMPORTANT : Laisser cette page ouverte pendant la durée de la simulation</span>
                </div>
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-8 shadow-xl flex flex-col gap-6 mt-4">
                    <h2 className="text-xl font-bold text-white border-b border-gray-700 pb-3 flex items-center gap-2">
                        <span>📋</span> Instructions d'utilisation
                    </h2>

                    <ol className="flex flex-col gap-4 text-gray-300 text-base leading-relaxed pl-2">
                        <li className="flex items-start gap-3">
                            <span className="bg-emerald-500/20 text-emerald-400 font-bold px-2.5 py-0.5 rounded text-sm mt-0.5">1</span>
                            <span>Brancher votre microcontrôleur USB à votre ordinateur</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="bg-emerald-500/20 text-emerald-400 font-bold px-2.5 py-0.5 rounded text-sm mt-0.5">2</span>
                            <span>Cliquer sur le bouton se connecter en haut à droite de l'écran</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="bg-emerald-500/20 text-emerald-400 font-bold px-2.5 py-0.5 rounded text-sm mt-0.5">3</span>
                            <span>Dans la fenêtre qui est apparue, cliquer sur votre appareil COM, puis sur connexion</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="bg-emerald-500/20 text-emerald-400 font-bold px-2.5 py-0.5 rounded text-sm mt-0.5">4</span>
                            <span>Mettre les patchs de défibrillateur sur le mannequin</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="bg-emerald-500/20 text-emerald-400 font-bold px-2.5 py-0.5 rounded text-sm mt-0.5">5</span>
                            <span>Vérifier sur le scope que le signal est cohérent avec celui du mannequin</span>
                        </li>
                    </ol>

                    
                </div>
            </div>
        </div>
    );
}