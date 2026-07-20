"use client";

import { useState, type CSSProperties } from "react";
import { formatAspi, useAspi } from "../hooks/useAspi";
import type { AspiModel } from "../data/aspiModels";
import styles from "../styles/aspi.module.css";

interface AspiCardProps {
  model: AspiModel;
}

export default function AspiCard({ model }: AspiCardProps) {
  // 1. Move state up so we can pass it into the hook
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
    <div className={styles.deviceStage} style={themeStyle} aria-label={`Prototype ${model.brand}`}>
      
      {/* TOP GAUGE (Read-Only Display) */}
      <div className={styles.gaugeTop}>
        <div className={styles.dial}>
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
            <strong>{model.name}</strong>
            <em>{formatAspi(isOn ? flow : 0)} mbar</em>
          </div>

          <div
            className={styles.pointer}
            aria-hidden="true"
            style={{ transform: `translate(-50%, -91%) rotate(${displayAngle}deg)` }}
          >
            <span />
          </div>
        </div>
      </div>

      {/* BOTTOM CONTROL BODY (Interactive Regulator) */}
      <div className={styles.regulatorBottom}>
        {/* Red OFF Button */}
        <button
          className={`${styles.sideButton} ${styles.redButton} ${!isOn ? styles.pushed : ""}`}
          onClick={() => setIsOn(false)}
          aria-label="Turn Off"
          aria-pressed={!isOn}
        />

        {/* Green Interactive Knob */}
        <div
          ref={dialRef}
          className={styles.greenKnob}
          role="slider"
          aria-label={`Reglage - ${model.brand}`}
          aria-valuemin={0}
          aria-valuemax={model.values[model.values.length - 1]}
          aria-valuenow={flow}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
        >
          <div className={styles.knobGrip} style={{ transform: `rotate(${angle}deg)` }}>
            <div className={styles.knobIndicator} />
          </div>
        </div>

        {/* Green ON Button */}
        <button
          className={`${styles.sideButton} ${styles.greenButton} ${isOn ? styles.pushed : ""}`}
          onClick={() => {
            setIsOn(true);
            unlockAudio(); // 3. Ensure browser allows audio on click!
          }}
          aria-label="Turn On"
          aria-pressed={isOn}
        />
      </div>

    </div>
  );
}