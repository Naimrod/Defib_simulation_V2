import React, { useRef, useEffect } from "react";
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const dataRef = useRef<number[]>([]);
  const peakCandidateIndicesRef = useRef<Set<number>>(new Set());
  const pacingSpikeIndicesRef = useRef<Set<number>>(new Set());
  const normalizationRef = useRef({ min: 0, max: 1 });
  const lastScanXRef = useRef<number>(0);
  const lastYRef = useRef<number | null>(null);

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

  // --- DRAWING LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    lastScanXRef.current = 0;
    lastYRef.current = null;

    const getNormalizedY = (value: number) => {
      const { min, max } = normalizationRef.current;
      const range = max - min === 0 ? 1 : max - min;
      const topMargin = height * 0.3;
      const bottomMargin = height * 0.1;
      const traceHeight = height - topMargin - bottomMargin;
      const normalizedValue = (value - min) / range;
      const canvasCenter = topMargin + traceHeight / 2;
      const { rhythmType, isPacing } = propsRef.current;
      
      // Bypasses the special simulation scaling if drawing raw hardware data
      if (!isLiveHardwareRef.current && (rhythmType === 'electroEntrainement' || rhythmType === 'choc' || isPacing)) {
        const gain = 40;
        return (canvasCenter - (value * gain)) / 0.6;
      } else {
        return topMargin + (1 - normalizedValue) * traceHeight;
      }
    };

    const drawGridColumn = (x: number) => {
      const pixelsPerSecond = width / propsRef.current.durationSeconds;
      ctx.strokeStyle = "#002200";
      ctx.lineWidth = 0.5;
      const timeStep = pixelsPerSecond / 5;
      if (x > 0 && Math.round(x) % Math.round(timeStep) === 0) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 10) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 1, y);
        ctx.stroke();
      }
    };

    const drawArrow = (x: number) => {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, 15);
      ctx.lineTo(x - 4, 10);
      ctx.lineTo(x + 4, 10);
      ctx.closePath();
      ctx.fill();
    };

    const drawPacingSpike = (x: number) => {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    };

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);
    for (let x = 0; x < width; x++) {
      drawGridColumn(x);
    }

    const drawFrame = () => {
      const serverTime = getInterpolatedTime();
      const data = dataRef.current;
      if (data.length === 0 || serverTime === 0) {
        animationRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      const { durationSeconds, showSynchroArrows } = propsRef.current;
      const samplingRate = 250;
      const pixelsPerSecond = width / durationSeconds;
      
      const totalPixelsPassed = serverTime * pixelsPerSecond;
      
      let startX = lastScanXRef.current;
      let endX = totalPixelsPassed;

      if (endX - startX > width) {
        startX = endX - width;
      }

      const samplesPerPixel = (durationSeconds * samplingRate) / width;

      for (let p = Math.floor(startX); p < Math.floor(endX); p++) {
        const x = p % width;
        const sampleIndex = Math.floor(p * samplesPerPixel) % data.length;

        // Clear ahead
        const barX = (x + 2) % width;
        ctx.fillStyle = 'black';
        ctx.fillRect(barX, 0, 3, height);
        drawGridColumn(barX);

        const { isDottedAsystole } = propsRef.current;

        if (isDottedAsystole) {
          const centerY = height / 2;
          if (x % 4 === 0) {
            ctx.fillStyle = "#00ff00";
            ctx.fillRect(x, centerY - 1, 2, 2);
          }
          lastYRef.current = centerY;
        } else {
          const value = data[sampleIndex];
          const currentY = getNormalizedY(value);
          ctx.strokeStyle = "#00ff00";
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (lastYRef.current !== null && x !== 0) {
            ctx.moveTo(x - 1, lastYRef.current);
            ctx.lineTo(x, currentY);
          } else {
            ctx.moveTo(x, currentY);
            ctx.lineTo(x, currentY);
          }
          ctx.stroke();
          lastYRef.current = currentY;
        }

        const checkWindow = Math.ceil(samplesPerPixel);

        if (!isLiveHardwareRef.current && showSynchroArrows) {
          let arrowFound = false;
          for (let i = 0; i < checkWindow; i++) {
            if (peakCandidateIndicesRef.current.has((sampleIndex + i) % data.length)) {
              arrowFound = true;
              break;
            }
          }
          if (arrowFound) drawArrow(x);
        }

        if (!isLiveHardwareRef.current && pacingSpikeIndicesRef.current.has(sampleIndex)) {
            drawPacingSpike(x);
        }
      }

      lastScanXRef.current = totalPixelsPassed;
      animationRef.current = requestAnimationFrame(drawFrame);
    };

    animationRef.current = requestAnimationFrame(drawFrame);

    return () => cancelAnimationFrame(animationRef.current);
  }, [width, height, getInterpolatedTime]);

  return (
    <div className="flex flex-col bg-black rounded w-full">
      <div>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full"
          style={{ imageRendering: "auto", height: height }}
        />
      </div>
    </div>
  );
};

export default ECGDisplay;