// useAlarms.ts
"use client";
import { useState, useEffect, useRef } from 'react';
import { useAudio } from '../context/AudioContext';
import type { RhythmType } from '../components/graphsdata/ECGRhythms';

interface AlarmState {
  heartRate: number;
  isBlinking: boolean;
  showAlarmBanner: boolean;
}

export const useAlarms = (
  rhythmType: RhythmType | string, 
  showFCValue: boolean,
  clinicalHR: number
): AlarmState => {
  const audio = useAudio();

  const [alarmState, setAlarmState] = useState<AlarmState>({
    heartRate: clinicalHR ?? 60,
    isBlinking: false,
    showAlarmBanner: false,
  });

  const localBeepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Blink visuel pour FV/FA
  useEffect(() => {
    const isFib = rhythmType === 'fibrillationVentriculaire' || rhythmType === 'fibrillationAtriale';
    setAlarmState(prev => ({ ...prev, isBlinking: false, showAlarmBanner: isFib }));

    if (!isFib) return;

    const blink = setInterval(() => {
        setAlarmState(prev => ({ ...prev, isBlinking: !prev.isBlinking }));
    }, 500);

    return () => clearInterval(blink);
}, [rhythmType]);

  useEffect(() => {
    setAlarmState(prev => ({ ...prev, heartRate: Math.max(0, Math.round(clinicalHR || 0)) }));
  }, [clinicalHR]);

  // Audio : bip FC calé sur la FC clinique vs bip d’alarme
  useEffect(() => {
    if (!audio) return;

    const isAlarmableRhythm =
    rhythmType === 'fibrillationVentriculaire' ||
    rhythmType === 'fibrillationAtriale' ||
    rhythmType === 'tachycardieVentriculaire' ||
    rhythmType === 'asystole';

    const clearLocal = () => {
      if (localBeepIntervalRef.current) {
        clearInterval(localBeepIntervalRef.current);
        localBeepIntervalRef.current = null;
      }
    };

    audio.stopFCBeepSequence();
    audio.stopFVAlarmSequence();
    clearLocal();

    if (!showFCValue) {
      return () => {
        audio.stopFCBeepSequence();
        audio.stopFVAlarmSequence();
        clearLocal();
      };
    }

    // Rythme d’alarme => bip d’alarme
    if (isAlarmableRhythm) {
      audio.startFVAlarmSequence();
      return () => audio.stopFVAlarmSequence();
    }

    const hr = Math.max(30, Math.min(220, clinicalHR || 60));
    try { audio.playFCBeep(); } catch {}

    if (typeof (audio as any).startFCBeepSequenceForHR === 'function') {
      (audio as any).startFCBeepSequenceForHR(hr);
    } else {
      const intervalMs = Math.max(350, Math.min(3000, 60000 / hr));
      localBeepIntervalRef.current = setInterval(() => {
        try { audio.playFCBeep(); } catch {}
      }, intervalMs);
    }

    return () => {
      audio.stopFCBeepSequence();
      clearLocal();
    };
  }, [audio, rhythmType, showFCValue, clinicalHR]);

  return alarmState;
};