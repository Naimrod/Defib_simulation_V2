import React, { useRef, useEffect } from "react";


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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());

  const isDottedRef = useRef(isDotted);
  isDottedRef.current = isDotted;

  const isFlatLineRef = useRef(isFlatLine);
  isFlatLineRef.current = isFlatLine;

  // Effect to clear the canvas only when its dimensions change.
  // This prevents wiping the trace when other props change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
  }, [width, height]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !animationState) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const minValue = Math.min(...plethWaveform);
    const maxValue = Math.max(...plethWaveform);
    const range = maxValue - minValue || 1;

    const SAMPLING_RATE = 50; // adjusts reading speed
    const totalSamplesInView = durationSeconds * SAMPLING_RATE;
    const stepX = width / totalSamplesInView;

    const drawGridColumn = (x: number) => {
      ctx.strokeStyle = "#001122";
      ctx.lineWidth = 0.3;

      if (Math.floor(x) % 50 < Math.floor(stepX * 2)) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      if (Math.floor(x) % 10 < Math.floor(stepX * 2)) {
        for (let y = 0; y < height; y += 10) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 0.5, y);
          ctx.stroke();
        }
      }
    };

    const drawFrame = (currentTime: number) => {
      if (!animationState) return;

      const deltaTime = currentTime - lastTimeRef.current;
      const samplesToAdvance = (deltaTime / 1000) * SAMPLING_RATE;

      if (samplesToAdvance < 1) {
        animationRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      const startSampleIndex = animationState.getSampleIndex();
      let lastY = animationState.getLastY();

      for (let i = 0; i < Math.floor(samplesToAdvance); i++) {
        const currentSampleIndex = startSampleIndex + i;
        const scanX = (currentSampleIndex % totalSamplesInView) * stepX;

        ctx.fillStyle = "black";
        ctx.fillRect(scanX, 0, stepX * 4, height);
        drawGridColumn(scanX);

        if (isFlatLineRef.current) {
          const centerY = height / 2;
          ctx.strokeStyle = "#d0ff00";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(scanX, centerY);
          ctx.lineTo(scanX + stepX, centerY);
          ctx.stroke();
          lastY = centerY;
        } else if (isDottedRef.current) {
          const centerY = height / 2;
          const dotSize = 2;
          if (currentSampleIndex % 8 === 0) {
            ctx.fillStyle = "#d0ff00";
            ctx.fillRect(scanX, centerY - dotSize / 2, dotSize, dotSize);
          }
          lastY = null;
        } else {
          const value = plethWaveform[currentSampleIndex % plethWaveform.length];
          const normalized = (value - minValue) / range;
          const topMargin = 5;
          const bottomMargin = 2;
          const traceHeight = height - topMargin - bottomMargin;
          const currentY = topMargin + (1 - normalized) * traceHeight;

          ctx.strokeStyle = "#d0ff00";
          ctx.lineWidth = 2;
          ctx.beginPath();

          if (lastY !== null) {
            const prevScanX = ((currentSampleIndex - 1 + totalSamplesInView) % totalSamplesInView) * stepX;
            if (scanX > prevScanX) {
              ctx.moveTo(prevScanX, lastY);
              ctx.lineTo(scanX, currentY);
              ctx.stroke();
            }
          }
          lastY = currentY;
        }
      }

      animationState.setLastY(lastY);
      animationState.setSampleIndex(startSampleIndex + Math.floor(samplesToAdvance));
      lastTimeRef.current = currentTime;
      animationRef.current = requestAnimationFrame(drawFrame);
    };

    animationRef.current = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [width, height, durationSeconds, animationState]);

  return (
    <div className="flex flex-col bg-black rounded w-full">
      <div>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full"
          style={{
            imageRendering: "auto",
            height: height,
          }}
        />
      </div>
      <div className="text-xs font-bold text-yellow-400 text-right">
        <span>Pleth</span>
      </div>
    </div>
  );
};

export default PlethDisplay;
