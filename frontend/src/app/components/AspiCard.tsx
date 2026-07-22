"use client";

import { useState, type CSSProperties } from "react";
import { formatAspi, useAspi } from "../hooks/useAspi";
import type { AspiModel } from "../data/aspiModels";

interface AspiCardProps {
  model: AspiModel;
}

export default function AspiCard({ model }: AspiCardProps) {
  const [isOn, setIsOn] = useState(false);

  const {
    dialRef,
    selectedIndex,
    flow,
    angle,
    markings,
    unlockAudio,
    handlePointerDown,
    handleKeyDown,
  } = useAspi(model, isOn);

  const themeStyle = {
    "--ring-a": model.ring[0],
    "--ring-b": model.ring[1],
    "--ring-c": model.ring[2],
    "--pointer-a": model.pointer[0],
    "--pointer-b": model.pointer[1],
    "--name": model.brand,
  } as CSSProperties;

  const displayAngle = isOn ? angle : 125;

  return (
    <div
      className="relative w-[260px] max-w-[85vw] flex flex-col items-center flex-none"
      style={themeStyle}
      aria-label={`Prototype ${model.brand}`}
    >
      {/* TOP GAUGE (Read-Only Display) */}
      <div className="relative w-full aspect-square bg-yellow-300 rounded-full shadow-[0_10px_20px_rgba(0,0,0,0.15),inset_-4px_-4px_10px_rgba(0,0,0,0.08)] z-[2]">
        <div className="absolute inset-[8%] rounded-full bg-white shadow-[inset_0_0_0_4px_rgba(15,23,42,0.16)] pointer-events-none select-none">
          <div
            className="absolute -inset-[15px] rounded-full skeuomorphic-ring [clip-path:circle(50%_at_50%_50%)] pointer-events-none before:content-[''] before:absolute before:inset-[15px] before:rounded-full before:bg-white before:shadow-[inset_0_0_0_4px_rgba(15,23,42,0.16)] after:content-[''] after:absolute after:inset-[6px] after:border after:border-white/55 after:rounded-full"
            aria-hidden="true"
          />

          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" aria-hidden="true">
            {markings.map((mark) => (
              <g key={mark.index}>
                <line
                  x1={mark.inner.x}
                  y1={mark.inner.y}
                  x2={mark.outer.x}
                  y2={mark.outer.y}
                  stroke="#0f172a"
                  strokeWidth={mark.index === selectedIndex ? 1.9 : 1}
                  strokeLinecap="round"
                />
                <text
                  x={mark.labelPos.x}
                  y={mark.labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#111827"
                  fontSize={mark.fontSize}
                  fontWeight={mark.index === selectedIndex ? 850 : 600}
                >
                  {mark.label}
                </text>
              </g>
            ))}
          </svg>

          <div className="absolute inset-[23%] flex flex-col items-center justify-center border border-gray-300 rounded-full bg-gradient-to-br from-white to-slate-50 text-center shadow-[inset_0_12px_24px_rgba(15,23,42,0.06)] pointer-events-none select-none">
            <span className="text-slate-600 text-[clamp(10px,1.4vw,14px)] font-extrabold tracking-[0.13em] uppercase">{model.brand}</span>
            <strong className="mt-[2px] text-slate-900 text-[clamp(24px,4.5vw,42px)] leading-none">{model.name}</strong>
            <em className="mt-1.5 text-slate-500 text-xs not-italic font-bold">{formatAspi(isOn ? flow : 0)} mbar</em>
          </div>

          <div
            className="absolute left-1/2 top-1/2 w-[6px] h-[46%] rounded-[6px_6px_2px_2px] bg-slate-800 shadow-[4px_4px_8px_rgba(15,23,42,0.15)] origin-[50%_91%] transition-transform duration-[1250ms] ease-[cubic-bezier(0.25,0.8,0.25,1)]"
            aria-hidden="true"
            style={{ transform: `translate(-50%, -91%) rotate(${displayAngle}deg)` }}
          >
            <span className="absolute left-1/2 top-[91%] w-4 h-4 -translate-x-1/2 -translate-y-1/2 border-2 border-slate-300 rounded-full bg-slate-900 shadow-[0_2px_6px_rgba(0,0,0,0.25)]" />
          </div>
        </div>
      </div>

      {/* BOTTOM CONTROL BODY (Interactive Regulator) */}
      <div className="relative w-[85%] aspect-square -mt-[12%] z-[1] flex items-center justify-center before:content-[''] before:absolute before:inset-0 before:bg-yellow-300 before:rounded-full before:shadow-[0_12px_24px_rgba(0,0,0,0.18),inset_-4px_-4px_10px_rgba(0,0,0,0.08)] before:z-0 before:pointer-events-none">
        {/* Red OFF Button */}
        <button
          className={`absolute top-1/2 -mt-[15%] w-[30%] h-[30%] border-none cursor-pointer transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] z-[-1] left-[-12%] bg-gradient-to-br from-red-500 to-red-700 rounded-l-xl border-2 border-red-900 border-r-0 shadow-[-4px_4px_10px_rgba(0,0,0,0.2),inset_2px_2px_4px_rgba(255,255,255,0.2)] origin-right-center ${
            !isOn ? "translate-x-[40%]" : ""
          }`}
          onClick={() => setIsOn(false)}
          aria-label="Turn Off"
          aria-pressed={!isOn}
        />

        {/* Green Interactive Knob */}
        <div
          ref={dialRef}
          className="w-[58%] h-[58%] rounded-full bg-green-500 border-3 border-green-600 shadow-[0_8px_16px_rgba(0,0,0,0.3),inset_0_4px_8px_rgba(255,255,255,0.4)] cursor-grab active:cursor-grabbing focus-visible:shadow-[0_0_0_4px_rgba(8,145,178,0.4),0_8px_16px_rgba(0,0,0,0.3)] touch-none outline-none relative z-[3]"
          role="slider"
          aria-label={`Reglage - ${model.brand}`}
          aria-valuemin={0}
          aria-valuemax={model.values[model.values.length - 1]}
          aria-valuenow={flow}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
        >
          <div className="w-full h-full rounded-full bg-[repeating-conic-gradient(from_0deg,transparent_0deg_15deg,rgba(0,0,0,0.05)_15deg_30deg)]" style={{ transform: `rotate(${angle}deg)` }}>
            <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[16%] h-[16%] bg-white rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]" />
          </div>
        </div>

        {/* Green ON Button */}
        <button
          className={`absolute top-1/2 -mt-[15%] w-[30%] h-[30%] border-none cursor-pointer transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] z-[-1] right-[-12%] bg-gradient-to-br from-green-500 to-green-700 rounded-r-xl border-2 border-green-900 border-l-0 shadow-[4px_4px_10px_rgba(0,0,0,0.2),inset_-2px_2px_4px_rgba(255,255,255,0.2)] origin-left-center ${
            isOn ? "-translate-x-[40%]" : ""
          }`}
          onClick={() => {
            setIsOn(true);
            unlockAudio();
          }}
          aria-label="Turn On"
          aria-pressed={isOn}
        />
      </div>
    </div>
  );
}