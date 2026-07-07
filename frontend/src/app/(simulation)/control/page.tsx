"use client";

import React, { useState, useEffect, useRef } from "react";
import ControlPanel from "../../components/ControlPanel";
import { useWebSocket } from "../../context/WebSocketContext";
import { useInternalTimer } from "./Timer";
import { startLog } from "./Log";
import { describeMessage, createLogFormatterState } from "./logFormatter";


export default function ControlPage() {
  const { sendMessage, sessionId, lastMessage } = useWebSocket();
  const { appendToLog, downloadLogFile, resetLog } = startLog();
  const { startTimer, stopTimer, resetTimer, getCurrentTime } = useInternalTimer();
  const logFormatterState = useRef(createLogFormatterState());

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


  const [bpDotted, setBpIsDotted] = useState<boolean>(true);
  const [bpDefibDotted, setBpDefibDotted] = useState<boolean>(true);
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

  const editLocks = useRef<Record<string, number>>({
    bpm: 0, spo2: 0, co2: 0, systolic: 0, diastolic: 0, respiration: 0
  });

  // --- Authoritative Sync Listener ---
  useEffect(() => {
    if (!lastMessage) return;
    const msg = lastMessage as any;
    const logLine = describeMessage(msg, logFormatterState.current);
    if (logLine) appendToLog(logLine);
    if (msg.type === "sync_state") {
      const patient = msg.patient || {};
      const device = msg.device || {};
      if (patient.heartRate !== undefined) {
        setBpm(prev => {
          if (Date.now() - editLocks.current.bpm > 20000 || patient.heartRate === prev) {
            if (patient.heartRate === prev) editLocks.current.bpm = 0; // Libère le verrou
            return patient.heartRate;
          }
          return prev; // Ignore le serveur pendant l'animation
        });
      }
      if (patient.spo2 !== undefined) {
        setSpo2(prev => {
          if (Date.now() - editLocks.current.spo2 > 20000 || patient.spo2 === prev) {
            if (patient.spo2 === prev) editLocks.current.spo2 = 0;
            return patient.spo2;
          }
          return prev;
        });
      }
      if (patient.co2 !== undefined) {
        setCo2(prev => {
          if (Date.now() - editLocks.current.co2 > 20000 || patient.co2 === prev) {
            if (patient.co2 === prev) editLocks.current.co2 = 0;
            return patient.co2;
          }
          return prev;
        });
      }
      if (patient.bloodPressure?.systolic !== undefined) {
        setSystolic(prev => {
          if (Date.now() - editLocks.current.systolic > 20000 || patient.bloodPressure.systolic === prev) {
            if (patient.bloodPressure.systolic === prev) editLocks.current.systolic = 0;
            return patient.bloodPressure.systolic;
          }
          return prev;
        });
      }
      if (patient.bloodPressure?.diastolic !== undefined) {
        setDiastolic(prev => {
          if (Date.now() - editLocks.current.diastolic > 20000 || patient.bloodPressure.diastolic === prev) {
            if (patient.bloodPressure.diastolic === prev) editLocks.current.diastolic = 0;
            return patient.bloodPressure.diastolic;
          }
          return prev;
        });
      }
      if (patient.respiratoryRate !== undefined) {
        setRespiration(prev => {
          if (Date.now() - editLocks.current.respiration > 20000 || patient.respiratoryRate === prev) {
            if (patient.respiratoryRate === prev) editLocks.current.respiration = 0;
            return patient.respiratoryRate;
          }
          return prev;
        });
      }


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
        //appendToLog(`Scénario ${msg.scenario_id} démarré`)
        setShowHints(msg.show_hints || false);
      } else if (msg.action === "stop" || msg.action === "fail" || msg.action === "complete") {
        //appendToLog(`Scénario stoppé`)
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
      if (msg.bpm !== undefined) {
        setBpm(prev => {
          if (Date.now() - editLocks.current.bpm > 20000 || msg.bpm === prev) {
            if (msg.bpm === prev) editLocks.current.bpm = 0;
            return msg.bpm;
          }
          return prev;
        });
      }
      if (msg.spo2 !== undefined) {
        setSpo2(prev => {
          if (Date.now() - editLocks.current.spo2 > 20000 || msg.spo2 === prev) {
            if (msg.spo2 === prev) editLocks.current.spo2 = 0;
            return msg.spo2;
          }
          return prev;
        });
      }
    } else if (msg.type === "co2") {
      if (msg.co2 !== undefined) {
        setCo2(prev => {
          if (Date.now() - editLocks.current.co2 > 20000 || msg.co2 === prev) {
            if (msg.co2 === prev) editLocks.current.co2 = 0;
            return msg.co2;
          }
          return prev;
        });
      }
    } else if (msg.type === "pressure") {
      if (msg.systolic !== undefined) {
        setSystolic(prev => {
          if (Date.now() - editLocks.current.systolic > 20000 || msg.systolic === prev) {
            if (msg.systolic === prev) editLocks.current.systolic = 0;
            return msg.systolic;
          }
          return prev;
        });
      }
      if (msg.diastolic !== undefined) {
        setDiastolic(prev => {
          if (Date.now() - editLocks.current.diastolic > 20000 || msg.diastolic === prev) {
            if (msg.diastolic === prev) editLocks.current.diastolic = 0;
            return msg.diastolic;
          }
          return prev;
        });
      }
    } else if (msg.type === "respiration") {
      if (msg.respirationRate !== undefined) {
        setRespiration(prev => {
          if (Date.now() - editLocks.current.respiration > 20000 || msg.respirationRate === prev) {
            if (msg.respirationRate === prev) editLocks.current.respiration = 0;
            return msg.respirationRate;
          }
          return prev;
        });
      }
    } else if (msg.type === "HRscope") {
      if (msg.simuType === "control_panel" && msg.isHRDotted !== undefined) setHrIsDotted(msg.isHRDotted);
    } else if (msg.type === "Prscope") {
      if (msg.simuType === "control_panel" && msg.isPressureDotted !== undefined) setPressureIsDotted(msg.isPressureDotted);
    } else if (msg.type === "COscope") {
      if (msg.simuType === "control_panel" && msg.isCO2Dotted !== undefined) setCo2IsDotted(msg.isCO2Dotted);
    } else if (msg.type === "visibility_state") {
      
      if (msg.simuType === "control_panel" || (!msg.source_device?.startsWith("scope") && !msg.source_device?.startsWith("defib"))) {
        if (msg.hrDotted !== undefined) setHrIsDotted(msg.hrDotted);
        if (msg.pressureDotted !== undefined) setPressureIsDotted(msg.pressureDotted);
        if (msg.co2Dotted !== undefined) setCo2IsDotted(msg.co2Dotted);
        if (msg.bpDotted !== undefined) setBpIsDotted(msg.bpDotted); 

        if (msg.defibHrDotted !== undefined) setHrDefibDotted(msg.defibHrDotted);
        if (msg.defibPressureDotted !== undefined) setPressureDefibDotted(msg.defibPressureDotted);
        if (msg.defibCo2Dotted !== undefined) setCo2DefibDotted(msg.defibCo2Dotted);
        if (msg.defibBpDotted !== undefined) setBpDefibDotted(msg.defibBpDotted); 
        
        if (msg.isRemoteControl !== undefined) setIsRemoteControl(msg.isRemoteControl);
        if (msg.isDefibRemoteControl !== undefined) setIsDefibRemoteControl(msg.isDefibRemoteControl);
      }
    }
  }, [lastMessage]);

  // --- Envoi de commandes via Context ---
  const sendECG = (overrideBpm?: number, overrideSpo2?: number, overrideRhythm?: string, overrideLabel?: string) => {
    sendMessage({
      type: "rhythm",
      simuType: "control_panel",
      dataType: "sensor",
      rhythm: overrideRhythm ?? rhythm,
      rhythmLabel: overrideLabel ?? rhythmLabel,
    });         
    sendMessage({
      type: "ecg",
      simuType: "control_panel",
      dataType: "sensor",
      bpm: overrideBpm !== undefined ? overrideBpm : bpm,
      spo2: overrideSpo2 !== undefined ? overrideSpo2 : spo2,
    });
    editLocks.current.bpm = Date.now();
    editLocks.current.spo2 = Date.now();
    appendToLog(`Patient mis à ${bpm} bpm et ${spo2}% de saturation O2`);
    appendToLog(`Patient mis en rythme ${rhythm}`)
  };

  const sendCO2 = (overrideCo2?: number) => {
    sendMessage({ 
      type: "co2", 
      simuType: "control_panel", 
      dataType: "sensor", 
      co2: overrideCo2 !== undefined ? overrideCo2 : co2 
    });
    editLocks.current.co2 = Date.now();
  };


  const sendPressure = (overrideSys?: number, overrideDia?: number) => {
    sendMessage({
      type: "pressure",
      simuType: "control_panel",
      dataType: "sensor",
      systolic: overrideSys !== undefined ? overrideSys : systolic,
      diastolic: overrideDia !== undefined ? overrideDia : diastolic,
    });
    editLocks.current.systolic = Date.now();
    editLocks.current.diastolic = Date.now();
  };

  const sendRespiration = (overrideResp?: number) => {
    sendMessage({ 
      type: "respiration", 
      simuType: "control_panel", 
      dataType: "sensor", 
      respirationRate: overrideResp !== undefined ? overrideResp : respiration,
    });
    editLocks.current.respiration = Date.now();
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
    setIsRemoteControl(mode);
    sendMessage({ type: "display_mode", simuType: "control_panel", isRemoteControl: mode });
    
    if (mode) {
      sendMessage({
        type: "visibility_state",
        simuType: "control_panel",
        hrDotted: hrDotted,
        pressureDotted: pressureDotted,
        co2Dotted: co2Dotted,
        bpDotted: bpDotted 
      });
    }
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

  const broadcastBPDotted = (val: boolean) => sendMessage({ type: "visibility_state", simuType: "control_panel", bpDotted: val });
  const broadcastDefibBPDotted = (val: boolean) => sendMessage({ type: "visibility_state", simuType: "control_panel", defibBpDotted: val });
  const broadcastDefibHRDotted = (val: boolean) => sendMessage({ type: "visibility_state", simuType: "control_panel", dataType: "defib", isDefibHRDotted: val });
  const broadcastDefibPressureDotted = (val: boolean) => sendMessage({ type: "visibility_state", simuType: "control_panel", dataType: "defib", isDefibPressureDotted: val });
  const broadcastDefibCO2Dotted = (val: boolean) => sendMessage({ type: "visibility_state", simuType: "control_panel", dataType: "defib", isDefibCO2Dotted: val });
  const broadcastDefibControlMode = (mode: boolean) => {
    setIsDefibRemoteControl(mode);
    sendMessage({ type: "display_mode", simuType: "control_panel", dataType: "defib", isRemoteControl: mode });
    
    if (mode) {
      sendMessage({
        type: "visibility_state",
        simuType: "control_panel",
        dataType: "defib",
        defibHrDotted: hrDefibDotted,
        defibPressureDotted: pressureDefibDotted,
        defibCo2Dotted: co2DefibDotted,
        defibBpDotted: bpDefibDotted
      });
    }
  };

  const sendStart = () => {
  if (starting) {
    startTimer()
    setStart(false);
  } else {
    stopTimer()
    setStart(true);
  }
};

  const sendLogDemand = () => {
  downloadLogFile()
  resetLog()
  logFormatterState.current = createLogFormatterState()
};
  const handleReset = () => {
    setBpm(70);
    setSpo2(98);
    setCo2(40);
    setSystolic(120);
    setDiastolic(80);
    setRespiration(15);
    setRhythm("sinusal");
    setRhythmLabel("Sinusal");
    setScenarioId("Aucun");
    setShowHints(false);

    editLocks.current = { bpm: 0, spo2: 0, co2: 0, systolic: 0, diastolic: 0, respiration: 0 };

    sendMessage({
      type: "bulk_reset",
      simuType: "control_panel",
      dataType: "sensor",
      vitals: {
        bpm: 70,
        spo2: 98,
        co2: 40,
        systolic: 120,
        diastolic: 80,
        respirationRate: 15,
        rhythm: "sinusal",
        rhythmLabel: "Sinusal"
      }
    });
  };

  return (
    <ControlPanel
      username={sessionId}
      onLogout={handleLogout}
      onReset={handleReset}
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
      bpDotted={bpDotted}
      bpDefibDotted={bpDefibDotted}
      sendBPDotted={(val) => { setBpIsDotted(val); broadcastBPDotted(val); }}
      sendDefibBPDotted={(val) => { setBpDefibDotted(val); broadcastDefibBPDotted(val); }}
      starting={starting}
      bpm={bpm}
      spo2={spo2}
      co2={co2}
      systolic={systolic}
      diastolic={diastolic}
      respiration={respiration}
      setRhythm={setRhythm}
      setRhythmLabel={setRhythmLabel}
      setBpm={(val) => { setBpm(val); editLocks.current.bpm = Date.now(); }}
      sendCO2Dotted={(val) => { setCo2IsDotted(val); broadcastCo2Dotted(val); }}
      sendHRDotted={(val) => { setHrIsDotted(val); broadcastHRDotted(val); }}
      sendPressureDotted={(val) => { setPressureIsDotted(val); broadcastPressureDotted(val); }}
      setSpo2={(val) => { setSpo2(val); editLocks.current.spo2 = Date.now(); }}
      setCo2={(val) => { setCo2(val); editLocks.current.co2 = Date.now(); }}
      setSystolic={(val) => { setSystolic(val); editLocks.current.systolic = Date.now(); }}
      setDiastolic={(val) => { setDiastolic(val); editLocks.current.diastolic = Date.now(); }}
      setRespiration={(val) => { setRespiration(val); editLocks.current.respiration = Date.now(); }}
      setStart={setStart}
      onScenarioSelect={handleScenarioSelect}
      sendECG={() => sendECG()}
      sendCO2={() => sendCO2()}
      sendPressure={() => sendPressure()}
      sendRespiration={() => sendRespiration()}
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