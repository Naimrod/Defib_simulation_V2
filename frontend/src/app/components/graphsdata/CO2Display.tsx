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
import { LCG, generateRampedNoise, createSeamlessLoop } from './ECGRhythms';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale);

const CO2_MOTIF = [ // un seul cycle de co2
    2.01, 5.87, 11.89, 18.52, 25.04, 30.55, 33.63, 34.63, 34.85, 34.95, 
    35.0, 35.15, 35.23, 35.38, 35.49, 35.5, 35.52, 35.57, 35.69, 35.79, 
    35.86, 35.97, 36.05, 36.06, 36.14, 36.33, 36.43, 36.49, 36.58, 36.64, 
    36.72, 36.73, 36.84, 36.88, 36.89, 36.96, 37.11, 37.19, 37.35, 37.49, 
    37.51, 37.54, 37.68, 37.71, 37.84, 37.83, 37.92, 37.88, 37.76, 37.1, 
    34.95, 30.0, 23.26, 16.08, 9.13, 3.8, 1.12,
]

// Rééchantillonne un motif vers une longueur cible (agrandit ou compresse)
const resampleMotif = (motif: number[], newLength: number): number[] => {
  if (newLength === motif.length) return motif;
  const result: number[] = [];
  for (let i = 0; i < newLength; i++) {
    const srcIndex = (i / (newLength - 1)) * (motif.length - 1);
    const lower = Math.floor(srcIndex);
    const upper = Math.min(motif.length - 1, lower + 1);
    const frac = srcIndex - lower;
    result.push(motif[lower] * (1 - frac) + motif[upper] * frac);
  }
  return result;
};

const CO2_MOTIF_DURATION_SECONDS = 0.9;
const CO2_DISPLAY_RATE_MULTIPLIER = 2;

const generateDynamicCO2 = (
  respiRate: number,
  durationSeconds: number,
  samplingRate: number,
  lcg: LCG,
): number[] => {
  const totalSamples = durationSeconds * samplingRate;
  const baseline = CO2_MOTIF[CO2_MOTIF.length - 1];
  const buffer = new Array(totalSamples).fill(baseline);
  if (respiRate <= 0) return buffer;

  const baseMotifLength = Math.max(4, Math.round(CO2_MOTIF_DURATION_SECONDS * samplingRate));
  const scaledMotif = resampleMotif(CO2_MOTIF, baseMotifLength);

  let currentIndex = 0;
  let lastEndValue = baseline;

  while (currentIndex < totalSamples) {
    const intervalSeconds = 60 / (respiRate * CO2_DISPLAY_RATE_MULTIPLIER);
    const variation = (lcg.next() - 0.5) * 0.06;
    const intervalSamples = Math.round(intervalSeconds * (1 + variation) * samplingRate);
    if (!isFinite(intervalSamples) || intervalSamples <= 0) { currentIndex++; continue; }

    const motif = intervalSamples < scaledMotif.length
      ? resampleMotif(scaledMotif, Math.max(4, intervalSamples))
      : scaledMotif;

    const paddingLength = intervalSamples - motif.length;
    if (paddingLength > 0) {
      const padding = generateRampedNoise(paddingLength, 0.01, lastEndValue, motif[0], lcg);
      for (let i = 0; i < paddingLength; i++) {
        const idx = currentIndex + i;
        if (idx < totalSamples) buffer[idx] = padding[i];
      }
    }

    const motifStart = currentIndex + Math.max(0, paddingLength);
    for (let i = 0; i < motif.length; i++) {
      if (motifStart + i < totalSamples) buffer[motifStart + i] = motif[i];
    }

    lastEndValue = motif[motif.length - 1];
    currentIndex += intervalSamples;
  }
  return buffer;
};

interface Co2DisplayProps {
    width?: number;
    height?: number;
    isDotted?: boolean;
    isFlatLine?: boolean;
    durationSeconds?: number; // Added for consistency with ECGDisplay
    respirationRate?: number;
    co2?: number | null;
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
    respirationRate = 15,
    co2 = 40,
    animationState,
}) => {
    const chartRef = useRef<ChartJS<"line">>(null);
    const displayDataRef = useRef<(number | null)[]>(new Array(width).fill(null));
    const dataRef = useRef<number[]>([]);

    const chartHeight = Math.max(20, height - 15);
    
    const animationRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(performance.now());

    const propsRef = useRef({ isDotted, isFlatLine, durationSeconds });
    useEffect(() => {
        propsRef.current = { isDotted, isFlatLine, durationSeconds };
    });

    const normalizationRef = useRef({ min: 0, max: 1 });
    useEffect(() => {
        const SAMPLING_RATE = 60;
        const lcg = new LCG(42);
        const buffer = createSeamlessLoop(
            generateDynamicCO2(respirationRate, durationSeconds, SAMPLING_RATE, lcg),
            150,
            SAMPLING_RATE,
        );
        dataRef.current = buffer;
        normalizationRef.current = {
            min: Math.min(...buffer),
            max: Math.max(...buffer),
        };
    }, [respirationRate, durationSeconds]);

    // --- BOUCLE D'ANIMATION ---
    useEffect(() => {
        const drawFrame = (currentTime: number) => {
            const chart = chartRef.current;
            if (!chart || !animationState) {
                animationRef.current = requestAnimationFrame(drawFrame);
                return;
            }

            const deltaTime = currentTime - lastTimeRef.current;
            lastTimeRef.current = currentTime;

            const { durationSeconds, isDotted, isFlatLine } = propsRef.current;
            const buffer = dataRef.current;
            const pixelsPerSecond = width / durationSeconds;
            const samplesPerPixel = buffer.length / width;
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
                    const value = buffer.length > 0 ? buffer[sampleIndex % buffer.length] : 0;
                    const normalized = (value - minValue) / range;
                    const topMargin = chartHeight * 0.1;
                    const bottomMargin = chartHeight * 0.05;
                    const traceHeight = chartHeight - topMargin - bottomMargin;
                    const data = topMargin + (1 - normalized) * traceHeight;
                    if (co2) {
                        displayData[x] = data * (co2/52) + (chartHeight-1) * (1 - (co2/52));
                    } else { displayData[x] = data; }
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
                            borderColor: "white",
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
                className="text-xs font-bold text-white-300 text-right pr-2"
                style={{ height: '15px', lineHeight: '15px' }}
            >
                <span>FRVA</span>
            </div>
        </div>
    );
};

export default Co2Display;