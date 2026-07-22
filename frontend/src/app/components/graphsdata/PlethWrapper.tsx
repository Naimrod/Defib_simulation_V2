"use client";
import React, { useState, useEffect, useRef } from 'react';
import PlethDisplay from './PlethDisplay';

interface Props {
    spo2: number;
    heartRate: number;
    isRevealed: boolean;
}

export default function PlethWrapper({ spo2, heartRate, isRevealed }: Props) {
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
        const ro = new ResizeObserver(entries => {
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

    const isDotted = !isRevealed;
    const isFlatLine = isRevealed && (spo2 === 0 || heartRate === 0);

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '100px', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 1, zIndex: 1 }}>
                <PlethDisplay
                    width={dimensions.width}
                    height={dimensions.height}
                    isDotted={isDotted}
                    isFlatLine={isFlatLine}
                    durationSeconds={10}
                    heartRate={heartRate}
                    spo2={spo2}
                    animationState={animationState}
                />
            </div>
        </div>
    );
}