"use client";
import React from 'react';
import { useAlarms } from '../hooks/useAlarms';
import type { RhythmType } from './graphsdata/ECGRhythms';

interface AlarmBannerProps {
  rhythmType?: string;
  showFCValue?: boolean;
  heartRate?: number;
  minBpm?: number;
  maxBpm?: number;
  targetHR?: number;
  type?: 'ecg' | 'spo2';
  showPleth?: boolean;
  isScopeSpo2Alarm?: boolean;
  cosmeticSpo2?: number;
  minSpo2?: number;
  maxSpo2?: number;
}

export const AlarmBanner: React.FC<AlarmBannerProps> = ({
  rhythmType = 'normal',
  showFCValue = false,
  heartRate = 60,
  minBpm = 50,
  maxBpm = 120,
  targetHR,
  type = 'ecg',
  showPleth = false,
  isScopeSpo2Alarm = false,
  cosmeticSpo2 = 98,
  minSpo2 = 90,
  maxSpo2 = 100,
}) => {
  const isEcgType = type === 'ecg';
  const alarmState = useAlarms(
    rhythmType as RhythmType,
    isEcgType ? showFCValue : false,
    isEcgType ? heartRate : 60,
    isEcgType,
    isEcgType ? targetHR : undefined,
    isEcgType ? minBpm : 50,
    isEcgType ? maxBpm : 120,
    type,
    showPleth,
    cosmeticSpo2,
    minSpo2,
    maxSpo2
  );

  const isSpo2Alert = cosmeticSpo2 < minSpo2;

  if (type === 'spo2') {
    if (!alarmState.showAlarmBanner) return null;
    return (
      <div style={{ position: 'absolute', top: '45px', left: '500px', zIndex: 1000 }}>
        <span style={{
          display: 'inline-block',
          padding: '0px 50px',
          backgroundColor: alarmState.isBlinking ? '#ffd700' : '#000',
          color: alarmState.isBlinking ? '#000' : '#ffd700',
          fontWeight: 'bold',
          borderRadius: '2px',
          transition: 'background-color 0.1s, color 0.1s',
        }}>
          DESAT
        </span>
      </div>
    );
  }

  const isHrAlert = heartRate < minBpm || heartRate >= maxBpm;
  if (!alarmState.showAlarmBanner && !isHrAlert && rhythmType !== 'asystole') return null;
  if (!showFCValue) return null;

  let text = "ALARME";
  if (heartRate < minBpm && heartRate > 0) text = "BRADYCHARDIE";
  else if (rhythmType === 'fibrillationVentriculaire' || rhythmType === 'tachycardieVentriculaire' || heartRate >= maxBpm) text = "TACHYCARDIE";
  else if (rhythmType === 'asystole' || heartRate === 0) text = "ASYSTOLIE !";

  return (
    <div style={{ position: 'absolute', top: '45px', left: '20px', zIndex: 1000 }}>
      <span style={{
        display: 'inline-block',
        padding: '0px 70px',
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