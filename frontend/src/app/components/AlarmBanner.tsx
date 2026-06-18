// AlarmBanner.tsx
import React from 'react';
import { useAlarms } from '../hooks/useAlarms';
import { RhythmType } from './graphsdata/ECGRhythms';

interface Props {
  rhythmType: RhythmType | string;
  showFCValue: boolean;
  heartRate: number;
}

export function AlarmBanner({ rhythmType, showFCValue, heartRate }: Props) {
  const { isBlinking, showAlarmBanner } = useAlarms(rhythmType, showFCValue, heartRate);

  const isHrAlert = heartRate < 50 || heartRate > 130;
  if (!showAlarmBanner && !isHrAlert && rhythmType !== 'asysto') return null;

  let text = "ALARME";
  if (rhythmType === 'fibrillationVentriculaire' || heartRate < 50) text = "ALERTE : BRADYCARDIE";
else if (rhythmType === 'tachycardieVentriculaire' || heartRate > 130) text = "ALERTE : TACHYCARDIE";
else if (rhythmType === 'asystole') text = "ASYSTOLIE !";


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