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

interface PlethDisplayProps {
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

const PlethDisplay: React.FC<PlethDisplayProps> = ({
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

  const propsRef = useRef({ isDotted, isFlatLine, durationSeconds});
  useEffect(() => {
    propsRef.current = { isDotted, isFlatLine, durationSeconds };
  });

  const normalizationRef = useRef({ min: 0, max: 1 });
  useEffect(() => {
    normalizationRef.current = {
      min: Math.min(...plethWaveform),
      max: Math.max(...plethWaveform),
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
              const value = plethWaveform[sampleIndex % plethWaveform.length];
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
              borderColor: 'yellow',
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
        className="text-xs font-bold text-yellow-400 text-right pr-2"
        style={{ height: '15px', lineHeight: '15px' }}
      >
        <span>Pleth</span>
      </div>
    </div>
  );
};

export default PlethDisplay;
