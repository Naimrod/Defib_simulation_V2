import { useState, useEffect, useRef } from 'react';
import { useAudio } from '../context/AudioContext';
import type { RhythmType } from '../components/graphsdata/ECGRhythms';

interface AlarmState {
  heartRate: number;     // valeur affichable
  isBlinking: boolean;   // clignote en FV/FA
  showAlarmBanner: boolean;
}

/**
 * Hook alarmes synchronisé sur la FC clinique.
 * - Premier bip immédiat
 * - Intervalle = 60000 / HR (borné)
 * - Rythmes d’alarme -> bip alarme
 */
export const useAlarms = (
  rhythmType: RhythmType,
  showFCValue: boolean,
  clinicalHR: number
): AlarmState => {
  const audio = useAudio();

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

    // Pas d’affichage FC => silence
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

    // Sinon : bip FC calé sur HR clinique (premier bip immédiat)
    const hr = Math.max(30, Math.min(220, clinicalHR || 60));
    try { audio.playFCBeep(); } catch {}

    // Si AudioService propose une API dédiée, on l'utilise
    if (typeof (audio as any).startFCBeepSequenceForHR === 'function') {
      (audio as any).startFCBeepSequenceForHR(hr);
    } else {
      // Fallback local
      const intervalMs = Math.max(350, Math.min(3000, 60000 / hr)); // bornes de sécurité
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
