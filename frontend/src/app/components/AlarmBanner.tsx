"use client";
import React from 'react';
import { useAlarms } from '../hooks/useAlarms';
import type { RhythmType } from './graphsdata/ECGRhythms';

interface AlarmBannerProps {
  rhythmType: string;
  showFCValue: boolean;
  heartRate: number;
  minBpm: number;
  maxBpm: number;
  targetHR?: number;
}

export const AlarmBanner: React.FC<AlarmBannerProps> = ({
  rhythmType,
  showFCValue,
  heartRate,
  minBpm,
  maxBpm,
  targetHR,
}) => {
  const alarmState = useAlarms(rhythmType as RhythmType, showFCValue, heartRate, true, targetHR, minBpm, maxBpm);

  const isHrAlert = heartRate < minBpm || heartRate >= maxBpm;
  if (!alarmState.showAlarmBanner && !isHrAlert && rhythmType !== 'asystole') return null;
  if (!showFCValue) return null;

  let text = "ALARME";
  if (heartRate < minBpm && heartRate > 0) text = "ALERTE : FAIBLE";
  else if (rhythmType === 'fibrillationVentriculaire' || rhythmType === 'tachycardieVentriculaire' || heartRate >= maxBpm) text = "ALERTE : TACHYCARDIE";
  else if (rhythmType === 'asystole' || heartRate === 0) text = "ASYSTOLIE !";

  return (
    <div style={{ position: 'absolute', top: '45px', left: '20px', zIndex: 1000 }}>
      <span style={{
        display: 'inline-block',
        padding: '0px 150px',
        backgroundColor: alarmState.isBlinking ? '#fff' : 'red',
        color: alarmState.isBlinking ? 'red' : '#fff',
        fontWeight: 'bold',
        borderRadius: '2px',
        transition: 'background-color 0.1s',
      }}>
        {text}
      </span>
    </div>
  );
};