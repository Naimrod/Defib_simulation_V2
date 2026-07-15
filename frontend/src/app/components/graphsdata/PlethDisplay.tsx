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

const plethWaveform = [
  -0.85, -0.78, -0.60, -0.25, 0.25, 0.75, 0.98, 1.00, 0.78, 0.40, 0.10, -0.12, -0.28, -0.42, -0.52, -0.60, -0.67, -0.72, -0.76, -0.79, -0.82, -0.84, -0.85, -0.86, -0.87, -0.87, -0.88, -0.88, -0.88, -0.88, -0.87, -0.87, -0.86, -0.86,
  -0.85, -0.78, -0.60, -0.25, 0.25, 0.75, 0.98, 1.00, 0.78, 0.40, 0.10, -0.12, -0.28, -0.42, -0.52, -0.60, -0.67, -0.72, -0.76, -0.79, -0.82, -0.84, -0.85, -0.86, -0.87, -0.87, -0.88, -0.88, -0.88, -0.88, -0.87, -0.87, -0.86, -0.86,
  -0.85, -0.78, -0.60, -0.25, 0.25, 0.75, 0.98, 1.00, 0.78, 0.40, 0.10, -0.12, -0.28, -0.42, -0.52, -0.60, -0.67, -0.72, -0.76, -0.79, -0.82, -0.84, -0.85, -0.86, -0.87, -0.87, -0.88, -0.88, -0.88, -0.88, -0.87, -0.87, -0.86, -0.86,
  -0.85, -0.78, -0.60, -0.25, 0.25, 0.75, 0.98, 1.00, 0.78, 0.40, 0.10, -0.12, -0.28, -0.42, -0.52, -0.60, -0.67, -0.72, -0.76, -0.79, -0.82, -0.84, -0.85, -0.86, -0.87, -0.87, -0.88, -0.88, -0.88, -0.88, -0.87, -0.87, -0.86, -0.86,
  -0.85, -0.78, -0.60, -0.25, 0.25, 0.75, 0.98, 1.00, 0.78, 0.40, 0.10, -0.12, -0.28, -0.42, -0.52, -0.60, -0.67, -0.72, -0.76, -0.79, -0.82, -0.84, -0.85, -0.86, -0.87, -0.87, -0.88, -0.88, -0.88, -0.88, -0.87, -0.87, -0.86, -0.86,
  -0.85, -0.78, -0.60, -0.25, 0.25, 0.75, 0.98, 1.00, 0.78, 0.40, 0.10, -0.12, -0.28, -0.42, -0.52, -0.60, -0.67, -0.72, -0.76, -0.79, -0.82, -0.84, -0.85, -0.86, -0.87, -0.87, -0.88, -0.88, -0.88, -0.88, -0.87, -0.87, -0.86, -0.86,
  -0.85, -0.78, -0.60, -0.25, 0.25, 0.75, 0.98, 1.00, 0.78, 0.40, 0.10, -0.12, -0.28, -0.42, -0.52, -0.60, -0.67, -0.72, -0.76, -0.79, -0.82, -0.84, -0.85, -0.86, -0.87, -0.87, -0.88, -0.88, -0.88, -0.88, -0.87, -0.87, -0.86, -0.86,
  -0.85, -0.78, -0.60, -0.25, 0.25, 0.75, 0.98, 1.00, 0.78, 0.40, 0.10, -0.12, -0.28, -0.42, -0.52, -0.60, -0.67, -0.72, -0.76, -0.79, -0.82, -0.84, -0.85, -0.86, -0.87, -0.87, -0.88, -0.88, -0.88, -0.88, -0.87, -0.87, -0.86, -0.86,
  -0.85, -0.78, -0.60, -0.25, 0.25, 0.75, 0.98, 1.00, 0.78, 0.40, 0.10, -0.12, -0.28, -0.42, -0.52, -0.60, -0.67, -0.72, -0.76, -0.79, -0.82, -0.84, -0.85, -0.86, -0.87, -0.87, -0.88, -0.88, -0.88, -0.88, -0.87, -0.87, -0.86, -0.86,
  -0.85, -0.78, -0.60, -0.25, 0.25, 0.75, 0.98, 1.00, 0.78, 0.40, 0.10, -0.12, -0.28, -0.42, -0.52, -0.60, -0.67, -0.72, -0.76, -0.79, -0.82, -0.84, -0.85, -0.86, -0.87, -0.87, -0.88, -0.88, -0.88, -0.88, -0.87, -0.87, -0.86, -0.86,
  -0.85, -0.78, -0.60, -0.25, 0.25, 0.75, 0.98, 1.00, 0.78, 0.40, 0.10, -0.12, -0.28, -0.42, -0.52, -0.60, -0.67, -0.72, -0.76, -0.79, -0.82, -0.84, -0.85, -0.86, -0.87, -0.87, -0.88, -0.88, -0.88, -0.88, -0.87, -0.87, -0.86, -0.86,
  -0.85, -0.78, -0.60, -0.25, 0.25, 0.75, 0.98, 1.00, 0.78, 0.40, 0.10, -0.12, -0.28, -0.42, -0.52, -0.60, -0.67, -0.72, -0.76, -0.79, -0.82, -0.84, -0.85, -0.86, -0.87, -0.87, -0.88, -0.88, -0.88, -0.88, -0.87, -0.87, -0.86, -0.86
];  

