import React, { useRef, useEffect } from "react";
import { getRhythmData, type RhythmType } from "./ECGRhythms";
import { useWebSocket } from "../../context/WebSocketContext";

interface TwoLeadECGDisplayProps {
  width?: number;
  height?: number;
  rhythmType?: RhythmType;
  showSynchroArrows?: boolean;
  heartRate?: number;
  durationSeconds?: number;
  chargeProgress: number;
  shockCount: number;
  energy: string;
  isDottedAsystole?: boolean;
  showDefibrillatorInfo?: boolean;
  showRhythmText?: boolean;
  isPacing?: boolean;
  pacerFrequency?: number;
  pacerIntensity?: number;
}

const TwoLeadECGDisplay: React.FC<TwoLeadECGDisplayProps> = ({
  width = 800,
  height = 65,
  rhythmType = 'sinus',
  showSynchroArrows = false,
  heartRate = 70,
  durationSeconds = 7,
  isPacing = false,
  pacerFrequency = 70,
  pacerIntensity = 30,
  chargeProgress,
  shockCount,
  energy,
  isDottedAsystole = false,
  showDefibrillatorInfo = true,
  showRhythmText = true,
}) => {
  // Added lastMessage to catch hardware chunks
  const { getInterpolatedTime, lastMessage } = useWebSocket();
  const topCanvasRef = useRef<HTMLCanvasElement>(null);
  const bottomCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const dataRef = useRef<number[]>([]);
  const peakCandidateIndicesRef = useRef<Set<number>>(new Set());
  const pacingSpikeIndicesRef = useRef<Set<number>>(new Set());
  const normalizationRef = useRef({ min: 0, max: 1 });
  const scanAccumulatorRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const lastYRefs = useRef<{ top: number | null; bottom: number | null }>({
    top: null,
    bottom: null,
  });

  // Track hardware state
  const isLiveHardwareRef = useRef<boolean>(false);
  const liveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const propsRef = useRef({ showSynchroArrows, durationSeconds, rhythmType, heartRate, isDottedAsystole, isPacing, pacerFrequency, pacerIntensity });
  useEffect(() => {
    propsRef.current = { showSynchroArrows, durationSeconds, rhythmType, heartRate, isDottedAsystole, isPacing, pacerFrequency, pacerIntensity };
  });

  // --- DATA LOADING (JSON) ---
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
      // Multiply by 2 because the Two-Lead display wraps across two full lengths!
      const bufferLength = propsRef.current.durationSeconds * 2 * SAMPLING_RATE; 

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

      if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
      
      liveTimeoutRef.current = setTimeout(() => {
        isLiveHardwareRef.current = false;
        loadJsonData();
      }, 500);
    }
  }, [lastMessage, getInterpolatedTime, loadJsonData]);


  // --- DRAWING LOOP ---
  useEffect(() => {
    const topCanvas = topCanvasRef.current;
    const bottomCanvas = bottomCanvasRef.current;
    if (!topCanvas || !bottomCanvas) return;

    const topCtx = topCanvas.getContext("2d");
    const bottomCtx = bottomCanvas.getContext("2d");
    if (!topCtx || !bottomCtx) return;

    const initialTime = getInterpolatedTime();
    const pixelsPerSecond = width / propsRef.current.durationSeconds;
    scanAccumulatorRef.current = 0;
    lastFrameTimeRef.current = 0;
    lastYRefs.current = { top: null, bottom: null };
    startTimeRef.current = null;

    const getNormalizedY = (value: number) => {
      const { min, max } = normalizationRef.current;
      const range = max - min;
      const topMargin = height * 0.3;
      const bottomMargin = height * 0.1;
      const traceHeight = height - topMargin - bottomMargin;
      const normalizedValue = range === 0 ? 0.5 : (value - min) / range;
      const canvasCenter = topMargin + traceHeight / 2;
      const { rhythmType, isPacing } = propsRef.current;
      
      // Bypasses scaling if in Live Hardware mode
      if (!isLiveHardwareRef.current && (rhythmType === 'electroEntrainement' || rhythmType === 'choc' || isPacing)) {
        const gain = 40;
        return (canvasCenter - (value * gain)) / 0.6;
      } else {
        return topMargin + (1 - normalizedValue) * traceHeight;
      }
    };

    const drawGridColumn = (ctx: CanvasRenderingContext2D, x: number) => {
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

    const drawArrow = (ctx: CanvasRenderingContext2D, x: number) => {
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

    const drawPacingSpike = (ctx: CanvasRenderingContext2D, x: number) => {
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    };

    topCtx.fillStyle = "black";
    topCtx.fillRect(0, 0, width, height);
    bottomCtx.fillStyle = "black";
    bottomCtx.fillRect(0, 0, width, height);
    for (let x = 0; x < width; x++) {
      drawGridColumn(topCtx, x);
      drawGridColumn(bottomCtx, x);
    }

    const drawFrame = () => {
      const serverTime = getInterpolatedTime();
      const data = dataRef.current;
      if (data.length === 0 || serverTime === 0) {
        animationRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      const { showSynchroArrows, durationSeconds } = propsRef.current;
      const samplingRate = 250;
      const pixelsPerSecond = width / durationSeconds;
      const totalTraceLength = width * 2; // Magic number to wrap the second trace

      if (startTimeRef.current === null) {
        startTimeRef.current = serverTime;
      }
      const elapsed = serverTime - startTimeRef.current;
      const absoluteOffset = startTimeRef.current * pixelsPerSecond;
      const totalPixelsPassed = elapsed * pixelsPerSecond;

      let startX = scanAccumulatorRef.current;
      let endX = totalPixelsPassed;

      if (endX - startX > totalTraceLength) {
        startX = endX - totalTraceLength;
      }

      const samplesPerPixel = (durationSeconds * samplingRate) / width;

      for (let p = Math.floor(startX); p < Math.floor(endX); p++) {
        const pixelOnTape = p % totalTraceLength;
        const isTopTrace = pixelOnTape < width;

        const activeCtx = isTopTrace ? topCtx : bottomCtx;
        const x = isTopTrace ? pixelOnTape : pixelOnTape - width;

        const absoluteP = p + absoluteOffset;
        const sampleIndex = Math.floor(absoluteP * samplesPerPixel) % data.length;

        const barX = (x + 2) % width;
        activeCtx.fillStyle = "black";
        activeCtx.fillRect(barX, 0, 3, height);
        drawGridColumn(activeCtx, barX);

        const { isDottedAsystole } = propsRef.current;

        if (isDottedAsystole) {
          const centerY = height / 2;
          if (x % 4 === 0) {
            activeCtx.fillStyle = "#00ff00";
            activeCtx.fillRect(x, centerY - 1, 2, 2);
          }
          if (isTopTrace) {
            lastYRefs.current.top = centerY;
          } else {
            lastYRefs.current.bottom = centerY;
          }
        } else {
          const value = data[sampleIndex];
          const currentY = getNormalizedY(value);
          activeCtx.strokeStyle = "#00ff00";
          activeCtx.lineWidth = 2;
          activeCtx.beginPath();

          const lastY = isTopTrace ? lastYRefs.current.top : lastYRefs.current.bottom;
          if (lastY !== null && x > 0 && (p - 1) % totalTraceLength === (pixelOnTape - 1)) {
            activeCtx.moveTo(x - 1, lastY);
            activeCtx.lineTo(x, currentY);
          } else {
            activeCtx.moveTo(x, currentY);
            activeCtx.lineTo(x, currentY);
          }
          activeCtx.stroke();

          if (isTopTrace) {
            lastYRefs.current.top = currentY;
          } else {
            lastYRefs.current.bottom = currentY;
          }
        }

        const checkWindow = Math.ceil(samplesPerPixel);

        // Hide fake arrows/spikes when using real hardware (will be shown by hardware?)
        if (!isLiveHardwareRef.current && showSynchroArrows) {
          let arrowFound = false;
          for (let i = 0; i < checkWindow; i++) {
            if (peakCandidateIndicesRef.current.has((sampleIndex + i) % data.length)) {
              arrowFound = true;
              break;
            }
          }
          if (arrowFound) {
            drawArrow(activeCtx, x);
          }
        }

        if (!isLiveHardwareRef.current) {
          let spikeFound = false;
          for (let i = 0; i < checkWindow; i++) {
            if (pacingSpikeIndicesRef.current.has((sampleIndex + i) % data.length)) {
              spikeFound = true;
              break;
            }
          }
          if (spikeFound) {
            drawPacingSpike(activeCtx, x);
          }
        }
      }

      scanAccumulatorRef.current = totalPixelsPassed;
      animationRef.current = requestAnimationFrame(drawFrame);
    };

    animationRef.current = requestAnimationFrame(drawFrame);

    return () => cancelAnimationFrame(animationRef.current);
  }, [width, height, getInterpolatedTime, rhythmType, isPacing, isDottedAsystole]);

  return (
    <div className="flex-grow flex flex-col bg-black">
      <div className="w-full">
        <canvas
          ref={topCanvasRef}
          width={width}
          height={height}
          className="w-full"
          style={{ imageRendering: "pixelated", height: `${height}px` }}
        />
      </div>
      <div className="w-full px-4 py-2">
        {showDefibrillatorInfo && showRhythmText && (
          <div className="w-full text-xs font-bold text-green-400 text-right">
            <span>
              {rhythmType === "fibrillationVentriculaire"
                ? "Fibrillation ventriculaire"
                : rhythmType === "asystole"
                  ? "Asystolie"
                  : "Rythme sinusal"}
            </span>
          </div>
        )}
        {showDefibrillatorInfo && (
          <div className="w-full flex justify-start items-center gap-4 text-xs font-bold text-white">
            <div className="text-left">
              <span>RCP :</span>
            </div>
            <div className="w-24 h-3 bg-gray-600 rounded">
              <div
                className={`h-full bg-red-500 rounded transition-all duration-100 ${chargeProgress === 100 ? "animate-pulse" : ""
                  }`}
                style={{ width: `${chargeProgress}%` }}
              />
            </div>
            <div className="text-center ml-auto">
              <span>Chocs : {shockCount}</span>
            </div>
            <div className="text-right ml-auto">
              <span>Energie sélectionnée : {energy} joules</span>
            </div>
          </div>
        )}
      </div>
      <div className="w-full">
        <canvas
          ref={bottomCanvasRef}
          width={width}
          height={height}
          className="w-full"
          style={{ imageRendering: "pixelated", height: `${height}px` }}
        />
      </div>
    </div>
  );
};

export default TwoLeadECGDisplay;