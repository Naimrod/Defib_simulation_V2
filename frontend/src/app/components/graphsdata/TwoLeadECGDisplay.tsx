import React, { useRef, useEffect } from "react";
import { getRhythmData, type RhythmType } from "./ECGRhythms";

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
  const topCanvasRef = useRef<HTMLCanvasElement>(null);
  const bottomCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const dataRef = useRef<number[]>([]);
  const peakCandidateIndicesRef = useRef<Set<number>>(new Set());
  const pacingSpikeIndicesRef = useRef<Set<number>>(new Set());
  const normalizationRef = useRef({ min: 0, max: 1 });
  const scanAccumulatorRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const lastYRefs = useRef<{ top: number | null; bottom: number | null }>({
    top: null,
    bottom: null,
  });

  const propsRef = useRef({ showSynchroArrows, durationSeconds, rhythmType, heartRate, isDottedAsystole, isPacing, pacerFrequency, pacerIntensity });
  useEffect(() => {
    propsRef.current = { showSynchroArrows, durationSeconds, rhythmType, heartRate, isDottedAsystole, isPacing, pacerFrequency, pacerIntensity };
  });

  // Effect for Data Loading and Peak/Spike Pre-computation.
  useEffect(() => {
    const { rhythmType, heartRate, isPacing, pacerFrequency, pacerIntensity } = propsRef.current;

    const SAMPLING_RATE = 250;
    const CAPTURE_THRESHOLD = 90;

    let newBuffer: number[];
    const newPeakCandidates = new Set<number>();
    const newPacingSpikes = new Set<number>();

    if (isPacing) {
      if (pacerIntensity >= CAPTURE_THRESHOLD) {
        newBuffer = getRhythmData('electroEntrainement', pacerFrequency);
        for (let i = 1; i < newBuffer.length; i++) {
          if (newBuffer[i] - newBuffer[i - 1] >= 0.4) {
            newPacingSpikes.add(i);
          }
        }
      } else {
        newBuffer = getRhythmData('bav3', heartRate);

        const spikeIntervalSamples = (60 / pacerFrequency) * SAMPLING_RATE;
        const totalSamples = newBuffer.length;
        const numSpikes = Math.floor(totalSamples / spikeIntervalSamples);

        for (let n = 1; n <= numSpikes; n++) {
          const spikeIndex = Math.floor(n * spikeIntervalSamples);
          if (spikeIndex < totalSamples) {
            newPacingSpikes.add(spikeIndex);
          }
        }
      }
    } else {
      newBuffer = getRhythmData(rhythmType, heartRate);

      const excludedRhythms: RhythmType[] = ['fibrillationVentriculaire', 'asystole'];
      if (!excludedRhythms.includes(rhythmType)) {
        const refractoryPeriodSamples = 38;
        const derivativeThreshold = 0.1;
        for (let i = 1; i < newBuffer.length; i++) {
          const diff = newBuffer[i] - newBuffer[i - 1];
          if (Math.abs(diff) > derivativeThreshold) {
            let peakIndex = i;
            let peakValue = newBuffer[i];
            const searchWindow = 15;
            for (let j = 1; j < searchWindow && (i + j) < newBuffer.length; j++) {
              if (newBuffer[i + j] > peakValue) {
                peakValue = newBuffer[i + j];
                peakIndex = i + j;
              }
            }
            newPeakCandidates.add(peakIndex);
            i = peakIndex + refractoryPeriodSamples;
          }
        }
      }
    }

    dataRef.current = newBuffer;
    peakCandidateIndicesRef.current = newPeakCandidates;
    pacingSpikeIndicesRef.current = newPacingSpikes;
    normalizationRef.current = {
      min: Math.min(...newBuffer),
      max: Math.max(...newBuffer),
    };


  }, [rhythmType, heartRate, isPacing, pacerFrequency, pacerIntensity]);


  // Effect for Animation and Drawing
  useEffect(() => {
    const topCanvas = topCanvasRef.current;
    const bottomCanvas = bottomCanvasRef.current;
    if (!topCanvas || !bottomCanvas) return;

    const topCtx = topCanvas.getContext("2d");
    const bottomCtx = bottomCanvas.getContext("2d");
    if (!topCtx || !bottomCtx) return;


    scanAccumulatorRef.current = 0;
    lastFrameTimeRef.current = 0;
    lastYRefs.current = { top: null, bottom: null };

    const getNormalizedY = (value: number) => {
      const { min, max } = normalizationRef.current;
      const range = max - min;
      const topMargin = height * 0.3;
      const bottomMargin = height * 0.1;
      const traceHeight = height - topMargin - bottomMargin;
      const normalizedValue = range === 0 ? 0.5 : (value - min) / range;
      const canvasCenter = topMargin + traceHeight / 2;
      const { rhythmType, isPacing } = propsRef.current;
      if (rhythmType === 'electroEntrainement' || rhythmType === 'choc' || isPacing) {
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

    const drawFrame = (currentTime: number) => {
      if (!lastFrameTimeRef.current) lastFrameTimeRef.current = currentTime;
      const deltaTime = currentTime - lastFrameTimeRef.current;
      lastFrameTimeRef.current = currentTime;

      const data = dataRef.current;
      if (data.length === 0) {
        animationRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      const { showSynchroArrows, durationSeconds } = propsRef.current;
      const samplingRate = 250;
      const pixelsPerSecond = width / durationSeconds;
      const samplesPerPixel = (durationSeconds * samplingRate) / width;
      const pixelsToAdvance = (deltaTime / 1000) * pixelsPerSecond;
      const totalTraceLength = width * 2;

      const oldAccumulator = scanAccumulatorRef.current;
      scanAccumulatorRef.current += pixelsToAdvance;

      const oldScanX = Math.floor(oldAccumulator);
      const newScanX = Math.floor(scanAccumulatorRef.current);

      for (let currentX = oldScanX; currentX < newScanX; currentX++) {
        const pixelOnTape = currentX % totalTraceLength;
        const isTopTrace = pixelOnTape < width;

        const activeCtx = isTopTrace ? topCtx : bottomCtx;
        const x = isTopTrace ? pixelOnTape : pixelOnTape - width;

        const sampleIndex = Math.floor(currentX * samplesPerPixel) % data.length;

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
        } else {
          const value = data[sampleIndex];
          const currentY = getNormalizedY(value);
          activeCtx.strokeStyle = "#00ff00";
          activeCtx.lineWidth = 2;
          activeCtx.beginPath();

          const lastY = isTopTrace
            ? lastYRefs.current.top
            : lastYRefs.current.bottom;
          if (lastY !== null && x > 0 && x - 1 === (currentX - 1) % width) {
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

        // Check for synchro arrows in the window
        if (showSynchroArrows) {
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

        // Check for pacing spikes in the window
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

      animationRef.current = requestAnimationFrame(drawFrame);
    };

    animationRef.current = requestAnimationFrame(drawFrame);

    return () => cancelAnimationFrame(animationRef.current);
  }, [width, height]);

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
