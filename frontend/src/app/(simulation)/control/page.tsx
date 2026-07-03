"use client";

import React, { useState, useEffect } from "react";
import ControlPanel from "../../components/ControlPanel";
import { useWebSocket } from "../../context/WebSocketContext";

export default function ControlPage() {
  const { sendMessage, sessionId, lastMessage } = useWebSocket();

  // --- États des constantes ---
  const [scenarioId, setScenarioId] = useState<string>("Aucun");
  const [showHints, setShowHints] = useState<boolean>(false);
  const [rhythm, setRhythm] = useState<string>("sinusal");
  const [rhythmLabel, setRhythmLabel] = useState<string>("Sinusal");
  const [hrDotted, setHrIsDotted] = useState<boolean>(true);
  const [pressureDotted, setPressureIsDotted] = useState<boolean>(true);
  const [co2Dotted, setCo2IsDotted] = useState<boolean>(true);
  const [starting, setStart] = useState<boolean>(false);
  const [isRemoteControl, setIsRemoteControl] = useState<boolean>(true);

  const [hrDefibDotted, setHrDefibDotted] = useState<boolean>(true);
  const [pressureDefibDotted, setPressureDefibDotted] = useState<boolean>(true);
  const [co2DefibDotted, setCo2DefibDotted] = useState<boolean>(true);
  const [isDefibRemoteControl, setIsDefibRemoteControl] = useState<boolean>(true);

  const [bpm, setBpm] = useState<number>(70);
  const [spo2, setSpo2] = useState<number>(98);
  const [co2, setCo2] = useState<number>(40);
  const [systolic, setSystolic] = useState<number>(120);
  const [diastolic, setDiastolic] = useState<number>(80);
  const [respiration, setRespiration] = useState<number>(15);

  // --- Authoritative Sync Listener ---
  useEffect(() => {
    if (!lastMessage) return;
    const msg = lastMessage as any;
    if (msg.type === "sync_state") {
      const patient = msg.patient || {};
      const device = msg.device || {};
      
      if (patient.rhythmType) {
        const canonicalRhythm = patient.rhythmType;
        const rhythmMapInverse: Record<string, { value: string, label: string }> = {
          'sinusRhythm': { value: 'sinusal', label: 'Sinusal' },
          'sinus': { value: 'sinusal', label: 'Sinusal' },
          'sinusal': { value: 'sinusal', label: 'Sinusal' },
          'fibrillationVentriculaire': { value: 'fv', label: 'Fibrillation Ventriculaire' },
          'fv': { value: 'fv', label: 'Fibrillation Ventriculaire' },
          'tachycardieVentriculaire': { value: 'tv_1', label: 'Tachycardie Ventriculaire' },
          'tv_1': { value: 'tv_1', label: 'Tachycardie Ventriculaire' },
          'tv_2': { value: 'tv_2', label: 'Tachycardie Ventriculaire' },
          'asystole': { value: 'asysto', label: 'Asystolie' },
          'asysto': { value: 'asysto', label: 'Asystolie' },
          'arret': { value: 'asysto', label: 'Asystolie' },
          'fibrillationAtriale': { value: 'fib_a', label: 'Fibrillation Atriale' },
          'fib_a': { value: 'fib_a', label: 'Fibrillation Atriale' },
          'bav1': { value: '1_bav', label: 'BAV I' },
          '1_bav': { value: '1_bav', label: 'BAV I' },
          'bav3': { value: '3_bav', label: 'BAV III' },
          '3_bav': { value: '3_bav', label: 'BAV III' },
          'electroEntrainement': { value: 'stim', label: 'Entrainement' },
          'stim': { value: 'stim', label: 'Entrainement' }
        };
        const info = rhythmMapInverse[canonicalRhythm];
        if (info) {
          setRhythm(info.value);
          setRhythmLabel(info.label);
        } else {
          setRhythm(canonicalRhythm);
          setRhythmLabel(canonicalRhythm);
        }
      }
      
      if (patient.heartRate !== undefined) setBpm(patient.heartRate);
      if (patient.spo2 !== undefined) setSpo2(patient.spo2);
      if (patient.co2 !== undefined) setCo2(patient.co2);
      if (patient.bloodPressure?.systolic !== undefined) setSystolic(patient.bloodPressure.systolic);
      if (patient.bloodPressure?.diastolic !== undefined) setDiastolic(patient.bloodPressure.diastolic);
      if (patient.respiratoryRate !== undefined) setRespiration(patient.respiratoryRate);
      
      if (device.hrDotted !== undefined) setHrIsDotted(device.hrDotted);
      if (device.pressureDotted !== undefined) setPressureIsDotted(device.pressureDotted);
      if (device.co2Dotted !== undefined) setCo2IsDotted(device.co2Dotted);
      if (device.defibHrDotted !== undefined) setHrDefibDotted(device.defibHrDotted);
      if (device.defibPressureDotted !== undefined) setPressureDefibDotted(device.defibPressureDotted);
      if (device.defibCo2Dotted !== undefined) setCo2DefibDotted(device.defibCo2Dotted);
      if (device.isRemoteControl !== undefined) setIsRemoteControl(device.isRemoteControl);
      if (device.isDefibRemoteControl !== undefined) setIsDefibRemoteControl(device.isDefibRemoteControl);

      if (msg.scenario) {
        setScenarioId(msg.scenario.scenario_id || "Aucun");
        setShowHints(msg.scenario.show_hints || false);
      } else {
        setScenarioId("Aucun");
        setShowHints(false);
      }
    } else if (msg.type === "scenario") {
      if (msg.action === "start") {
        setScenarioId(msg.scenario_id || "Aucun");
        setShowHints(msg.show_hints || false);
      } else if (msg.action === "stop" || msg.action === "fail" || msg.action === "complete") {
        setShowHints(false);
      } else if (msg.action === "toggle_hints") {
        setShowHints(msg.show_hints || false);
      }
    } else if (msg.type === "rhythm") {
      const rhythmMapInverse: Record<string, { value: string, label: string }> = {
        'sinusRhythm': { value: 'sinusal', label: 'Sinusal' },
        'sinus': { value: 'sinusal', label: 'Sinusal' },
        'sinusal': { value: 'sinusal', label: 'Sinusal' },
        'fibrillationVentriculaire': { value: 'fv', label: 'Fibrillation Ventriculaire' },
        'fv': { value: 'fv', label: 'Fibrillation Ventriculaire' },
        'tachycardieVentriculaire': { value: 'tv_1', label: 'Tachycardie Ventriculaire' },
        'tv_1': { value: 'tv_1', label: 'Tachycardie Ventriculaire' },
        'tv_2': { value: 'tv_2', label: 'Tachycardie Ventriculaire' },
        'asystole': { value: 'asysto', label: 'Asystolie' },
        'asysto': { value: 'asysto', label: 'Asystolie' },
        'arret': { value: 'asysto', label: 'Asystolie' },
        'fibrillationAtriale': { value: 'fib_a', label: 'Fibrillation Atriale' },
        'fib_a': { value: 'fib_a', label: 'Fibrillation Atriale' },
        'bav1': { value: '1_bav', label: 'BAV I' },
        '1_bav': { value: '1_bav', label: 'BAV I' },
        'bav3': { value: '3_bav', label: 'BAV III' },
        '3_bav': { value: '3_bav', label: 'BAV III' },
        'electroEntrainement': { value: 'stim', label: 'Entrainement' },
        'stim': { value: 'stim', label: 'Entrainement' }
      };
      const info = rhythmMapInverse[msg.rhythm];
      if (info) {
        setRhythm(info.value);
        setRhythmLabel(info.label);
      } else {
        setRhythm(msg.rhythm);
        setRhythmLabel(msg.rhythmLabel || msg.rhythm);
      }
    } else if (msg.type === "ecg") {
      if (msg.bpm !== undefined) setBpm(msg.bpm);
      if (msg.spo2 !== undefined) setSpo2(msg.spo2);
    } else if (msg.type === "co2") {
      if (msg.co2 !== undefined) setCo2(msg.co2);
    } else if (msg.type === "pressure") {
      if (msg.systolic !== undefined) setSystolic(msg.systolic);
      if (msg.diastolic !== undefined) setDiastolic(msg.diastolic);
    } else if (msg.type === "respiration") {
      if (msg.respirationRate !== undefined) setRespiration(msg.respirationRate);
    } else if (msg.type === "HRscope") {
      if (msg.isHRDotted !== undefined) setHrIsDotted(msg.isHRDotted);
    } else if (msg.type === "Prscope") {
      if (msg.isPressureDotted !== undefined) setPressureIsDotted(msg.isPressureDotted);
    } else if (msg.type === "COscope") {
      if (msg.isCO2Dotted !== undefined) setCo2IsDotted(msg.isCO2Dotted);
    } else if (msg.type === "visibility_state") {
      if (msg.hrDotted !== undefined) setHrIsDotted(msg.hrDotted);
      if (msg.pressureDotted !== undefined) setPressureIsDotted(msg.pressureDotted);
      if (msg.co2Dotted !== undefined) setCo2IsDotted(msg.co2Dotted);
      if (msg.defibHrDotted !== undefined) setHrDefibDotted(msg.defibHrDotted);
      if (msg.defibPressureDotted !== undefined) setPressureDefibDotted(msg.defibPressureDotted);
      if (msg.defibCo2Dotted !== undefined) setCo2DefibDotted(msg.defibCo2Dotted);
      if (msg.isRemoteControl !== undefined) setIsRemoteControl(msg.isRemoteControl);
      if (msg.isDefibRemoteControl !== undefined) setIsDefibRemoteControl(msg.isDefibRemoteControl);
    } else if (msg.type === "display_mode") {
      if (msg.dataType === "defib" && msg.isRemoteControl !== undefined) setIsDefibRemoteControl(msg.isRemoteControl);
      else if (msg.isRemoteControl !== undefined) setIsRemoteControl(msg.isRemoteControl);
    }
  }, [lastMessage]);

  // --- Envoi de commandes via Context ---
  const sendECG = (overrideBpm?: number, overrideSpo2?: number) => {
    sendMessage({
      type: "ecg",
      simuType: "control_panel",
      dataType: "sensor",
      bpm: overrideBpm !== undefined ? overrideBpm : bpm,
      spo2: overrideSpo2 !== undefined ? overrideSpo2 : spo2,
    });
  };

  const sendCO2 = () => sendMessage({ type: "co2", simuType: "control_panel", dataType: "sensor", co2 });

  const sendPressure = (overrideSys?: number, overrideDia?: number) => {
    sendMessage({
      type: "pressure",
      simuType: "control_panel",
      dataType: "sensor",
      systolic: overrideSys !== undefined ? overrideSys : systolic,
      diastolic: overrideDia !== undefined ? overrideDia : diastolic,
    });
  };

  const sendRespiration = () => sendMessage({ type: "respiration", simuType: "control_panel", dataType: "sensor", respirationRate: respiration });

  const sendRhythm = (overrideRhythm?: string, overrideLabel?: string) => {
    sendMessage({
      type: "rhythm",
      simuType: "control_panel",
      dataType: "sensor",
      rhythm: overrideRhythm ?? rhythm,
      rhythmLabel: overrideLabel ?? rhythmLabel,
    });
      if (rhythm === "tachy_a") {
        setBpm(150);
        sendECG(150, 0);
      } else if (rhythm === "tsv") {
        setBpm(180);
        sendECG(180, 0);
      } else if (rhythm === "jonctionnel") {
        setBpm(130);
        sendECG(130, 0);
      } else if (rhythm === "flutter atriale") {
          setBpm(200);
          sendECG(300, 0);
      } else if (rhythm === "idioventriculaire") {
        setBpm(35);
        sendECG(35, 0);
      } else if (rhythm === "tvType2") {
        setBpm(160);
        sendECG(160, 0);
      }
    };
  
  
  const handleScenarioSelect = (id: string) => {
    setScenarioId(id);
    sendMessage({
        type: "scenario",
        action: "start",
        scenario_id: id
    });
  };
  const handleToggleHints = (val: boolean) => {
    setShowHints(val);
    sendMessage({
      type: "scenario",
      action: "toggle_hints",
      show_hints: val
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("username");
    window.location.href = "/";
  };

  const broadcastHRDotted = (val: boolean) => {
    console.log("[ControlPage] Broadcasting HR Dotted visibility:", val);
    sendMessage({ 
      type: "HRscope", 
      simuType: "control_panel", 
      dataType: "scope", 
      isHRDotted: val, 
      timestamp: new Date().toISOString() 
    });
  };

  const sendControlMode = (mode: boolean) => {
    console.log("[ControlPage] Broadcasting Display Mode", mode)
  sendMessage({ 
    type: "display_mode", 
    simuType: "control_panel", 
    isRemoteControl: mode, 
    timestamp: new Date().toISOString() 
  });
};

  const broadcastPressureDotted = (val: boolean) => {
    console.log("[ControlPage] Broadcasting Pressure Dotted visibility:", val);
    sendMessage({ 
      type: "Prscope", 
      simuType: "control_panel", 
      dataType: "scope", 
      isPressureDotted: val, 
      timestamp: new Date().toISOString() 
    });
  };

  const broadcastCo2Dotted = (val: boolean) => {
    console.log("[ControlPage] Broadcasting CO2 Dotted visibility:", val);
    sendMessage({ 
      type: "COscope", 
      simuType: "control_panel", 
      dataType: "scope", 
      isCO2Dotted: val, 
      timestamp: new Date().toISOString() 
    });
  };

  const broadcastDefibHRDotted = (val: boolean) => sendMessage({ type: "HRscope", simuType: "control_panel", dataType: "defib", isDefibHRDotted: val });
  const broadcastDefibPressureDotted = (val: boolean) => sendMessage({ type: "Prscope", simuType: "control_panel", dataType: "defib", isDefibPressureDotted: val });
  const broadcastDefibCO2Dotted = (val: boolean) => sendMessage({ type: "COscope", simuType: "control_panel", dataType: "defib", isDefibCO2Dotted: val });
  const broadcastDefibControlMode = (mode: boolean) => sendMessage({ type: "display_mode", simuType: "control_panel", dataType: "defib", isRemoteControl: mode });

  const sendStart = () => {
  if (starting) {
    sendMessage({ type: "simu_start", action: "stopping" });
    setStart(false);
  } else {
    sendMessage({ type: "simu_start", action: "starting" });
    setStart(true);
  }
};

  const sendLogDemand = () => {
  sendMessage({ 
    type: "demandlog" ,
    dataType: "control"
  });
};

  return (
    <ControlPanel
      username={sessionId}
      onLogout={handleLogout}
      scenarioId={scenarioId}
      showHints={showHints}
      onToggleHints={handleToggleHints}
      rhythm={rhythm}
      rhythmLabel={rhythmLabel}
      hrDotted={hrDotted}
      pressureDotted={pressureDotted}
      co2Dotted={co2Dotted}

      hrDefibDotted={hrDefibDotted}
      pressureDefibDotted={pressureDefibDotted}
      co2DefibDotted={co2DefibDotted}
      isDefibRemoteControl={isDefibRemoteControl} 
      sendDefibHRDotted={(val) => { setHrDefibDotted(val); broadcastDefibHRDotted(val); }}
      sendDefibPressureDotted={(val) => { setPressureDefibDotted(val); broadcastDefibPressureDotted(val); }}
      sendDefibCO2Dotted={(val) => { setCo2DefibDotted(val); broadcastDefibCO2Dotted(val); }}
      sendDefibControlMode={(val) => { setIsDefibRemoteControl(val); broadcastDefibControlMode(val); }}

      starting={starting}
      bpm={bpm}
      spo2={spo2}
      co2={co2}
      systolic={systolic}
      diastolic={diastolic}
      respiration={respiration}
      setRhythm={setRhythm}
      setRhythmLabel={setRhythmLabel}
      setBpm={setBpm}
      sendCO2Dotted={(val) => { setCo2IsDotted(val); broadcastCo2Dotted(val); }}
      sendHRDotted={(val) => { setHrIsDotted(val); broadcastHRDotted(val); }}
      sendPressureDotted={(val) => { setPressureIsDotted(val); broadcastPressureDotted(val); }}
      setSpo2={setSpo2}
      setCo2={setCo2}
      setSystolic={setSystolic}
      setDiastolic={setDiastolic}
      setRespiration={setRespiration}
      setStart={setStart}
      onScenarioSelect={handleScenarioSelect}
      sendECG={() => sendECG()}
      sendCO2={sendCO2}
      sendPressure={() => sendPressure()}
      sendRespiration={sendRespiration}
      sendRhythm={() => sendRhythm()}
      sendStart={sendStart}
      sendLogDemand={sendLogDemand}
      isRemoteControl={isRemoteControl}
      sendControlMode={(val) => {
        setIsRemoteControl(val);
        sendControlMode(val);
      }}
    />
  );
}