// Un seul cycle du pleth (le tableau actuel répète 12x le même motif de 34 échantillons)
const PLETH_MOTIF = plethWaveform.slice(0, 34);

// Compresse le motif si l'intervalle entre pulsations devient plus court que le motif lui-même (pouls rapide)
const resampleMotif = (motif: number[], newLength: number): number[] => {
  if (newLength >= motif.length) return motif;
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

const generateDynamicPleth = (
  pulseRate: number,
  durationSeconds: number,
  samplingRate: number,
  lcg: LCG,
): number[] => {
  const totalSamples = durationSeconds * samplingRate;
  const baseline = PLETH_MOTIF[PLETH_MOTIF.length - 1];
  const buffer = new Array(totalSamples).fill(baseline);
  if (pulseRate <= 0) return buffer;

  let currentIndex = 0;
  let lastEndValue = baseline;

  while (currentIndex < totalSamples) {
    const intervalSeconds = 60 / pulseRate;
    const variation = (lcg.next() - 0.5) * 0.06;
    const intervalSamples = Math.round(intervalSeconds * (1 + variation) * samplingRate);
    if (!isFinite(intervalSamples) || intervalSamples <= 0) { currentIndex++; continue; }

    const motif = intervalSamples < PLETH_MOTIF.length
      ? resampleMotif(PLETH_MOTIF, Math.max(4, intervalSamples))
      : PLETH_MOTIF;

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

interface PlethDisplayProps {
  width?: number;
  height?: number;
  isDotted?: boolean;
  isFlatLine?: boolean;
  durationSeconds?: number; // Added for consistency with ECGDisplay
  heartRate?: number;
  animationState?: {
    getScanX: () => number;
    setScanX: (value: number) => void;
    getSampleIndex: () => number;
    setSampleIndex: (value: number) => void;
    getLastY: () => number | null;
    setLastY: (value: number | null) => void;
  };
}

const PlethDisplay: React.FC<PlethDisplayProps> = ({
  width = 800,
  height = 80,
  isDotted = false,
  isFlatLine = false,
  durationSeconds = 10,
  heartRate = 70,
  animationState,
}) => {
  const chartRef = useRef<ChartJS<"line">>(null);
  const displayDataRef = useRef<(number | null)[]>(new Array(width).fill(null));
  const dataRef = useRef<number[]>([]);

  const chartHeight = Math.max(20, height - 15);

  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());

  const propsRef = useRef({ isDotted, isFlatLine, durationSeconds});
  useEffect(() => {
    propsRef.current = { isDotted, isFlatLine, durationSeconds };
  });

  const normalizationRef = useRef({ min: 0, max: 1 });
  useEffect(() => {
    const SAMPLING_RATE = 50;
    const lcg = new LCG(42);
    const buffer = createSeamlessLoop(
      generateDynamicPleth(heartRate, durationSeconds, SAMPLING_RATE, lcg),
      150,
      SAMPLING_RATE,
    );
    dataRef.current = buffer;
    normalizationRef.current = {
      min: Math.min(...buffer),
      max: Math.max(...buffer),
    };
  }, [heartRate, durationSeconds]);

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
            const buffer = dataRef.current;
            const value = buffer.length > 0 ? buffer[sampleIndex % buffer.length] : 0;
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

  // --- PLUGIN GRILLE PLETH ---
  const plethPluginRef = useRef<Plugin<"line">>({
    id: 'plethGrid',
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
      style={{ height: `${height}px`}}
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
              borderColor: 'cyan',
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0,
              spanGaps: false
            }],
          }}
          options={chartOptions}
          plugins={[plethPluginRef.current]}
        />
      </div>
      <div 
        className="text-xs font-bold text-cyan-400 text-right pr-2"
        style={{ height: '15px', lineHeight: '15px' }}
      >
        <span>Pleth</span>
      </div>
    </div>
  );
};

export default PlethDisplay;
