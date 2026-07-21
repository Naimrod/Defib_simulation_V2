"use client";

import type { CSSProperties } from "react";
import { formatFlow, useFlowmeter } from "../hooks/useFlowmeter";
import type { FlowmeterModel } from "../data/flowmeterModels";

interface FlowmeterCardProps {
  model: FlowmeterModel;
}

export default function FlowmeterCard({ model }: FlowmeterCardProps) {
  const {
    dialRef,
    selectedIndex,
    flow,
    angle,
    markings,
    handlePointerDown,
    handleKeyDown,
  } = useFlowmeter(model);

  const themeStyle = {
    "--ring-a": model.ring[0],
    "--ring-b": model.ring[1],
    "--ring-c": model.ring[2],
    "--pointer-a": model.pointer[0],
    "--pointer-b": model.pointer[1],
    "--name": model.name,
  } as CSSProperties;

  return (
    <div
      className="relative w-[340px] max-w-[90vw] aspect-square flex-none"
      style={themeStyle}
      aria-label={`Prototype ${model.brand}`}
    >
      <div
        ref={dialRef}
        className="absolute left-1/2 top-[6%] w-[78%] aspect-square rounded-full bg-white shadow-[inset_0_0_0_4px_rgba(15,23,42,0.16),0_22px_46px_rgba(30,41,59,0.22)] cursor-grab active:cursor-grabbing focus-visible:shadow-[inset_0_0_0_4px_rgba(15,23,42,0.16),0_0_0_4px_rgba(8,145,178,0.26),0_22px_46px_rgba(30,41,59,0.22)] touch-none outline-none -translate-x-1/2 select-none"
        role="slider"
        aria-label={`Reglage du debit d'oxygene - ${model.brand}`}
        aria-valuemin={0}
        aria-valuemax={model.values[model.values.length - 1]}
        aria-valuenow={flow}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
      >
        <div
          className="absolute -inset-[22px] rounded-full skeuomorphic-ring pointer-events-none before:content-[''] before:absolute before:inset-[22px] before:rounded-full before:bg-white before:shadow-[inset_0_0_0_4px_rgba(15,23,42,0.16)] after:content-[''] after:absolute after:inset-[6px] after:border after:border-white/55 after:rounded-full"
          aria-hidden="true"
        />

        <svg className="absolute inset-0 w-full h-full pointer-events-none select-none" viewBox="0 0 100 100" aria-hidden="true">
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
          <span className="text-slate-600 text-[clamp(11px,1.6vw,16px)] font-extrabold tracking-[0.13em] uppercase">{model.brand}</span>
          <strong className="mt-[5px] text-slate-900 text-[clamp(32px,5.2vw,56px)] leading-none">{model.name}</strong>
          <em className="mt-2.5 text-slate-500 text-xs not-italic font-bold">{formatFlow(flow)} L/min</em>
        </div>

        <div
          className="absolute left-1/2 top-1/2 w-[22px] h-[45%] rounded-full skeuomorphic-pointer origin-[50%_91%] transition-transform duration-120 pointer-events-none"
          aria-hidden="true"
          style={{ transform: `translate(-50%, -91%) rotate(${angle}deg)` }}
        >
          <span className="absolute left-1/2 top-[10px] w-4 h-4 -translate-x-1/2 border border-[#4195c9] rounded-full bg-white/70" />
        </div>
      </div>
    </div>
  );
}