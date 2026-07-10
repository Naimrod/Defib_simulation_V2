import React from 'react';
import { useAlarms } from '../hooks/useAlarms';
import { RhythmType } from './graphsdata/ECGRhythms';

interface Props {
  rhythmType: RhythmType;
  showFCValue: boolean;
  heartRate: number;
  minBpm: number;
  maxBpm: number;
}

export function AlarmBanner({ rhythmType, showFCValue, heartRate, minBpm, maxBpm }: Props) {
  const { isBlinking, showAlarmBanner } = useAlarms(rhythmType, showFCValue, heartRate);

  const isHrAlert = heartRate < minBpm || heartRate >= maxBpm;
  if (!showAlarmBanner && !isHrAlert && rhythmType !== 'asystole') return null;

  let text = "ALARME";
  if (heartRate < minBpm && heartRate > 0) text = "ALERTE : BRADYCARDIE";
  else if (rhythmType === 'fibrillationVentriculaire' || rhythmType === 'tachycardieVentriculaire' || heartRate >= maxBpm) text = "ALERTE : TACHYCARDIE";
  else if (rhythmType === 'asystole' || heartRate === 0) text = "ASYSTOLIE !";

  return (
    <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 1000 }}>
      <span style={{
        display: 'inline-block',
        padding: '10px 150px',
        backgroundColor: isBlinking ? 'red' : '#800000',
        color: isBlinking ? '#000' : '#fff',
        fontWeight: 'bold',
        borderRadius: '8px',
        transition: 'background-color 0.1s',
      }}>
        {text}
      </span>
    </div>
  );
}