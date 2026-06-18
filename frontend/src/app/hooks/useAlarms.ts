import { useState, useEffect, useRef } from 'react';
import { useAudio } from '../context/AudioContext';
import { useWebSocket } from '../context/WebSocketContext';
import { getRhythmData, type RhythmType } from '../components/graphsdata/ECGRhythms';

interface AlarmState {
  heartRate: number;     // valeur affichable
  isBlinking: boolean;   // clignote en FV/FA
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

  // timer local si l'AudioService n'a pas startFCBeepSequenceForHR
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

  // Met à jour la valeur affichée avec la FC clinique
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

    // Stop tout avant de (re)configurer
    audio.stopFCBeepSequence();
    audio.stopFVAlarmSequence();
    clearLocal();

    // Si l'audio n'est pas activé, ou pas d'affichage, ou rythme de choc => silence
    if (!enableAudio || !showFCValue || rhythmType === 'choc') {
      return () => {
        audio.stopFCBeepSequence();
        audio.stopFVAlarmSequence();
        clearLocal();
      };
    }

    const hr = Math.max(30, Math.min(220, clinicalHR || 60));
    const { peaks } = getRhythmData(rhythmType, hr);
    let lastSampleIndex = -1;
    let lastBeatIndex = -1;

    const tick = () => {
      const serverTime = getInterpolatedTime();
      if (serverTime > 0) {
        if (isAlarmableRhythm) {
          // Alarm sound: once every 1.0 second
          const intervalSeconds = 1.0;
          const currentBeatIndex = Math.floor(serverTime / intervalSeconds);
          if (lastBeatIndex === -1) {
            lastBeatIndex = currentBeatIndex;
          } else if (currentBeatIndex > lastBeatIndex) {
            audio.playFVAlarmBeep();
            lastBeatIndex = currentBeatIndex;
          }
        } else {
          // Normal beep: triggered when the sweep line crosses any pre-computed peak index.
          const currentSampleIndex = Math.floor(serverTime * 250) % 2500;
          
          if (lastSampleIndex === -1) {
            lastSampleIndex = currentSampleIndex;
            return;
          }

          const prev = lastSampleIndex;
          const curr = currentSampleIndex;

          let diff = curr - prev;
          if (diff < 0) diff += 2500;
          if (diff > 500) {
            // Clock skipped or tab was suspended, reset index
            lastSampleIndex = currentSampleIndex;
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

          lastSampleIndex = currentSampleIndex;
        }
      }
    };

    const intervalId = setInterval(tick, 30);

    return () => {
      clearInterval(intervalId);
      audio.stopFCBeepSequence();
      audio.stopFVAlarmSequence();
      clearLocal();
    };
  }, [audio, rhythmType, showFCValue, clinicalHR, enableAudio, getInterpolatedTime]);

  return alarmState;
};
