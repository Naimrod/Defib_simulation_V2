"use client";

import React from 'react';
import { useWebSocket } from '../../context/WebSocketContext';

const DashboardPage: React.FC = () => {
  const { state, isConnected } = useWebSocket();

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#0B1222] flex items-center justify-center text-white font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl">Establishing WebSocket Handshake...</p>
        </div>
      </div>
    );
  }

  const patient = state?.patient_state;
  const devices = Object.entries(state?.devices || {});

  return (
    <div className="min-h-screen bg-[#060a12] p-6 text-gray-300 font-mono text-sm">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Top Bar: Engine & Session Metadata */}
        <div className="flex justify-between items-center bg-gray-900/50 p-4 rounded-lg border border-gray-800">
          <div className="flex gap-8">
            <div>
              <span className="text-gray-500 uppercase text-[10px] font-bold block mb-1">Session ID</span>
              <span className="text-blue-400 font-bold">{state?.session_id}</span>
            </div>
            <div>
              <span className="text-gray-500 uppercase text-[10px] font-bold block mb-1">Global Engine Time</span>
              <span className="text-white">{state?.global_time.toFixed(2)}s</span>
            </div>
            <div>
              <span className="text-gray-500 uppercase text-[10px] font-bold block mb-1">Last Server Event</span>
              <span className="text-yellow-500 font-bold">{state?.last_event || "NONE"}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-end">
                <span className="text-gray-500 uppercase text-[10px] font-bold">Socket Status</span>
                <span className="text-green-500 font-bold">CONNECTED</span>
             </div>
             <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          
          {/* Left Panel: Patient Physics Engine State */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <SectionHeader title="Patient State (authoritative)" color="text-blue-400" />
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="p-4 bg-gray-800/30 border-b border-gray-800 flex justify-between">
                <span>Vitals Matrix</span>
                <span className="text-blue-500/50">10Hz Stream</span>
              </div>
              <div className="p-5 grid grid-cols-2 gap-y-6 gap-x-4">
                <DebugMetric label="heart_rate" value={patient?.heart_rate} unit="bpm" />
                <DebugMetric label="rhythm_type" value={patient?.rhythm_type} color="text-green-400" />
                <DebugMetric label="spo2" value={patient?.spo2} unit="%" />
                <DebugMetric label="respiratory_rate" value={patient?.respiratory_rate} unit="rpm" />
                <DebugMetric label="co2" value={patient?.co2} unit="mmHg" />
                <div className="col-span-2 space-y-2 pt-2 border-t border-gray-800/50">
                   <p className="text-gray-500 text-[10px] uppercase font-bold">blood_pressure (complex)</p>
                   <div className="grid grid-cols-3 gap-2">
                      <div className="bg-black/40 p-2 rounded">
                        <p className="text-[9px] text-gray-600">SYS</p>
                        <p className="text-lg font-bold text-white">{patient?.blood_pressure?.systolic}</p>
                      </div>
                      <div className="bg-black/40 p-2 rounded">
                        <p className="text-[9px] text-gray-600">DIA</p>
                        <p className="text-lg font-bold text-white">{patient?.blood_pressure?.diastolic}</p>
                      </div>
                      <div className="bg-black/40 p-2 rounded">
                        <p className="text-[9px] text-gray-600">MAP</p>
                        <p className="text-lg font-bold text-blue-400">{patient?.blood_pressure?.map?.toFixed(1)}</p>
                      </div>
                   </div>
                </div>
              </div>
            </div>

            <SectionHeader title="Raw JSON State" color="text-gray-500" />
            <div className="bg-black rounded-xl border border-gray-800 p-4 h-[300px] overflow-auto">
                <pre className="text-[10px] text-gray-500 leading-tight">
                    {JSON.stringify(state, null, 2)}
                </pre>
            </div>
          </div>

          {/* Right Panel: Device Telemetry */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <SectionHeader title="Connected Devices Telemetry" color="text-green-400" />
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {devices.map(([id, dev]) => (
                <div key={id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col">
                   <div className="p-4 bg-gray-800/30 border-b border-gray-800 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                         <span className="font-bold text-white">{id}</span>
                         <span className="text-[10px] bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30 uppercase tracking-tighter">
                            {dev.display_mode}
                         </span>
                      </div>
                      <div className="flex gap-2">
                        {dev.is_charging && <StatusTag label="CHARGING" color="bg-yellow-900/40 text-yellow-500 border-yellow-500/50 pulse" />}
                        {dev.is_charged && <StatusTag label="CHARGED" color="bg-red-900/40 text-red-500 border-red-500/50" />}
                        {dev.is_pacing && <StatusTag label="PACING" color="bg-green-900/40 text-green-500 border-green-500/50" />}
                        {dev.is_synchro_mode && <StatusTag label="SYNC" color="bg-purple-900/40 text-purple-500 border-purple-500/50" />}
                      </div>
                   </div>

                   <div className="p-5 grid grid-cols-3 gap-6 flex-grow">
                      <div className="space-y-4">
                         <DebugMetric label="energy_setting" value={dev.energy === 10 ? '1-10' : dev.energy} unit="J" />
                         <DebugMetric label="shock_count" value={dev.shock_count} />
                      </div>
                      
                      <div className="space-y-4 border-l border-gray-800/50 pl-6">
                         <p className="text-gray-600 text-[9px] uppercase font-bold mb-2">Internal State</p>
                         <BooleanRow label="is_charging" value={dev.is_charging} />
                         <BooleanRow label="is_charged" value={dev.is_charged} />
                         <BooleanRow label="is_synchro" value={dev.is_synchro_mode} />
                         <BooleanRow label="is_pacing" value={dev.is_pacing} />
                         <BooleanRow label="is_pni_measuring" value={dev.is_pni_measuring} />
                      </div>

                      <div className="space-y-4 border-l border-gray-800/50 pl-6 bg-black/20 p-2 rounded">
                         <p className="text-gray-600 text-[9px] uppercase font-bold mb-2">Registers</p>
                         <DebugMetric label="pacer_mode" value={dev.pacer_mode} size="text-sm" />
                         <DebugMetric label="pacer_freq" value={dev.pacer_frequency} unit="ppm" size="text-sm" />
                         <DebugMetric label="pacer_mA" value={dev.pacer_intensity} unit="mA" size="text-sm" />
                         <DebugMetric label="pni_step" value={dev.pni_step_value} unit="mmHg" size="text-sm" color="text-yellow-500" />
                      </div>
                   </div>
                </div>
              ))}

              {devices.length === 0 && (
                <div className="col-span-2 h-48 border-2 border-dashed border-gray-800 rounded-xl flex items-center justify-center text-gray-600 italic">
                  No active devices in this session registry...
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <style jsx global>{`
        .pulse { animation: pulse-opacity 1s infinite; }
        @keyframes pulse-opacity { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
};

const SectionHeader = ({ title, color }: { title: string, color: string }) => (
  <h2 className={`text-[11px] font-black uppercase tracking-[0.2em] ${color} flex items-center gap-2`}>
    <span className="w-2 h-2 bg-current rounded-full"></span>
    {title}
  </h2>
);

const DebugMetric = ({ label, value, unit = "", color = "text-white", size = "text-xl" }: any) => (
  <div>
    <p className="text-gray-600 text-[9px] uppercase font-bold mb-0.5">{label}</p>
    <div className="flex items-baseline gap-1">
      <span className={`${size} font-black ${color}`}>{value ?? "NULL"}</span>
      <span className="text-gray-500 text-[10px]">{unit}</span>
    </div>
  </div>
);

const BooleanRow = ({ label, value }: { label: string, value: boolean }) => (
  <div className="flex justify-between items-center text-[10px]">
    <span className="text-gray-500">{label}</span>
    <span className={`font-bold ${value ? 'text-green-500' : 'text-gray-700'}`}>
      {value ? 'TRUE' : 'FALSE'}
    </span>
  </div>
);

const StatusTag = ({ label, color }: { label: string, color: string }) => (
  <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${color}`}>
    {label}
  </span>
);

export default DashboardPage;
