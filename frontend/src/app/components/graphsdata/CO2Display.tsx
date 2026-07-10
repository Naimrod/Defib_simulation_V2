import React, { useRef, useEffect, useMemo } from "react";
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

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale);

const co2Waveform = [ // VALEUR HARDCODE, A CHANGER
    0.05, 0.11, 0.11, 0.09, 0.15, 0.15, 0.09, 0.12, 0.12, 0.05,
    0.03, 0.03, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.07, 0.07,
    0.06, 0.06, 0.06, 0.01, 0.01, 0.12, 0.5, 2.01, 5.87, 11.89,
    18.52, 25.04, 30.55, 33.63, 34.63, 34.85, 34.95, 35.0, 35.15, 35.23,
    35.38, 35.49, 35.5, 35.52, 35.57, 35.69, 35.79, 35.86, 35.97, 36.05,
    36.06, 36.14, 36.33, 36.43, 36.49, 36.58, 36.64, 36.72, 36.73, 36.84,
    36.88, 36.89, 36.96, 37.11, 37.19, 37.35, 37.49, 37.51, 37.54, 37.68,
    37.71, 37.84, 37.83, 37.92, 37.88, 37.76, 37.1, 34.95, 30.0, 23.26,
    16.08, 9.13, 3.8, 1.12, 0.32, 0.07, 0.05, 0.07, 0.07, 0.08,
    0.06, 0.06, 0.04, 0.04, 0.01, 0.02, 0.02, 0.02, 0.02, 0.01,
    0.0, 0.0, 0.0, 0.02, 0.09, 0.1, 0.11, 0.11, 0.09, 0.02,
    0.01, 0.1, 0.1, 0.11, 0.11, 0.11, 0.06, 0.09, 0.11, 0.11,
    0.16, 0.12, 0.11, 0.18, 0.18, 0.3, 1.11, 3.67, 8.6, 15.06,
    21.71, 27.89, 32.27, 34.32, 34.84, 35.04, 35.14, 35.2, 35.23, 35.38,
    35.41, 35.46, 35.59, 35.69, 35.66, 35.75, 35.84, 35.92, 35.97, 36.11,
    36.21, 36.27, 36.35, 36.39, 36.52, 36.64, 36.66, 36.75, 36.82, 36.85,
    36.95, 37.04, 37.13, 37.26, 37.34, 37.44, 37.54, 37.55, 37.57, 37.58,
    37.58, 37.68, 37.79, 37.91, 37.92, 37.7, 36.48, 33.07, 27.03, 19.88,
    12.58, 6.24, 2.05, 0.5, 0.14, 0.09, 0.05, 0.05, 0.02, 0.03,
    0.04, 0.04, 0.05, 0.07, 0.03, 0.03, 0.03, 0.02, 0.01, 0.01
]

interface Co2DisplayProps {
    width?: number;
    height?: number;
    isDotted?: boolean;
    isFlatLine?: boolean;
    durationSeconds?: number; // Added for consistency with ECGDisplay
    animationState?: {
        getScanX: () => number;
        setScanX: (value: number) => void;
        getSampleIndex: () => number;
        setSampleIndex: (value: number) => void;
        getLastY: () => number | null;
        setLastY: (value: number | null) => void;
    };
}

