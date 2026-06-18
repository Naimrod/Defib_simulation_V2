"use client";
import React from 'react';
import { useAlarms } from '../hooks/useAlarms';
import type { RhythmType } from './graphsdata/ECGRhythms';

interface AlarmBannerProps {
  rhythmType: string;
  showFCValue: boolean;
  heartRate: number;
}

export const AlarmBanner: React.FC<AlarmBannerProps> = ({
  rhythmType,
  showFCValue,
  heartRate,
}) => {
  const alarmState = useAlarms(rhythmType as RhythmType, showFCValue, heartRate);

  const getRhythmLabel = (rhythm: string) => {
    switch (rhythm) {
      case 'fibrillationVentriculaire':
        return 'FIBRILLATION VENTRICULAIRE';
      case 'tachycardieVentriculaire':
        return 'TACHYCARDIE VENTRICULAIRE';
      case 'asystole':
        return 'ASYSTOLIE';
      case 'fibrillationAtriale':
        return 'FIBRILLATION ATRIALE';
      case 'bav1':
        return 'BAV DE TYPE I';
      case 'bav3':
        return 'BAV DE TYPE III';
      case 'electroEntrainement':
        return 'ENTRAINEMENT ELECTROSYSTOLIQUE';
      case 'sinusRhythm':
      case 'sinus':
      default:
        return 'RYTHME SINUSAL';
    }
  };

  const isCritical = ['fibrillationVentriculaire', 'tachycardieVentriculaire', 'asystole', 'fibrillationAtriale'].includes(rhythmType);

  if (!showFCValue) {
    return (
      <div style={{
        width: '100%',
        padding: '12px',
        backgroundColor: '#111',
        borderBottom: '2px solid #333',
        color: '#777',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '1.1em',
        letterSpacing: '1px',
        textTransform: 'uppercase'
      }}>
        Mode Veille - FC Masquée
      </div>
    );
  }

  if (isCritical) {
    const isRedBlink = rhythmType !== 'fibrillationAtriale'; // FA can be yellow/cyan warning, others are red critical
    const bgColor = alarmState.isBlinking 
      ? (isRedBlink ? '#ef4444' : '#eab308') 
      : '#000000';
    const textColor = alarmState.isBlinking ? '#ffffff' : (isRedBlink ? '#ef4444' : '#eab308');

    return (
      <div style={{
        width: '100%',
        padding: '12px',
        backgroundColor: bgColor,
        borderBottom: `2px solid ${isRedBlink ? '#ef4444' : '#eab308'}`,
        color: textColor,
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '1.2em',
        transition: 'background-color 0.1s ease, color 0.1s ease',
        letterSpacing: '2px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        zIndex: 999
      }}>
        ⚠️ ALARME : {getRhythmLabel(rhythmType)} ⚠️
      </div>
    );
  }

  // Normal sinus rhythm or non-critical pacing
  return (
    <div style={{
      width: '100%',
      padding: '12px',
      backgroundColor: '#111',
      borderBottom: '2px solid #22c55e',
      color: '#22c55e',
      textAlign: 'center',
      fontWeight: '600',
      fontSize: '1em',
      letterSpacing: '1.5px'
    }}>
      🟢 PARAMÈTRES PATIENT STABLES • {getRhythmLabel(rhythmType)}
    </div>
  );
};
