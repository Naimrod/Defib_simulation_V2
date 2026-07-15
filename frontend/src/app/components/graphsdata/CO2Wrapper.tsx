"use client";
import React, { useState, useEffect, useRef } from 'react';
import Co2Display from './CO2Display';

interface Co2WrapperProps {
    co2: number | null;
    respirationRate: number;
    isRevealed: boolean;
}

export default function Co2Wrapper({ co2, respirationRate, isRevealed }: Co2WrapperProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasWidth, setCanvasWidth] = useState<number>(800);

    const scanXRef = useRef<number>(0);
    const sampleIndexRef = useRef<number>(0);
    const lastYRef = useRef<number | null>(null);

    const animationState = {
        getScanX: () => scanXRef.current,
        setScanX: (v: number) => { scanXRef.current = v; },
        getSampleIndex: () => sampleIndexRef.current,
        setSampleIndex: (v: number) => { sampleIndexRef.current = v; },
        getLastY: () => lastYRef.current,
        setLastY: (v: number | null) => { lastYRef.current = v; },
    };

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver((entries) => {
            for (const e of entries) setCanvasWidth(Math.floor(e.contentRect.width));
        });
        ro.observe(containerRef.current);
        setCanvasWidth(containerRef.current.offsetWidth);
        return () => ro.disconnect();
    }, []);

    const isDotted = !isRevealed || co2 === null;
    const isFlatLine = isRevealed && co2 !== null && co2 < 2;

    return (
        <div ref={containerRef} style={{ width: '100%', height: '150px', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 1, zIndex: 1 }}>
                <Co2Display
                    width={canvasWidth}
                    height={150}
                    isDotted={isDotted}
                    isFlatLine={isFlatLine}
                    durationSeconds={10}
                    respirationRate={respirationRate}
                    co2={co2 ?? undefined}
                    animationState={animationState}
                />
            </div>
        </div>
    );
}