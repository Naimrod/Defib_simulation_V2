"use client";
import React, { useState, useEffect, useRef } from 'react';
import ECGDisplay from './ECGDisplay';
import { RhythmType } from './ECGRhythms';

interface Props {
    heartRate: number;
    rhythmType: RhythmType;
    isRevealed: boolean;
    shockTimestamp?: number;
}

export default function ECGWrapper({ heartRate, rhythmType, isRevealed, shockTimestamp }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasWidth, setCanvasWidth] = useState(800);

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(entries => {
            for (const e of entries) setCanvasWidth(Math.floor(e.contentRect.width));
        });
        ro.observe(containerRef.current);
        setCanvasWidth(containerRef.current.offsetWidth);
        return () => ro.disconnect();
    }, []);
    const isDottedAsystole = !isRevealed;
    const displayRhythm = (isRevealed && (heartRate === 0 || rhythmType === 'asystole') && rhythmType !== 'choc')
        ? 'asystole' as RhythmType
        : rhythmType;

    return (
        <div 
            ref={containerRef} 
            style={{ 
                width: '100%', 
                height: '150px', 
                position: 'relative',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
            }}
        >
            <ECGDisplay
                width={canvasWidth}
                height={150}
                rhythmType={displayRhythm}
                heartRate={heartRate}
                isDottedAsystole={isDottedAsystole} // Pass the dotted prop!
                durationSeconds={10}
                shockTimestamp={shockTimestamp}
            />
        </div>
    );
}