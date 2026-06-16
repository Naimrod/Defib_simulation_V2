"use client";

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../../context/WebSocketContext';
import { RhythmType } from '../../components/graphsdata/ECGRhythms';

const InstructorRemote: React.FC = () => {
  const { lastMessage, isConnected, sendMessage } = useWebSocket();
  
  // Local tracking of patient state
  const [patientState, setPatientState] = useState({
      rhythm_type: 'sinus' as RhythmType,
      heartRate: 70,
      spo2: 100,
      respiratoryRate: 16,
      co2: 35,
      pulse: null as number | null,
      bloodPressure: { systolic: 120, diastolic: 80 }
  });

  // Local tracking of devices
  const [devices, setDevices] = useState<Record<string, any>>({});

  useEffect(() => {
      if (!lastMessage) return;

      const { type, source_device, session_id, ...payload } = lastMessage;

      if (type === "ecg") {
          setPatientState(prev => ({ ...prev, heartRate: payload.bpm ?? prev.heartRate, spo2: payload.spo2 ?? prev.spo2 }));
      } else if (type === "co2") {
          setPatientState(prev => ({ ...prev, co2: payload.co2 ?? prev.co2 }));
      } else if (type === "pressure") {
          setPatientState(prev => ({
              ...prev,
              bloodPressure: {
                  systolic: payload.systolic ?? prev.bloodPressure.systolic,
                  diastolic: payload.diastolic ?? prev.bloodPressure.diastolic
              }
          }));
      } else if (type === "respiration") {
          setPatientState(prev => ({ ...prev, respiratoryRate: payload.respirationRate ?? prev.respiratoryRate }));
      } else if (type === "rhythm") {
          setPatientState(prev => ({ ...prev, rhythm_type: payload.rhythm ?? prev.rhythm_type }));
      } else if (type === "defibrillator_state") {
          // A device broadcasted its state
          if (payload.device_id) {
              setDevices(prev => ({
                  ...prev,
                  [payload.device_id]: { ...(prev[payload.device_id] || {}), ...payload.state }
              }));
          }
      }
  }, [lastMessage]);


  if (!isConnected) {
    return <div className="p-10 text-white">Connecting to Session...</div>;
  }

  const handleRhythmChange = (type: string) => {
    setPatientState(prev => ({ ...prev, rhythm_type: type as RhythmType }));
    sendMessage({ type: "rhythm", rhythm: type, rhythmLabel: type });
  };

  const handleHrChange = (newHr: number) => {
    setPatientState(prev => ({ ...prev, heartRate: newHr }));
    sendMessage({ type: "ecg", bpm: newHr, spo2: patientState.spo2 });
  };

  const handleSpo2Change = (val: number) => {
    setPatientState(prev => ({ ...prev, spo2: val }));
    sendMessage({ type: "ecg", bpm: patientState.heartRate, spo2: val });
  };

  const handleRrChange = (val: number) => {
    setPatientState(prev => ({ ...prev, respiratoryRate: val }));
    sendMessage({ type: "respiration", respirationRate: val });
  };

  const handleCo2Change = (val: number) => {
    setPatientState(prev => ({ ...prev, co2: val }));
    sendMessage({ type: "co2", co2: val });
  };

  const handlePulseChange = (val: number | null) => {
    setPatientState(prev => ({ ...prev, pulse: val }));
    // Depending on if backend tracks pulse explicitly, you can send it here.
  };

  const handleBpChange = (s: number, d: number) => {
    setPatientState(prev => ({ ...prev, bloodPressure: { systolic: s, diastolic: d } }));
    sendMessage({ type: "pressure", systolic: s, diastolic: d });
  };

  const rhythms: { label: string, value: RhythmType }[] = [
    { label: 'Sinus', value: 'sinus' },
    { label: 'V-Fib', value: 'fibrillationVentriculaire' },
    { label: 'Asystole', value: 'asystole' },
    { label: 'V-Tach', value: 'tachycardieVentriculaire' },
    { label: 'A-Fib', value: 'fibrillationAtriale' },
    { label: 'BAV 1', value: 'bav1' },
    { label: 'BAV 3', value: 'bav3' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white font-sans">
      <h1 className="text-2xl font-bold mb-8 flex items-center gap-3">
        <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
        Instructor Control Panel
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Patient Control */}
        <div className="space-y-6">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
            <h2 className="text-lg font-semibold mb-6 text-blue-400 uppercase tracking-wider">Electric State</h2>
            
            <div className="space-y-8">
              <RemoteSlider 
                label="Heart Rate (ECG)" 
                value={patientState.heartRate} 
                min={0} max={220} unit="bpm"
                onChange={handleHrChange} 
              />

              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-500 uppercase">Cardiac Rhythm</label>
                <div className="grid grid-cols-3 gap-2">
                  {rhythms.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => handleRhythmChange(r.value)}
                      className={`p-2 text-xs rounded-lg border transition-all ${
                        patientState.rhythm_type === r.value 
                        ? 'bg-blue-600 border-blue-400 text-white font-bold' 
                        : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
            <h2 className="text-lg font-semibold mb-6 text-green-400 uppercase tracking-wider">Mechanical Vitals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <RemoteSlider label="SpO2" value={patientState.spo2} min={0} max={100} unit="%" color="blue" onChange={handleSpo2Change} />
              <RemoteSlider label="Resp. Rate" value={patientState.respiratoryRate} min={0} max={60} unit="rpm" color="green" onChange={handleRrChange} />
              <RemoteSlider label="CO2" value={patientState.co2} min={0} max={100} unit="mmHg" color="yellow" onChange={handleCo2Change} />
              <div className="space-y-4">
                <label className="block text-xs font-bold text-gray-500 uppercase text-center">Pulse (Mechanical)</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handlePulseChange(null)}
                    className={`flex-1 p-2 rounded text-[10px] font-bold ${patientState.pulse === null ? 'bg-blue-600' : 'bg-gray-700 text-gray-500'}`}
                  >
                    SYNC HR
                  </button>
                  <input 
                    type="number" 
                    value={patientState.pulse ?? patientState.heartRate}
                    onChange={(e) => handlePulseChange(parseInt(e.target.value))}
                    className="w-16 bg-gray-900 border border-gray-700 rounded px-2 text-center font-mono text-blue-400"
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-gray-700">
               <label className="block text-xs font-bold text-gray-500 uppercase mb-4">Blood Pressure</label>
               <div className="flex items-center gap-6">
                  <div className="flex-1 space-y-2 text-center">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Systolic</span>
                    <input type="range" min={40} max={220} value={patientState.bloodPressure.systolic} onChange={(e) => handleBpChange(parseInt(e.target.value), patientState.bloodPressure.diastolic)} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500" />
                    <p className="text-2xl font-bold">{patientState.bloodPressure.systolic}</p>
                  </div>
                  <div className="text-gray-600 text-3xl font-light">/</div>
                  <div className="flex-1 space-y-2 text-center">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Diastolic</span>
                    <input type="range" min={20} max={150} value={patientState.bloodPressure.diastolic} onChange={(e) => handleBpChange(patientState.bloodPressure.systolic, parseInt(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                    <p className="text-2xl font-bold">{patientState.bloodPressure.diastolic}</p>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Monitor Telemetry */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-500 uppercase tracking-wider px-2">Student View Telemetry</h2>
          
          {Object.entries(devices || {}).map(([id, dev]) => (
            <div key={id} className="bg-black/40 p-6 rounded-xl border border-gray-800 shadow-inner">
              <div className="flex justify-between items-center mb-6">
                <span className="text-blue-500 text-sm font-mono font-bold tracking-widest">{id}</span>
                <span className={`text-[10px] px-3 py-1 rounded-full font-black tracking-widest border ${
                  dev.display_mode === 'ARRET' ? 'border-gray-700 text-gray-600' : 'border-blue-500/50 text-blue-400'
                }`}>
                  {dev.display_mode?.toUpperCase() || 'INCONNU'}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800/50">
                  <p className="text-gray-600 text-[9px] uppercase font-black mb-1">Energy</p>
                  <p className="text-2xl font-bold text-white">{dev.energy === 10 ? '1-10' : dev.energy} <span className="text-[10px] font-normal">J</span></p>
                </div>
                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800/50">
                  <p className="text-gray-600 text-[9px] uppercase font-black mb-1">Shocks</p>
                  <p className="text-2xl font-bold text-white">{dev.shock_count}</p>
                </div>
                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800/50">
                  <p className="text-gray-600 text-[9px] uppercase font-black mb-1">PNI</p>
                  {dev.is_pni_measuring ? (
                    <div className="text-yellow-500 text-xs font-bold animate-pulse mt-2">({dev.pni_step_value})</div>
                  ) : (
                    <p className="text-xl font-bold text-white">{dev.show_pni ? 'ACTIVE' : 'HIDDEN'}</p>
                  )}
                </div>
              </div>

              {dev.display_mode === 'Stimulateur' && (
                <div className="mt-6 pt-6 border-t border-gray-800/50 grid grid-cols-3 gap-4">
                   <div className="text-center">
                     <p className="text-[9px] text-gray-500 font-bold uppercase">Freq</p>
                     <p className="text-lg font-bold">{dev.pacer_frequency}</p>
                   </div>
                   <div className="text-center border-x border-gray-800/50">
                     <p className="text-[9px] text-gray-500 font-bold uppercase">Intens</p>
                     <p className="text-lg font-bold">{dev.pacer_intensity} <span className="text-[10px]">mA</span></p>
                   </div>
                   <div className="flex items-center justify-center">
                     <div className={`w-3 h-3 rounded-full ${dev.is_pacing ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-gray-800'}`}></div>
                   </div>
                </div>
              )}
            </div>
          ))}

          {!Object.keys(devices || {}).length && (
            <div className="h-48 border-2 border-dashed border-gray-800 rounded-xl flex items-center justify-center text-gray-600 italic">
              Awaiting Student connection...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const RemoteSlider = ({ label, value, min, max, unit, onChange, color = "blue" }: any) => {
  const accentClass: Record<string, string> = {
    blue: "accent-blue-500 text-blue-400",
    green: "accent-green-500 text-green-400",
    yellow: "accent-yellow-500 text-yellow-400",
    red: "accent-red-500 text-red-400",
  };
  const activeClass = accentClass[color as keyof typeof accentClass];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-baseline">
        <label className="text-xs font-bold text-gray-500 uppercase">{label}</label>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-black ${activeClass.split(' ')[1]}`}>{value}</span>
          <span className="text-[10px] text-gray-500 font-bold">{unit}</span>
        </div>
      </div>
      <input 
        type="range" 
        min={min} max={max} 
        value={value} 
        onChange={(e) => onChange(parseInt(e.target.value))}
        className={`w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer ${activeClass.split(' ')[0]}`}
      />
    </div>
  );
};

export default InstructorRemote;
