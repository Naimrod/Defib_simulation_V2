"use client";

import type { CSSProperties } from "react";
import { formatFlow, useFlowmeter } from "../hooks/useFlowmeter";
import type { FlowmeterModel } from "../data/flowmeterModels";
import styles from "../styles/flowmeter.module.css";

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
    <div className={styles.deviceStage} style={themeStyle} aria-label={`Prototype ${model.brand}`}>

      <div
        ref={dialRef}
        className={styles.dial}
        role="slider"
        aria-label={`Reglage du debit d'oxygene - ${model.brand}`}
        aria-valuemin={0}
        aria-valuemax={model.values[model.values.length - 1]}
        aria-valuenow={flow}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.blueRing} aria-hidden="true" />

        <svg className={styles.dialMarkings} viewBox="0 0 100 100" aria-hidden="true">
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

        <div className={styles.centerLabel}>
          <span className={styles.brand}>{model.brand}</span>
          <strong>
            {model.name}
          </strong>
          <em>{formatFlow(flow)} L/min</em>
        </div>

        <div
          className={styles.pointer}
          aria-hidden="true"
          style={{ transform: `translate(-50%, -91%) rotate(${angle}deg)` }}
        >
          <span />
        </div>
      </div>
    </div>
  );
}