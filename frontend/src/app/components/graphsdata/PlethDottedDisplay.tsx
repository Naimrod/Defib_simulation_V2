import React, { useRef, useEffect } from "react";

interface PlethDottedDisplayProps {
  width?: number;
  height?: number;
  animationState?: {
    getScanX: () => number;
    setScanX: (value: number) => void;
    getSampleIndex: () => number;
    setSampleIndex: (value: number) => void;
    getLastY: () => number | null;
    setLastY: (value: number | null) => void;
  };
}

const PlethDottedDisplay: React.FC<PlethDottedDisplayProps> = ({
  width = 800,
  height = 45,
  animationState,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const localAnimationState = useRef({
    SCROLL_SPEED: 60, // px/s
    dotPattern: 2, // pixels between dots
    dotSize: 3,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = localAnimationState.current;

    // Calculate the center Y position for the dotted line
    const centerY = height / 2;

    const drawGridColumn = (ctx: CanvasRenderingContext2D, x: number) => {
      ctx.strokeStyle = "#001122";
      ctx.lineWidth = 0.3;

      // Vertical grid lines
      if (x % 50 === 0) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal grid lines
      for (let y = 0; y < height; y += 25) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 1, y);
        ctx.stroke();
      }
    };

    //laisser le tracé précédent visible

    const drawFrame = () => {
      const currentScanX = animationState?.getScanX() || 0;

      ctx.fillStyle = "black";
      ctx.fillRect(currentScanX, 0, 2, height);

      // Draw grid at this position
      drawGridColumn(ctx, currentScanX);

      ctx.strokeStyle = "#00bfff";
      ctx.lineWidth = 1;
      if (currentScanX % state.dotPattern === 0) {
        ctx.fillStyle = "#00bfff";
        ctx.fillRect(
          currentScanX,
          centerY - state.dotSize / 2,
          state.dotSize,
          state.dotSize,
        );
      }

      animationState?.setScanX((currentScanX + 1) % width);

      animationRef.current = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [width, height]);

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
      <div className="text-xs font-bold text-cyan-400 text-right">
        <span>Pleth</span>
      </div>
    </div>
  );
};

export default PlethDottedDisplay;
