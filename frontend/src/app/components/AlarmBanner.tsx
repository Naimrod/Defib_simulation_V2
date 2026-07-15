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
  type?: 'ecg' | 'spo2' | 'resp';
  showPleth?: boolean;
  isScopeSpo2Alarm?: boolean;
  cosmeticSpo2?: number;
  minSpo2?: number;
  maxSpo2?: number;
  showResp?: boolean;
  cosmeticResp?: number;
  minResp?: number;
  maxResp?: number;
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
}) => {
  const isEcgType = type === 'ecg';
  const alarmState = useAlarms(
    rhythmType as RhythmType,
    isEcgType ? showFCValue : false,
    isEcgType ? heartRate : 60,
    true,
    isEcgType ? targetHR : undefined,
    isEcgType ? minBpm : 50,
    isEcgType ? maxBpm : 120,
    type,
    showPleth,
    cosmeticSpo2,
    minSpo2,
    maxSpo2,
    showResp,
    cosmeticResp,
    minResp,
    maxResp
  );

  const isSpo2Alert = cosmeticSpo2 < minSpo2;
  const isRespAlert = cosmeticResp < minResp || cosmeticResp >= maxResp;

  if (type === 'spo2') {
    if (!alarmState.showAlarmBanner) return null;
    return (
      <div style={{ position: 'absolute', top: '45px', left: '500px', zIndex: 1000 }}>
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
    const isApnea = cosmeticResp < minResp;
    const bannerText = isApnea ? "APNEE" : "HYPERPNEE";
    return (
      <div style={{ position: 'absolute', top: '45px', left: '720px', zIndex: 1000 }}>
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