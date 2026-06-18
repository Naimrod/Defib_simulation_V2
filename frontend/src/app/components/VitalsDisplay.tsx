import React, { useState, useEffect } from 'react';
import type { RhythmType } from './graphsdata/ECGRhythms';
import { useAlarms } from '../hooks/useAlarms';
import { useAudio } from '../context/AudioContext';
import { useWebSocket } from '../context/WebSocketContext';
import { PatientState, DefibState } from '@/types/simulation';

interface VitalsDisplayProps {
  patient: PatientState;
  device: DefibState;
  actions: {
    toggle: (key: 'fc' | 'vitals' | 'pni') => void;
    startPNIMeasurement: () => void;
  };
}

const VitalsDisplay: React.FC<VitalsDisplayProps> = ({
  patient,
  device,
  actions,
}) => {
  const { lastMessage } = useWebSocket();
  const [fibBlink, setFibBlink] = useState(false);
  const audioService = useAudio();

  // Local derived values for cleaner JSX
  const rhythmType = patient.rhythm_type as RhythmType;
  const heartRate = patient.heart_rate;
  const bloodPressure = patient.blood_pressure;
  
  const showFCValue = device.show_fc;
  const showVitalSigns = device.show_vitals;
  const showPNIValues = device.show_pni;
  const isPNIMeasuring = device.is_pni_measuring;
  const pniStepValue = device.pni_step_value;

  const alarms = useAlarms(rhythmType, showFCValue, heartRate);

  const computeMAP = (sys: number, dia: number, map?: number) => {
    if (typeof map === 'number') return Math.round(map);
    return Math.round(dia + (sys - dia) / 3);
  };

  // Fib Blink Logic
  useEffect(() => {
    if (rhythmType === 'fibrillationVentriculaire' || rhythmType === 'fibrillationAtriale') {
      const i = setInterval(() => setFibBlink((p) => !p), 500);
      return () => clearInterval(i);
    }
  }, [rhythmType]);

  // Audio Sync for PNI (Server handles state, client handles sounds)
  const prevIsPNIMeasuring = React.useRef(isPNIMeasuring);
  const prevLastAction = React.useRef<string | null>(null);

  useEffect(() => {
    if (isPNIMeasuring && !prevIsPNIMeasuring.current) {
        audioService.playCuffInflation?.();
    } else if (!isPNIMeasuring && prevIsPNIMeasuring.current) {
        audioService.stopCuffInflation?.();
    }

    if (lastMessage?.type === "defibrillator_action" && lastMessage?.action === "pni_done" && lastMessage?.action !== prevLastAction.current) {
        audioService.playBPDone?.();
    }

    prevIsPNIMeasuring.current = isPNIMeasuring;
    prevLastAction.current = lastMessage?.action || null;
  }, [isPNIMeasuring, audioService, lastMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { audioService.stopCuffInflation?.(); } catch {}
    };
  }, [audioService]);

  return (
    <div className="h-1/4 border-b border-gray-600 flex items-center text-sm bg-black px-2">
      {/* FC Section */}
      <div
        className="flex flex-col items-center w-24 cursor-pointer hover:bg-gray-800 p-2 rounded transition-colors"
        onClick={() => actions.toggle('fc')}
      >
        {showFCValue && (rhythmType === 'fibrillationVentriculaire' || rhythmType === 'fibrillationAtriale') ? (
          <div className="flex items-center justify-center -ml-9">
            <div className={`px-5 py-0.2 ${fibBlink ? 'bg-red-600' : 'bg-white'}`}>
              <span className={`text-xs font-bold ${fibBlink ? 'text-white' : 'text-red-600'}`}>
                {rhythmType === 'fibrillationVentriculaire' ? 'Fib.V' : 'Fib.A'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-row items-center gap-x-2">
            <div className="text-gray-400 text-xs">FC</div>
            <div className="text-gray-400 text-xs">bpm</div>
          </div>
        )}
        <div className="flex flex-row items-center gap-x-2">
          <div className="text-green-400 text-4xl font-bold w-[65px] text-center">
           {showFCValue
            ? (rhythmType === 'fibrillationVentriculaire' ? alarms.heartRate : (rhythmType === 'asystole' ? '0' : heartRate))
            : '--'}
          </div>
          <div className="flex flex-col items-center w-8">
            <div className="text-green-400 text-xs text-center">120</div>
            <div className="text-green-400 text-xs text-center">50</div>
          </div>
        </div>
      </div>

      {/* SpO2 & Pouls Section */}
      <div
        className="flex flex-row items-center gap-4 cursor-pointer hover:bg-gray-800 p-2 rounded transition-colors"
        onClick={() => actions.toggle('vitals')}
      >
        {/* SpO2 */}
        <div className="flex flex-col items-center w-28">
          <div className="flex flex-row items-center gap-x-2">
            <div className="text-blue-400 text-2xl font-bold">SpO2</div>
            <div className="text-blue-400 text-xs">%</div>
          </div>
          <div className="flex flex-row items-center gap-x-2">
            <div className="text-blue-400 text-4xl font-bold min-w-[60px] text-center -mt-2">
              {['fibrillationVentriculaire', 'tachycardieVentriculaire', 'asystole'].includes(rhythmType)
                ? '--'
                : (showVitalSigns ? (patient.spo2 ?? '92') : '--')}
            </div>
            <div className="flex flex-col items-center w-8">
              <div className="text-blue-400 text-xs">100</div>
              <div className="text-blue-400 text-xs">90</div>
            </div>
          </div>
        </div>

        {/* Pouls */}
        <div className="flex flex-row items-center w-28">
          <div className="flex flex-col items-center">
            <div className="text-blue-400 text-xs">Pouls</div>
            <div className="text-blue-400 text-4xl font-bold min-w-[60px] text-center">
              {['fibrillationVentriculaire', 'tachycardieVentriculaire', 'asystole', 'fibrillationAtriale'].includes(rhythmType)
                ? '--'
                : (showVitalSigns ? (patient.pulse ?? heartRate) : '--')}
            </div>
          </div>
          <div className="flex flex-col items-center w-8 ml-2">
            <div className="text-blue-400 text-xs mb-2">bpm</div>
            <div className="text-blue-400 text-xs">120</div>
            <div className="text-blue-400 text-xs">50</div>
          </div>
        </div>
      </div>

      {/* PNI Section */}
      <div
        className={`flex flex-col items-center w-45 cursor-pointer hover:bg-gray-800 p-2 rounded transition-colors ${
          isPNIMeasuring ? 'animate-pulse' : ''
        }`}
        onClick={actions.startPNIMeasurement}
        role="button"
        title="Prendre la tension"
      >
        <div className="flex flex-row items-center gap-x-2" onClick={(e) => { e.stopPropagation(); actions.toggle('pni'); }}>
          <div className="text-white text-xs font-bold">PNI</div>
          <div className="text-white text-xs font-bold w-12 text-center">
            {isPNIMeasuring ? 'Auto' : 'Manuel'}
          </div>
          <div className="text-white text-xs font-bold">10:20</div>
          <div className="text-white text-xs font-bold">mmHg</div>
        </div>
        <div className="flex flex-row items-center gap-x-1 mt-1">
          <div className="text-white text-4xl min-w-[100px] text-center">
            {rhythmType === 'fibrillationVentriculaire' ? '-?-' : (isPNIMeasuring ? '--' : (showPNIValues ? `${bloodPressure.systolic}/${bloodPressure.diastolic}` : '--'))}
          </div>

          <div className="text-white text-xs min-w-[30px] text-center">
            {rhythmType === 'fibrillationVentriculaire' ? '' : (isPNIMeasuring ? `(${pniStepValue})` : (showPNIValues ? `(${computeMAP(bloodPressure.systolic, bloodPressure.diastolic, bloodPressure.map ?? undefined)})` : ''))}
          </div>

          <div className="flex flex-col items-center w-8">
            <div className="text-white text-xs">MOY</div>
            <div className="text-white text-xs">110</div>
            <div className="text-white text-xs">50</div>
          </div>
        </div>
      </div>

      {/* CO2 & FR Section */}
      <div className="flex flex-row items-center gap-x-6 ">
        <div className="flex flex-col items-center w-20">
          <div className="flex flex-row items-center gap-x-1 mb-3">
            <div className="text-white text-xs font-bold">CO2ie</div>
            <div className="text-white text-xs font-bold">mmHg</div>
          </div>
          <div className="flex flex-row items-center">
            <div className="text-yellow-400 text-4xl font-bold min-w-[50px] text-center">
              {['fibrillationVentriculaire', 'fibrillationAtriale'].includes(rhythmType) ? '-?-' : (showVitalSigns ? (patient.co2 ?? '--') : '--')}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center w-20">
          <div className="flex flex-row items-center gap-x-1">
            <div className="text-white text-xs font-bold">FR</div>
            <div className="text-white text-xs font-bold">rpm</div>
          </div>
          <div className="flex flex-row items-center">
            <div className="text-yellow-400 text-4xl font-bold min-w-[50px] text-center">
              {['fibrillationVentriculaire', 'fibrillationAtriale'].includes(rhythmType) ? '-?-' : (showVitalSigns ? (patient.respiratory_rate ?? '--') : '--')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VitalsDisplay;
