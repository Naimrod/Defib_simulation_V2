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
  enableAudio: boolean = true,
  targetHR?: number,
  minBpm: number = 50,
  maxBpm: number = 120,
  type: 'ecg' | 'spo2' = 'ecg',
  showPleth: boolean = false,
  clinicalSpo2: number = 98,
  minSpo2: number = 90,
  maxSpo2: number = 100
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
  const targetHRRef = useRef(targetHR);
  const minBpmRef = useRef(minBpm);
  const maxBpmRef = useRef(maxBpm);

  useEffect(() => {
    rhythmTypeRef.current = rhythmType;
    showFCValueRef.current = showFCValue;
    clinicalHRRef.current = clinicalHR;
    enableAudioRef.current = enableAudio;
    targetHRRef.current = targetHR;
    minBpmRef.current = minBpm;
    maxBpmRef.current = maxBpm;
  }, [rhythmType, showFCValue, clinicalHR, enableAudio, targetHR, minBpm, maxBpm]);

  // Blink visuel pour FV/FA/brady/tachy pour ECG ou SpO2 bas pour SpO2
  useEffect(() => {
    let triggerVisualAlarm = false;
    if (type === 'spo2') {
      triggerVisualAlarm = showPleth && clinicalSpo2 < minSpo2;
    } else {
      const isFib = rhythmType === 'fibrillationVentriculaire' || rhythmType === 'fibrillationAtriale';
      const isHrAlert = clinicalHR < minBpm || clinicalHR >= maxBpm || clinicalHR === 0;
      triggerVisualAlarm = isFib || isHrAlert;
    }

    setAlarmState(prev => ({ ...prev, isBlinking: false, showAlarmBanner: triggerVisualAlarm }));

    if (!triggerVisualAlarm) return;

    const blink = setInterval(() => {
        setAlarmState(prev => ({ ...prev, isBlinking: !prev.isBlinking }));
    }, 500);

    return () => clearInterval(blink);
  }, [type, rhythmType, clinicalHR, minBpm, maxBpm, showPleth, clinicalSpo2, minSpo2]);

  // Synchronisation de la valeur cardiaque ou spo2
  useEffect(() => {
    if (type === 'spo2') {
      setAlarmState(prev => ({ ...prev, heartRate: Math.max(0, Math.round(clinicalSpo2 || 0)) }));
      return;
    }
    setAlarmState(prev => ({ ...prev, heartRate: Math.max(0, Math.round(clinicalHR || 0)) }));
  }, [type, clinicalHR, clinicalSpo2]);

  // Audio pour SpO2
  useEffect(() => {
    if (type !== 'spo2' || !audio || !enableAudio) return;

    const triggerAlarm = showPleth && clinicalSpo2 < minSpo2;
    if (triggerAlarm) {
      audio.startSpo2AlarmSequence?.();
    } else {
      audio.stopSpo2AlarmSequence?.();
    }

    return () => {
      try { audio.stopSpo2AlarmSequence?.(); } catch {}
    };
  }, [type, showPleth, clinicalSpo2, minSpo2, audio, enableAudio]);

  // Audio : bip FC calé sur la FC clinique vs bip d’alarme
  useEffect(() => {
    if (type !== 'ecg' || !audio || !enableAudio) return;

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
      const currentTargetHR = targetHRRef.current;

      const isAlarmableRhythm =
        currentRhythmType === 'fibrillationVentriculaire' ||
        currentRhythmType === 'fibrillationAtriale' ||
        currentRhythmType === 'tachycardieVentriculaire' ||
        currentRhythmType === 'asystole';

      const isHrAlert = currentClinicalHR < minBpmRef.current || currentClinicalHR >= maxBpmRef.current || currentClinicalHR === 0;

      // Trigger the alert alarm sound if it's an alarmable rhythm, OR if the displayed HR is out of bounds (bradycardia/tachycardia)
      const triggerAlarmSound = isAlarmableRhythm || isHrAlert;

      // Si l'audio n'est pas activé, ou pas d'affichage, ou rythme de choc => silence
      if (!currentEnableAudio || !currentShowFCValue || currentRhythmType === 'choc') {
        audio.stopFCBeepSequence();
        audio.stopAlertAlarmSequence();
        lastSampleIndexRef.current = -1;
        lastBeatIndexRef.current = -1;
        return;
      }

      const hr = Math.max(30, Math.min(220, currentClinicalHR || 60));
      const { peaks } = getRhythmData(currentRhythmType, hr);

      if (triggerAlarmSound) {
        // Alarm sound: once every 1.0 second
        const intervalSeconds = 1.0;
        const currentBeatIndex = Math.floor(serverTime / intervalSeconds);
        if (lastBeatIndexRef.current === -1) {
          lastBeatIndexRef.current = currentBeatIndex;
        } else if (currentBeatIndex > lastBeatIndexRef.current) {
          audio.playAlertAlarmBeep();
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
    audio.stopAlertAlarmSequence();
    clearLocal();

    const intervalId = setInterval(tick, 30);
    localBeepIntervalRef.current = intervalId;

    return () => {
      clearInterval(intervalId);
      audio.stopFCBeepSequence();
      audio.stopAlertAlarmSequence();
      clearLocal();
    };
  }, [type, audio, getInterpolatedTime, enableAudio]);

  return alarmState;
};