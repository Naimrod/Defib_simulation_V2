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
  type?: 'ecg' | 'spo2' | 'resp' | 'bp';
  showPleth?: boolean;
  isScopeSpo2Alarm?: boolean;
  cosmeticSpo2?: number;
  minSpo2?: number;
  maxSpo2?: number;
  showResp?: boolean;
  cosmeticResp?: number;
  minResp?: number;
  maxResp?: number;
  showBP?: boolean;
  hasBpReading?: boolean;
  systolic?: number;
  minSysto?: number;
  maxSysto?: number;
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
  showResp = false,
  cosmeticResp = 15,
  minResp = 8,
  maxResp = 30,
  showBP = false,
  hasBpReading = false,
  systolic = 120,
  minSysto = 100,
  maxSysto = 140,
}) => {
  
  const alarmState = useAlarms(
    rhythmType as RhythmType,
    showFCValue, 
    heartRate, 
    true,
    targetHR,
    minBpm,
    maxBpm,
    type,
    showPleth,
    cosmeticSpo2,
    minSpo2,
    maxSpo2,
    showResp,
    cosmeticResp,
    minResp,
    maxResp,
    showBP,
    hasBpReading,
    systolic,
    minSysto,
    maxSysto
   );

  if (type === 'spo2') {
    if (!alarmState.showAlarmBanner) return null;
    return (
      <div style={{ pointerEvents: 'auto' }}>
        <span style={{
          display: 'inline-block',
          padding: '0px 50px',
          backgroundColor: alarmState.isBlinking ? 'black' : 'yellow',
          color: alarmState.isBlinking ? 'yellow' : 'black',
          fontWeight: 'bold',
          borderRadius: '2px',
          transition: 'background-color 0.1s, color 0.1s',
        }}>
          DESAT
        </span>
      </div>
    );
  }

  if (type === 'resp') {
    if (!alarmState.showAlarmBanner) return null;
    const isApnea = cosmeticResp < minResp || heartRate === 0;
    const bannerText = isApnea ? "APNÉE" : "HYPERPNÉE"; // Ajout des accents
    return (
      <div style={{ pointerEvents: 'auto' }}>
        <span style={{
          display: 'inline-block',
          padding: '0px 50px',
          backgroundColor: alarmState.isBlinking ? 'black' : 'blue',
          color: alarmState.isBlinking ? 'blue' : 'white',
          fontWeight: 'bold',
          borderRadius: '2px',
          transition: 'background-color 0.1s, color 0.1s',
        }}>
          {bannerText}
        </span>
      </div>
    );
  }

  if (type === 'bp') {
    if (!alarmState.showAlarmBanner) return null;
    const bannerText = systolic < minSysto ? "TA BASSE" : "TA HAUTE";
    return (
      <div style={{ pointerEvents: 'auto' }}>
        <span style={{
          display: 'inline-block',
          padding: '0px 50px',
          backgroundColor: alarmState.isBlinking ? 'black' : 'yellow',
          color: alarmState.isBlinking ? 'yellow' : 'black',
          fontWeight: 'bold',
          borderRadius: '2px',
          transition: 'background-color 0.1s, color 0.1s',
        }}>
          {bannerText}
        </span>
      </div>
    );
  }

  const isHrAlert = heartRate < minBpm || heartRate >= maxBpm;
  if (!alarmState.showAlarmBanner && !isHrAlert && rhythmType !== 'asystole') return null;
  if (!showFCValue) return null;

  let text = "ALARME";
  if (heartRate < minBpm && heartRate > 0) text = "BRADYCARDIE";
  else if (rhythmType === 'fibrillationVentriculaire' || rhythmType === 'tachycardieVentriculaire' || heartRate >= maxBpm) text = "TACHYCARDIE";
  else if (rhythmType === 'asystole' || heartRate === 0) text = "ASYSTOLIE !";

  return (
    <div style={{ pointerEvents: 'auto' }}>
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