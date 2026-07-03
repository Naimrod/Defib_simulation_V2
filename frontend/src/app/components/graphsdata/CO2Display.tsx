import React, { useRef, useEffect } from "react";
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

const co2Waveform = [
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

        const minValue = Math.min(...co2Waveform);
        const maxValue = Math.max(...co2Waveform);
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
                    ctx.strokeStyle = "#00bfff";
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
                        ctx.fillStyle = "#00bfff";
                        ctx.fillRect(scanX, centerY - dotSize / 2, dotSize, dotSize);
                    }
                    lastY = null;
                } else {
                    const value = co2Waveform[currentSampleIndex % co2Waveform.length];
                    const normalized = (value - minValue) / range;
                    const topMargin = 5;
                    const bottomMargin = 2;
                    const traceHeight = height - topMargin - bottomMargin;
                    const currentY = topMargin + (1 - normalized) * traceHeight;

                    ctx.strokeStyle = "#00bfff";
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
            <div className="text-xs font-bold text-cyan-400 text-right">
                <span>CO2</span>
            </div>
        </div>
    );
};

export default Co2Display;