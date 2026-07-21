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
    const [dimensions, setDimensions] = useState({ width: 800, height: 150 });

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
    const isDottedAsystole = !isRevealed;
    const displayRhythm = (isRevealed && (heartRate === 0 || rhythmType === 'asystole') && rhythmType !== 'choc')
        ? 'asystole' as RhythmType
        : rhythmType;

    return (
        <div 
            ref={containerRef} 
            style={{ 
                width: '100%', 
                height: '100%', 
                minHeight: '100px',
                position: 'relative',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
            }}
        >
            <ECGDisplay
                width={dimensions.width}
                height={dimensions.height}
                rhythmType={displayRhythm}
                heartRate={heartRate}
                isDottedAsystole={isDottedAsystole} // Pass the dotted prop!
                durationSeconds={10}
                shockTimestamp={shockTimestamp}
            />
        </div>
    );
}