"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AspiModel } from "../data/aspiModels";
import { useWebSocket } from "../context/WebSocketContext";

const MIN_ANGLE = -125;
const MAX_ANGLE = 125;

export function formatAspi(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

function pointOnCircle(angle: number, radius: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: Math.round((50 + radius * Math.cos(radians)) * 10000) / 10000,
    y: Math.round((50 + radius * Math.sin(radians)) * 10000) / 10000,
  };
}

export interface AspiMarking {
  index: number;
  label: string;
  inner: { x: number; y: number };
  outer: { x: number; y: number };
  labelPos: { x: number; y: number };
  fontSize: string;
}

// 1. Accept the isOn state from the component
export function useAspi(model: AspiModel, isOn: boolean) {
  const { sendMessage, deviceId } = useWebSocket();
  const isFirstRenderRef = useRef(true);

  const values = model.values;
  const stepAngle = (MAX_ANGLE - MIN_ANGLE) / (values.length - 1);

  const dialRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const previousFlowRef = useRef(model.initialValue);

  const audioContextRef = useRef<AudioContext | null>(null);
  const hissGainRef = useRef<GainNode | null>(null);
  const hissFilterRef = useRef<BiquadFilterNode | null>(null);

  const [selectedIndex, setSelectedIndexState] = useState(() => {
    const initial = values.indexOf(model.initialValue);
    return initial >= 0 ? initial : 0;
  });
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

  useEffect(() => {
    const initial = values.indexOf(model.initialValue);
    setSelectedIndexState(initial >= 0 ? initial : 0);
    previousFlowRef.current = model.initialValue;
  }, [model, values]);

  const flow = values[selectedIndex];
  const angle = MAX_ANGLE - stepAngle * selectedIndex;
  const leakRatio = Math.max(
    0,
    Math.min(1, (flow - model.leakStart) / (model.leakMax - model.leakStart))
  );

  const prevIsOnRef = useRef(isOn);
  const prevFlowRef = useRef(flow);

  // Broadcast power toggle and vacuum adjustments to session log via WebSocket
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevIsOnRef.current = isOn;
      prevFlowRef.current = flow;
      return;
    }

    if (prevIsOnRef.current !== isOn) {
      prevIsOnRef.current = isOn;
      sendMessage({
        type: "aspi_action",
        name: model.name,
        brand: model.brand,
        action: "toggle_power",
        state: isOn ? "ON" : "OFF",
        flow,
        unit: "mbar",
        source_device: deviceId,
      });
    } else if (isOn && prevFlowRef.current !== flow) {
      prevFlowRef.current = flow;
      sendMessage({
        type: "aspi_action",
        name: model.name,
        brand: model.brand,
        action: "set_vacuum",
        state: "ON",
        flow,
        unit: "mbar",
        source_device: deviceId,
      });
    }
  }, [isOn, flow, model.name, model.brand, deviceId, sendMessage]);

  const createNoiseBuffer = useCallback((context: AudioContext) => {
    const bufferSize = context.sampleRate * 2;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }, []);

  const ensureAudio = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;

    const AudioContextConstructor: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;

    if (!audioContextRef.current) {
      const context = new AudioContextConstructor();
      const noiseSource = context.createBufferSource();
      const hissFilter = context.createBiquadFilter();
      const hissGain = context.createGain();

      noiseSource.buffer = createNoiseBuffer(context);
      noiseSource.loop = true;
      hissFilter.type = "highpass";
      hissFilter.frequency.value = 1200;
      hissGain.gain.value = 0;

      noiseSource.connect(hissFilter).connect(hissGain).connect(context.destination);
      noiseSource.start();

      audioContextRef.current = context;
      hissFilterRef.current = hissFilter;
      hissGainRef.current = hissGain;
    }

    setIsAudioUnlocked(audioContextRef.current.state === "running");
    return audioContextRef.current;
  }, [createNoiseBuffer]);

  const playUnlockPulse = useCallback((context: AudioContext) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.035, now + 0.015);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.09);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  }, []);

  const updateAudio = useCallback((ratio: number) => {
    const context = audioContextRef.current;
    const hissGain = hissGainRef.current;
    const hissFilter = hissFilterRef.current;
    if (!context || !hissGain || !hissFilter) return;

    const now = context.currentTime;
    hissGain.gain.cancelScheduledValues(now);
    hissGain.gain.linearRampToValueAtTime(ratio * 0.22, now + 0.12);
    hissFilter.frequency.linearRampToValueAtTime(1200 + ratio * 2400, now + 0.12);
  }, []);

  // 2. Mute the audio if the device is not turned on
  useEffect(() => {
    updateAudio(isOn ? leakRatio : 0);
  }, [leakRatio, isOn, updateAudio]);

  // 3. Only vibrate if the device is turned on
  useEffect(() => {
    if (isOn && flow > model.leakStart && flow !== previousFlowRef.current) {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(Math.min(24, 6 + flow));
      }
    }
    previousFlowRef.current = flow;
  }, [flow, model.leakStart, isOn]);

  const unlockAudio = useCallback(async () => {
    const context = ensureAudio();
    if (!context) return;

    if (context.state === "suspended") {
      await context.resume().catch(() => {});
    }

    playUnlockPulse(context);
    const state = context.state as string;
    setIsAudioUnlocked(state === "running" || state === "interrupted");

    window.setTimeout(() => {
      setIsAudioUnlocked(context.state === "running");
    }, 120);
  }, [ensureAudio, playUnlockPulse]);

  const setSelectedIndex = useCallback(
    (next: number) => {
      setSelectedIndexState(Math.max(0, Math.min(values.length - 1, next)));
    },
    [values.length]
  );

  const setFromClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const dial = dialRef.current;
      if (!dial) return;

      const rect = dial.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      let rawAngle = (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI + 90;
      
      if (rawAngle > 180) {
        rawAngle -= 360;
      }

      const clampedAngle = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, rawAngle));
      const nextIndex = values.length - 1 - Math.round((clampedAngle - MIN_ANGLE) / stepAngle);

      ensureAudio();
      setSelectedIndex(nextIndex);
    },
    [values.length, stepAngle, ensureAudio, setSelectedIndex]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dialRef.current?.setPointerCapture(event.pointerId);
      isDraggingRef.current = true;
      setFromClientPoint(event.clientX, event.clientY);
    },
    [setFromClientPoint]
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isDraggingRef.current) return;
      setFromClientPoint(event.clientX, event.clientY);
    };
    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [setFromClientPoint]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        ensureAudio();
        setSelectedIndex(selectedIndex + 1);
        event.preventDefault();
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        ensureAudio();
        setSelectedIndex(selectedIndex - 1);
        event.preventDefault();
      }
    },
    [ensureAudio, setSelectedIndex, selectedIndex]
  );

  useEffect(() => {
    return () => {
      audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
    };
  }, []);

  const markings: AspiMarking[] = values.map((value, index) => {
    const angleForIndex = MAX_ANGLE - stepAngle * index;
    const labelPos = pointOnCircle(angleForIndex, value >= 10 || String(value).length > 3 ? 34 : 35);
    const inner = pointOnCircle(angleForIndex, value === 0 ? 39 : 41);
    const outer = pointOnCircle(angleForIndex, 46);

    return {
      index,
      label: formatAspi(value),
      inner,
      outer,
      labelPos,
      fontSize: String(value).length > 3 ? "5.6" : value >= 10 ? "7" : "8",
    };
  });

  return {
    dialRef,
    selectedIndex,
    flow,
    angle,
    markings,
    isAudioUnlocked,
    unlockAudio,
    handlePointerDown,
    handleKeyDown,
  };
}