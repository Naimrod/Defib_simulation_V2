"use client";
import React, { useState, useEffect, useRef } from 'react';
import Co2Display from './CO2Display';

interface Co2WrapperProps {
    co2: number | null;
    heartRate: number;
    respirationRate: number;
    isRevealed: boolean;
    isDottedAsystole?: boolean;
}

export default function Co2Wrapper({ co2, heartRate,respirationRate, isRevealed, isDottedAsystole = false }: Co2WrapperProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 150 });

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
            for (const e of entries) {
                setDimensions({
                    width: Math.floor(e.contentRect.width) || 800,
                    height: Math.floor(e.contentRect.height) || 150
                });
            }
        });
        ro.observe(containerRef.current);
        if (containerRef.current) {
            setDimensions({
                width: containerRef.current.offsetWidth || 800,
                height: containerRef.current.offsetHeight || 150
            });
        }
        return () => ro.disconnect();
    }, []);

    const isDotted = !isRevealed || co2 === null;
    const isFlatLine = isRevealed && co2 !== null && co2 < 2 || heartRate == 0;

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '100px', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 1, zIndex: 1 }}>
                <Co2Display
                    width={dimensions.width}
                    height={dimensions.height}
                    isDotted={isDotted}
                    isFlatLine={isFlatLine}
                    durationSeconds={10}
                    respirationRate={respirationRate}
                    co2={co2 ?? undefined}
                    animationState={animationState}
                    isDottedAsystole={!isDottedAsystole}
                />
            </div>
        </div>
    );
}