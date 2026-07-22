"use client";
import React, { useState, useEffect, useRef } from "react";
import TwoLeadECGDisplay from "./TwoLeadECGDisplay";
import { RhythmType } from "./ECGRhythms";

interface Props {
  rhythmType: RhythmType;
  showSynchroArrows: boolean;
  heartRate: number;
  durationSeconds?: number;
  chargeProgress: number;
  shockCount: number;
  energy: string;
  isDottedAsystole: boolean;
  showDefibrillatorInfo?: boolean;
  showRhythmText?: boolean;
  isPacing?: boolean;
  pacerFrequency?: number;
  pacerIntensity?: number;
  shockTimestamp?: number;
  height?: number;
}

export default function TwoLeadECGWrapper({ height = 100, ...props }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        if (e.contentRect.width > 0) {
          setWidth(Math.floor(e.contentRect.width));
        }
      }
    });
    ro.observe(containerRef.current);
    if (containerRef.current.offsetWidth > 0) {
      setWidth(containerRef.current.offsetWidth);
    }
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col bg-black overflow-hidden"
    >
      <TwoLeadECGDisplay
        {...props}
        width={width}
        height={height}
      />
    </div>
  );
}
