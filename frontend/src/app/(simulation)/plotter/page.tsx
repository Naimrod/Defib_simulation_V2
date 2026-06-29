'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    Chart as ChartJS,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    type Plugin,
    type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";

import { useWebSocket } from '../../context/WebSocketContext';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale);

const SAMPLING_RATE = 200;
const MAX_SAMPLES = 666; // 1500 samples for 6 seconds at 250Hz
const MESSAGE_LENGTH = 5;
const START_BYTE = 0xC0;
const LEAD_STATUS_OFF = 0x01;

export default function PlotterPage() {
    const { lastMessage } = useWebSocket();

    const [leadOn, setLeadOn] = useState(false);
    const [statusText, setStatusText] = useState('Statut : Déconnecté ❌');

    // références (pour la performance, évite les re-renders)
    const chartRef1 = useRef<ChartJS<"line">>(null);
    const chartRef2 = useRef<ChartJS<"line">>(null);

    const displayDataRef1 = useRef<(number | null)[]>(Array(MAX_SAMPLES).fill(null));
    const displayDataRef2 = useRef<(number | null)[]>(Array(MAX_SAMPLES).fill(null));

    // Variables d'état interne
    const byteBuffer = useRef<number[]>([]);
    const indexRef = useRef<number>(0);
    const sampleIndexRef = useRef<number>(0);
    const whichChartRef = useRef<boolean>(true); // true = Chart 1, false = Chart 2
    const renderPendingRef = useRef<boolean>(false);

    // Plugin de fond noir
    const darkBgPlugin = useMemo<Plugin<"line">>(() => ({
        id: 'darkBg',
        beforeDraw(chart) {
            const { ctx, width: w, height: h } = chart;
            ctx.save();
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }
    }), []);

    const pushSample = (ecgRaw: number) => {
        if (indexRef.current >= MAX_SAMPLES) {
            indexRef.current = 0
            whichChartRef.current = !whichChartRef.current
        }

        const currentIndex = indexRef.current;
        const isChart1 = whichChartRef.current;
        const activeChart = isChart1 ? chartRef1.current : chartRef2.current;
        const altChart = isChart1 ? chartRef2.current : chartRef1.current;

        if (!activeChart || !activeChart.data.datasets[0].data) return;

        // Effacement progressif
        const activeData = activeChart.data.datasets[0].data
        const altData = altChart?.data.datasets[0].data

        for (let j=1; j <= 25; j++) {
            const clearIndex = currentIndex + j;
            if (clearIndex < MAX_SAMPLES) { activeData[clearIndex] = null; }
            else if (altData) { altData[clearIndex % MAX_SAMPLES] = null; }
        }

        // Ecriture de la donnée
        if (activeChart.data.labels) {
            activeChart.data.labels[currentIndex] = sampleIndexRef.current;
        }
        activeData[currentIndex] = ecgRaw;

        indexRef.current++;
        sampleIndexRef.current++;
    };

    const parseFrames = () => {
        const buffer = byteBuffer.current;
        while (buffer.length >= MESSAGE_LENGTH) {
            if (buffer[0] !== START_BYTE) {
                buffer.shift(); // désynchronisé, on saute un octet
                continue;
            }

            // Validation par lookahead : s'assurer que l'octet du paquet suivant est également START_BYTE
            if (buffer.length >= MESSAGE_LENGTH + 1) {
                if (buffer[MESSAGE_LENGTH] !== START_BYTE) {
                    buffer.shift(); // Fausse alerte, on saute l'octet actuel
                    continue;
                }
            } else {
                break; // Plus assez de données pour valider le lookahead, on attend le prochain batch
            }

            const statusByte = buffer[1];
            const ecgHigh = buffer[2];
            const ecgLow = buffer[3];
            buffer.splice(0, MESSAGE_LENGTH);

            const isLeadOn = (statusByte !== LEAD_STATUS_OFF);
            setLeadOn(prev => prev !== isLeadOn ? isLeadOn : prev);

            const ecgRaw = isLeadOn ? (ecgHigh << 8) | ecgLow : 33000;
            pushSample(ecgRaw);
        }
    };

    // Traitement des messages
    useEffect(() => {
        if (!lastMessage) return;
        const msg = lastMessage as any;

        if (msg.type === 'live_hardware' && msg.sensor === "ecg") {
            setStatusText(prev => prev !== 'Status : Connecté ✅' ? 'Status : Connecté ✅' : prev);

            const chunk = msg.data;
            //console.log(chunk);
            const bytes: number[] = Array.isArray(chunk)
                ? chunk
                : (typeof chunk === 'object' && chunk ? Object.values(chunk) as number[] : []);

            for (const byte of bytes) { byteBuffer.current.push(byte); }

            parseFrames();

            // Demande de rafraîchissement graphique (limité par le taux de rafraîchissement de l'écran)
            if (!renderPendingRef.current) {
                renderPendingRef.current = true;
                requestAnimationFrame(() => {
                    if (chartRef1.current) chartRef1.current.update('none');
                    if (chartRef2.current) chartRef2.current.update('none');
                    renderPendingRef.current = false;
                });
            }
        }
    }, [lastMessage]);

    const labels = useMemo(() => Array.from({ length: MAX_SAMPLES }, (_, i) => i), []);

    const chartOptions = useMemo<ChartOptions<"line">>(() => ({
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false},
        },
        scales: {
            x: {
                type: "category",
                display: false,
                grid: { display: false },
                border: {display: false },
            },
            y: {
                type: "linear",
                display: false,
                min: -5000,
                max: 70000,
                grid: {display: false},
                border: { display: false },
            },
        },
        layout: { padding: 0 },
    }), []);

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
                    ECG — Signal brut : Plotter
                </h1>

                <div className='flex items-center gap-3'>
                        <span
                        className='text-lg font-bold px-2 py-1 rounded tracking-widest'
                        style={leadOn
                            ? { background: '#00ff88', color: '#1e1e1e' }
                            : { background: '#ff4444', color: '#fff' }
                        }
                        >
                            {leadOn ? 'LEAD ON' : 'LEAD OFF'}
                        </span>
                </div>
            </header>

            <div className="text-lg tracking-wide mb-4">{statusText}</div>
    
            <div className='flex flex-col gap-4 flex-1'>
                <div className='bg-black border border-neutral-900 rounded p-2 w-full h-[35vh]'>
                    <Line 
                        ref={chartRef1}
                        data = {{
                            labels,
                            datasets: [{
                                data: displayDataRef1.current,
                                borderColor: "#00ff88",
                                borderWidth: 0.8,
                                tension: 0,
                                pointRadius: 0,
                                spanGaps: false,
                            }],
                        }}
                        options={chartOptions}
                        plugins={[darkBgPlugin]}
                    />
                </div>
                
                <div className='bg-black border border-neutral-900 rounded p-2 w-full h-[35vh]'>
                    <Line 
                        ref={chartRef2}
                        data = {{
                            labels,
                            datasets: [{
                                data: displayDataRef2.current,
                                borderColor: "#00ff88",
                                borderWidth: 0.8,
                                tension: 0,
                                pointRadius: 0,
                                spanGaps: false,
                            }],
                        }}
                        options={chartOptions}
                        plugins={[darkBgPlugin]}
                    />
                </div>
            </div>
        </div>
    )
}