const Co2Display: React.FC<Co2DisplayProps> = ({
    width = 800,
    height = 80,
    isDotted = false,
    isFlatLine = false,
    durationSeconds = 10,
    animationState,
}) => {
    const chartRef = useRef<ChartJS<"line">>(null);
    const displayDataRef = useRef<(number | null)[]>(new Array(width).fill(null));

    const chartHeight = Math.max(20, height - 15);
    
    const animationRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(performance.now());

    const propsRef = useRef({ isDotted, isFlatLine, durationSeconds });
    useEffect(() => {
        propsRef.current = { isDotted, isFlatLine, durationSeconds };
    });

    const normalizationRef = useRef({ min: 0, max: 1 });
    useEffect(() => {
        normalizationRef.current = {
            min: Math.min(...co2Waveform),
            max: Math.max(...co2Waveform),
        };
    }, []);

    // --- BOUCLE D'ANIMATION ---
    useEffect(() => {
        const SAMPLING_RATE = 50;

        const drawFrame = (currentTime: number) => {
            const chart = chartRef.current;
            if (!chart || !animationState) {
                animationRef.current = requestAnimationFrame(drawFrame);
                return;
            }

            const deltaTime = currentTime - lastTimeRef.current;
            lastTimeRef.current = currentTime;

            const { durationSeconds, isDotted, isFlatLine } = propsRef.current;
            const totalSamplesInView = durationSeconds * SAMPLING_RATE;
            const pixelsPerSecond = width / durationSeconds;
            const samplesPerPixel = totalSamplesInView / width;
            const { min: minValue, max: maxValue } = normalizationRef.current;
            const range = maxValue - minValue || 1;

            const displayData = chart.data.datasets[0].data as (number | null)[];

            const startX = animationState.getScanX();
            const endX = startX + (deltaTime / 1000) * pixelsPerSecond;

            for (let p = Math.floor(startX); p < Math.floor(endX); p++) {
                const x = p % width;
                const sampleIndex = Math.floor(p * samplesPerPixel);

                // Efface un peu devant le curseur de balayage
                const barX = (x + 2) % width;
                for (let j = 0; j < 3; j++) {
                    const clearX = (barX + j) % width;
                    displayData[clearX] = null;
                }

                if (isFlatLine) {
                    displayData[x] = chartHeight / 2;
                } else if (isDotted) {
                    const DASH_PERIOD = 8;
                    const DASH_LENGTH = 2;
                    displayData[x] = (sampleIndex % DASH_PERIOD) < DASH_LENGTH ? chartHeight / 2 : null;
                } else {
                    const value = co2Waveform[sampleIndex % co2Waveform.length];
                    const normalized = (value - minValue) / range;
                    const topMargin = chartHeight * 0.1;
                    const bottomMargin = chartHeight * 0.05;
                    const traceHeight = chartHeight - topMargin - bottomMargin;
                    displayData[x] = topMargin + (1 - normalized) * traceHeight;
                }
            }

            animationState.setScanX(endX);
            chart.update('none');
            animationRef.current = requestAnimationFrame(drawFrame);
        };

        animationRef.current = requestAnimationFrame(drawFrame);
        return () => cancelAnimationFrame(animationRef.current);
    }, [width, chartHeight, animationState])

    // --- PLUGIN GRILLE CO2 ---
    const co2PluginRef = useRef<Plugin<"line">>({
        id: 'co2Grid',
        beforeDraw(chart) {
            const { ctx, width: w, height: h } = chart;
            ctx.save();
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, w, h);

            const { durationSeconds } = propsRef.current;
            const pixelsPerSecond = w / durationSeconds;
            const timeStep = pixelsPerSecond / 5;

            ctx.strokeStyle = '#001122';
            ctx.lineWidth = 0.3;

            for (let x = 0; x < w; x++) {
                if (Math.round(x) % Math.round(timeStep) === 0) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, h);
                    ctx.stroke();
                }
            }
            for (let y = 0; y < h; y += 10) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }
            ctx.restore();
        },
    });

    // Labels : une entrée par colonne de pixel
    const labels = useMemo(() => Array.from({ length: width }, (_, i) => i), [width]);

    const chartOptions: ChartOptions<"line"> = {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
        },
        scales: {
            x: {
                type: "category",
                display: false,
                grid: { display: false },
                border: { display: false },
            },
            y: {
                type: 'linear',
                display: false,
                min: 0,
                max: chartHeight,
                reverse: true,
                grid: { display: false },
                border: { display: false },
            },
        },
        layout: { padding: 0 },
    };

    return (
        <div 
            className="flex flex-col bg-black rounded w-full"
            style={{ height : `${height}px`}}
        >
            <div
                style={{
                    width: '100%',
                    height: `${chartHeight}px`,
                    position: 'relative'
                }}
            >
                <Line 
                    ref={chartRef}
                    data={{
                        labels,
                        datasets: [{
                            data: displayDataRef.current,
                            borderColor: "yellow",
                            borderWidth: 1.5,
                            pointRadius: 0,
                            tension: 0,
                            spanGaps: false
                        }],
                    }}
                    options={chartOptions}
                    plugins={[co2PluginRef.current]}
                />
            </div>
            <div 
                className="text-xs font-bold text-yellow-300 text-right pr-2"
                style={{ height: '15px', lineHeight: '15px' }}
            >
                <span>FRVA</span>
            </div>
        </div>
    );
};

export default Co2Display;