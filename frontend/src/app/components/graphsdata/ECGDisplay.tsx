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

import { getRhythmData, type RhythmType } from "./ECGRhythms";
import { useWebSocket } from "../../context/WebSocketContext";

interface ECGDisplayProps {
  width?: number;
  height?: number;
  rhythmType?: RhythmType;
  showSynchroArrows?: boolean;
  heartRate?: number;
  durationSeconds?: number;
  isDottedAsystole?: boolean;
  isPacing?: boolean;
  pacerFrequency?: number;
  pacerIntensity?: number;
}

const ECGDisplay: React.FC<ECGDisplayProps> = ({
  width = 800,
  height = 65,
  rhythmType = "sinus",
  showSynchroArrows = false,
  heartRate = 70,
  durationSeconds = 7,
  isDottedAsystole = false,
  isPacing = false,
  pacerFrequency = 70,
  pacerIntensity = 30,
}) => {
  // Added lastMessage to catch the live hardware chunks
  const { getInterpolatedTime, lastMessage } = useWebSocket();
  const chartRef = useRef<ChartJS<"line">>(null);
  const animationRef = useRef<number>(0);

  const dataRef = useRef<number[]>([]);
  const peakCandidateIndicesRef = useRef<Set<number>>(new Set());
  const pacingSpikeIndicesRef = useRef<Set<number>>(new Set());
  const normalizationRef = useRef({ min: 0, max: 1 });
  const lastScanXRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const displayDataRef = useRef<(number | null)[]>(new Array(width).fill(null));

  // Track if we are in Live Hardware mode
  const isLiveHardwareRef = useRef<boolean>(false);

  const propsRef = useRef({ showSynchroArrows, durationSeconds, rhythmType, heartRate, isDottedAsystole, isPacing, pacerFrequency, pacerIntensity });
  useEffect(() => {
    propsRef.current = { showSynchroArrows, durationSeconds, rhythmType, heartRate, isDottedAsystole, isPacing, pacerFrequency, pacerIntensity };
  });

  const liveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Wrap the JSON loading in a useCallback so it is triggerable on demand
  const loadJsonData = React.useCallback(() => {
    const { rhythmType, heartRate, isPacing, pacerFrequency, pacerIntensity } = propsRef.current;
    const SAMPLING_RATE = 250;
    const CAPTURE_THRESHOLD = 90;

    let newBuffer: number[];
    let newPeaks: number[] = [];
    const newPeakCandidates = new Set<number>();
    const newPacingSpikes = new Set<number>();

    if (isPacing) {
      if (pacerIntensity >= CAPTURE_THRESHOLD) {
        const rhythm = getRhythmData('electroEntrainement', pacerFrequency);
        newBuffer = rhythm.data;
        newPeaks = rhythm.peaks;
        for (let i = 1; i < newBuffer.length; i++) {
          if (newBuffer[i] - newBuffer[i - 1] >= 0.4) newPacingSpikes.add(i);
        }
      } else {
        const rhythm = getRhythmData('bav3', heartRate);
        newBuffer = rhythm.data;
        newPeaks = rhythm.peaks;

        const spikeIntervalSamples = (60 / pacerFrequency) * SAMPLING_RATE;
        const totalSamples = newBuffer.length;
        const numSpikes = Math.floor(totalSamples / spikeIntervalSamples);

        for (let n = 1; n <= numSpikes; n++) {
          const spikeIndex = Math.floor(n * spikeIntervalSamples);
          if (spikeIndex < totalSamples) newPacingSpikes.add(spikeIndex);
        }
      }
    } else {
      const rhythm = getRhythmData(rhythmType, heartRate);
      newBuffer = rhythm.data;
      newPeaks = rhythm.peaks;
    }

    newPeaks.forEach(p => newPeakCandidates.add(p));

    dataRef.current = newBuffer;
    peakCandidateIndicesRef.current = newPeakCandidates;
    pacingSpikeIndicesRef.current = newPacingSpikes;
    normalizationRef.current = {
      min: Math.min(...newBuffer),
      max: Math.max(...newBuffer),
    };
  }, []);

  // --- DATA LOADING (JSON) ---
  useEffect(() => {
    if (isLiveHardwareRef.current) return;
    loadJsonData();
  }, [rhythmType, heartRate, isPacing, pacerFrequency, pacerIntensity, loadJsonData]);

  // --- LIVE HARDWARE LISTENER ---
  useEffect(() => {
    if (!lastMessage) return;
    const msg = lastMessage as any;

    if (msg.type === "live_hardware" && msg.sensor === "ecg") {
      const SAMPLING_RATE = 250;
      const bufferLength = propsRef.current.durationSeconds * SAMPLING_RATE;

      if (!isLiveHardwareRef.current) {
        isLiveHardwareRef.current = true;
        dataRef.current = new Array(bufferLength).fill(0);
      }

      const currentServerTime = getInterpolatedTime();
      let startIndex = Math.floor(currentServerTime * SAMPLING_RATE) % bufferLength;

      const chunk = msg.data as number[];
      for (let i = 0; i < chunk.length; i++) {
        dataRef.current[(startIndex + i) % bufferLength] = chunk[i];
      }

      normalizationRef.current = { min: -0.5, max: 1.5 };

      // Dead Man's Switch (Signal Loss Timeout)
      if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
      
      liveTimeoutRef.current = setTimeout(() => {
        console.log("Signal hardware perdu ! Retour à la simulation JSON.");
        isLiveHardwareRef.current = false;
        loadJsonData(); // Instantly reloads the JSON array into the Canvas buffer
      }, 500); // If 500ms pass without a new chunk, assume it was disconnected
    }
  }, [lastMessage, getInterpolatedTime, loadJsonData]);

  // --- ECG PLUGIN ---
  const ecgPluginRef = useRef<Plugin<"line">>({
    id: "ecgGrid",

    beforeDraw(chart) { // Dessine la grille ECG avant le tracé des données (remplace anciennement drawGridColumn)
      const { ctx, width: w, height: h } = chart;

      ctx.save();
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, w, h);

      const { durationSeconds } = propsRef.current;
      const pixelsPerSecond = w / durationSeconds;
      const timeStep = pixelsPerSecond / 5;

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
    afterDatasetDraw(chart) {
      const { ctx, chartArea } = chart;
      const data = dataRef.current;
      if (!data.length) return;

      const { showSynchroArrows, durationSeconds } = propsRef.current;
      const samplesPerPixel = (durationSeconds * 250) / chart.width;
      const isLive = isLiveHardwareRef.current;
      const displayData = chart.data.datasets[0].data as (number | null)[];

      ctx.save();
      for (let xi = 0; xi < chart.width; xi++) {
        if (displayData[xi] === null) continue;

        const sampleIndex = Math.floor(xi * samplesPerPixel) % data.length;
        const checkWindow = Math.ceil(samplesPerPixel);

        if (!isLive && showSynchroArrows) {
          for (let i = 0; i < checkWindow; i++) {
            if (peakCandidateIndicesRef.current.has((sampleIndex + i) % data.length)) {
              ctx.fillStyle = '#FFFFFF';
              ctx.strokeStyle = "#FFFFFF";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(xi, chartArea.top);
              ctx.lineTo(xi, chartArea.top + 10);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(xi, chartArea.top + 15);
              ctx.lineTo(xi - 4, chartArea.top + 10);
              ctx.lineTo(xi + 4, chartArea.top + 10);
              ctx.closePath();
              ctx.fill();
              break;
            }
          }
        }

        if (!isLive && pacingSpikeIndicesRef.current.has(sampleIndex)) {
          ctx.strokeStyle = "white";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(xi, chartArea.top);
          ctx.lineTo(xi, chartArea.bottom);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  });

  // --- DRAWING LOOP ---
  useEffect(() => {
    // Réinitialise le tableau d'affichage si width change
    displayDataRef.current = new Array(width).fill(null);
    lastScanXRef.current = 0;
    startTimeRef.current = null;

    // getNormalizedY reste identique - retourne des coordonnées en px (0..height)
    const getNormalizedY = (value: number): number => {
      const { min, max } = normalizationRef.current;
      const range = max - min === 0 ? 1 : max - min;
      const topMargin = height * 0.3;
      const bottomMargin = height * 0.1;
      const traceHeight = height - topMargin - bottomMargin;
      const normalizedValue = (value - min) / range;
      const canvasCenter = topMargin + traceHeight / 2;
      const { rhythmType, isPacing } = propsRef.current;

      if (!isLiveHardwareRef.current && (rhythmType === "electroEntrainement" || rhythmType === "choc" || isPacing)) {
        const gain = 40;
        return (canvasCenter - value * gain) / 0.6;
      } else {
        return topMargin + (1 - normalizedValue) * traceHeight;
      }
    };

    const drawFrame = () => {
      const chart = chartRef.current;
      if (!chart) { animationRef.current = requestAnimationFrame(drawFrame); return; }

      const serverTime = getInterpolatedTime();
      const data = dataRef.current;
      if (data.length == 0 || serverTime === 0) {
        animationRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      const { durationSeconds, isDottedAsystole } = propsRef.current;
      const pixelsPerSecond = width / durationSeconds;
      const samplesPerPixel = (durationSeconds * 250) / width;

      if (startTimeRef.current === null) {
        startTimeRef.current = serverTime;
      }
      const elapsed = serverTime - startTimeRef.current;
      const absoluteOffset = startTimeRef.current * pixelsPerSecond;
      const totalPixelsPassed = elapsed * pixelsPerSecond;

      let startX = lastScanXRef.current;
      let endX = totalPixelsPassed;
      if (endX - startX > width) startX = endX - width;

      // Mutation directe du tableau interne de Chart.js (pas de re-render React)
      const displayData = chart.data.datasets[0].data as (number | null)[];

      for (let p = Math.floor(startX); p < Math.floor(endX); p++) {
        const x = p % width;
        const absoluteP = p + absoluteOffset;
        const sampleIndex = Math.floor(absoluteP * samplesPerPixel) % data.length;

        // Zone de clearing (3px devant le curseur)
        const barX = (x + 2) % width;
        for (let i = 0; i < 3; i++) { displayData[(barX + i) % width] = null; }

        if (isDottedAsystole) {
          displayData[x] = x % 4 === 0 ? height / 2 : null;
        } else {
          displayData[x] = getNormalizedY(data[sampleIndex]);
        }
      }
      
      lastScanXRef.current = totalPixelsPassed;
      chart.update('none'); // Redesine sans animation ni recalcul de layout
      animationRef.current = requestAnimationFrame(drawFrame);
    };
    
    animationRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(animationRef.current);
  }, [width, height, getInterpolatedTime, rhythmType, isPacing, isDottedAsystole]);

  // Labels : indices 0..width-1 (une entrée = une colonne de pixels)
  const labels = useMemo(() => Array.from({length: width}, (_, i) => i), [width]);

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
        max: height,
        reverse: true, // Y=0 en haut, comme le système de coordonnées canvas
        grid: { display: false },
        border: { display: false },
      },
    },
    layout: { padding: 0 },
  };

  return (
    <div 
      className="bg-black rounded mx-auto"
      style = {{
        width: '100%',
        height: `${height}px`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
      }}
    >      
      <Line 
        ref={chartRef}
        data={{
          labels,
          datasets: [{
            data: displayDataRef.current,
            borderColor: "#00ff00",
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
            spanGaps: false,
          }],
        }}
        options={chartOptions}
        plugins={[ecgPluginRef.current]}
      />
    </div>
  );
};

export default ECGDisplay;