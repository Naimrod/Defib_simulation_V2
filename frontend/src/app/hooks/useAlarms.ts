// useAlarms.ts
"use client";
import { useState, useEffect, useRef } from 'react';
import { useAudio } from '../context/AudioContext';
import { useWebSocket } from '../context/WebSocketContext';
import { getRhythmData, type RhythmType } from '../components/graphsdata/ECGRhythms';

interface AlarmState {
  heartRate: number;
  isBlinking: boolean;
  showAlarmBanner: boolean;
}

/**
 * Hook alarmes synchronisé sur la FC clinique.
 * - Aligné sur le serveur de temps global pour éviter les dérives et double bips.
 * - Rythmes d’alarme -> bip alarme
 */
export const useAlarms = (
  rhythmType: RhythmType, 
  showFCValue: boolean,
  clinicalHR: number,
  enableAudio: boolean = true
): AlarmState => {
  const audio = useAudio();
  const { getInterpolatedTime } = useWebSocket();

  const [alarmState, setAlarmState] = useState<AlarmState>({
    heartRate: clinicalHR ?? 60,
    isBlinking: false,
    showAlarmBanner: false,
  });

  const localBeepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep refs of dependencies to avoid tearing down the audio interval
  const rhythmTypeRef = useRef(rhythmType);
  const showFCValueRef = useRef(showFCValue);
  const clinicalHRRef = useRef(clinicalHR);
  const enableAudioRef = useRef(enableAudio);

  useEffect(() => {
    rhythmTypeRef.current = rhythmType;
    showFCValueRef.current = showFCValue;
    clinicalHRRef.current = clinicalHR;
    enableAudioRef.current = enableAudio;
  }, [rhythmType, showFCValue, clinicalHR, enableAudio]);

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

    const lastSampleIndexRef = { current: -1 };
    const lastBeatIndexRef = { current: -1 };

    const clearLocal = () => {
      if (localBeepIntervalRef.current) {
        clearInterval(localBeepIntervalRef.current);
        localBeepIntervalRef.current = null;
      }
    };

    const tick = () => {
      const serverTime = getInterpolatedTime();
      if (serverTime <= 0) return;

      const currentRhythmType = rhythmTypeRef.current;
      const currentShowFCValue = showFCValueRef.current;
      const currentEnableAudio = enableAudioRef.current;
      const currentClinicalHR = clinicalHRRef.current;

      const isAlarmableRhythm =
        currentRhythmType === 'fibrillationVentriculaire' ||
        currentRhythmType === 'fibrillationAtriale' ||
        currentRhythmType === 'tachycardieVentriculaire' ||
        currentRhythmType === 'asystole';

      // Si l'audio n'est pas activé, ou pas d'affichage, ou rythme de choc => silence
      if (!currentEnableAudio || !currentShowFCValue || currentRhythmType === 'choc') {
        audio.stopFCBeepSequence();
        audio.stopFVAlarmSequence();
        lastSampleIndexRef.current = -1;
        lastBeatIndexRef.current = -1;
        return;
      }

      const hr = Math.max(30, Math.min(220, currentClinicalHR || 60));
      const { peaks } = getRhythmData(currentRhythmType, hr);

      if (isAlarmableRhythm) {
        // Alarm sound: once every 1.0 second
        const intervalSeconds = 1.0;
        const currentBeatIndex = Math.floor(serverTime / intervalSeconds);
        if (lastBeatIndexRef.current === -1) {
          lastBeatIndexRef.current = currentBeatIndex;
        } else if (currentBeatIndex > lastBeatIndexRef.current) {
          audio.playFVAlarmBeep();
          lastBeatIndexRef.current = currentBeatIndex;
        }
      } else {
        // Normal beep: triggered when the sweep line crosses any pre-computed peak index.
        const currentSampleIndex = Math.floor(serverTime * 250) % 2500;
        
        if (lastSampleIndexRef.current === -1) {
          lastSampleIndexRef.current = currentSampleIndex;
          return;
        }

        const prev = lastSampleIndexRef.current;
        const curr = currentSampleIndex;

        let diff = curr - prev;
        if (diff < 0) diff += 2500;
        if (diff > 500) {
          // Clock skipped or tab was suspended, reset index
          lastSampleIndexRef.current = currentSampleIndex;
          return;
        }

        // Check if we crossed a peak index in the range (prev, curr]
        const crossedPeak = peaks.some(peak => {
          if (curr >= prev) {
            return peak > prev && peak <= curr;
          } else {
            // Wrapped around 2500
            return peak > prev || peak <= curr;
          }
        });

        if (crossedPeak) {
          audio.playFCBeep();
        }

        lastSampleIndexRef.current = currentSampleIndex;
      }
    };

    audio.stopFCBeepSequence();
    audio.stopFVAlarmSequence();
    clearLocal();

    const intervalId = setInterval(tick, 30);
    localBeepIntervalRef.current = intervalId;

    return () => {
      clearInterval(intervalId);
      audio.stopFCBeepSequence();
      audio.stopFVAlarmSequence();
      clearLocal();
    };
  }, [audio, getInterpolatedTime]);

  return alarmState;
};