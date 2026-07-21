"use client";

import PageHeader from "./PageHeader";

import React, { useState, useRef, useEffect } from "react";
import { useModals } from "../hooks/useModals";
import ScenariosListModal from "./modals/ScenariosListModal";
import { useWebSocket } from "../context/WebSocketContext";

function ScaledScopeIframe({ src }: { src: string }) {
  return (
    <iframe 
      src={src}
      title="Scope Preview"
      allow="autoplay"
      className="w-full h-full border-none"
    />
  );
}

interface ControlPanelProps {
  username: string;
  onLogout: () => void;
  onReset: () => void;
  scenarioId: string;
  showHints: boolean;
  onToggleHints: (val: boolean) => void;
  rhythm: string;
  rhythmLabel: string;
  bpm: number;
  spo2: number;
  co2: number;
  systolic: number;
  diastolic: number;
  respiration: number;
  hrDotted: boolean;
  pressureDotted: boolean;
  co2Dotted: boolean;
  bpDotted: boolean;
  hrDefibDotted: boolean;
  pressureDefibDotted: boolean;
  co2DefibDotted: boolean;
  bpDefibDotted: boolean;
  starting: boolean;
  inputLog: string;
  logDisplay : any;
  setRhythm: (val: string) => void;
  setRhythmLabel: (val: string) => void;
  setBpm: (val: number) => void;
  setSpo2: (val: number) => void;
  setCo2: (val: number) => void;
  setSystolic: (val: number) => void;
  setDiastolic: (val: number) => void;
  setRespiration: (val: number) => void;
  onScenarioSelect: (id: string) => void;
  sendECG: () => void;
  sendSpo2: () => void;
  sendCO2: () => void;
  setStart: (val: boolean) => void;
  setInputLog:(e :any) => void;
  sendStart: (val: boolean) => void;
  sendLogDemand: () => void
  sendPressure: () => void;
  sendRespiration: () => void;
  sendRhythm: (value: string, label: string) => void;
  sendHRDotted: (val: boolean) => void;
  sendPressureDotted: (val: boolean) => void;
  sendCO2Dotted: (val: boolean) => void;
  sendBPDotted: (val: boolean) => void;
  sendDefibHRDotted: (val: boolean) => void;
  sendDefibPressureDotted: (val: boolean) => void;
  sendDefibCO2Dotted: (val: boolean) => void;
  sendDefibBPDotted: (val: boolean) => void;
  sendDefibControlMode: (val: boolean) => void;
  isDefibRemoteControl: boolean;
  isRemoteControl: boolean;
  sendControlMode: (val: boolean) => void;
  sendLogInput: (e : any) => void;
}

// --- Accordéon générique ---
function AccordionSection({
  title,
  color,
  defaultOpen = false,
  children,
  summary,
}: {
  title: string;
  color: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  summary?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        border: `1px solid ${color}44`,
        borderRadius: "8px",
        overflow: "hidden",
        marginBottom: "10px",
        width: "100%"
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: `${color}18`,
          border: "none",
          cursor: "pointer",
          color: color,
          fontWeight: "bold",
          fontSize: "1em",
          textAlign: "left",
          gap: "10px",
        }}
      >
        <span>{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {!open && summary && (
            <span style={{ color: color, fontWeight: "bold", fontSize: "1.2em" }}>
              {summary}
            </span>
          )}
          <span style={{ fontSize: "0.8em", opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
        </span>
      </button>

      {open && (
        <div
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            background: "#1a1a1a",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// --- Slider avec label intégré ---
function SliderRow({
  label,
  value,
  min,
  max,
  color,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  color?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <label style={{ color: color ?? "#ccc", fontSize: "0.9em" }}>{label}</label>
        <strong style={{ color: color ?? "white", minWidth: "40px", textAlign: "right" }}>
          {value}
        </strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color }}
      />
    </div>
  );
}

// --- THE INDIVIDUAL CONTROL DEVICE BOX ---
function DeviceBox({ deviceId, type, sessionId, sendMessage, globalProps, lastMessage, memory }: any) {
  const shortId = deviceId.split('_')[1] || deviceId;
  
  // Chargement pur depuis la mémoire (par défaut: caché/false si l'appareil est nouveau)
  const devMem = memory?.current[deviceId] || {};
  const [showECG, setShowECG] = useState(devMem.showECG ?? false);
  const [showSpO2, setShowSpO2] = useState(devMem.showSpO2 ?? false);
  const [showCO2, setShowCO2] = useState(devMem.showCO2 ?? false);
  const [showBP, setShowBP] = useState(devMem.showBP ?? false); 

  // On écoute uniquement les VRAIS changements du Master
  const prevHr = useRef(type === "Défib" ? globalProps.hrDefibDotted : globalProps.hrDotted);
  const prevPr = useRef(type === "Défib" ? globalProps.pressureDefibDotted : globalProps.pressureDotted);
  const prevCo2 = useRef(type === "Défib" ? globalProps.co2DefibDotted : globalProps.co2Dotted);
  const prevBp = useRef(type === "Défib" ? globalProps.bpDefibDotted : globalProps.bpDotted);

  useEffect(() => {
    const current = type === "Défib" ? globalProps.hrDefibDotted : globalProps.hrDotted;
    if (current !== prevHr.current) {
      setShowECG(!current);
      if (memory?.current) memory.current[deviceId] = { ...memory.current[deviceId], showECG: !current };
      prevHr.current = current;
    }
  }, [globalProps.hrDotted, globalProps.hrDefibDotted, type, deviceId, memory]);

  useEffect(() => {
    const current = type === "Défib" ? globalProps.pressureDefibDotted : globalProps.pressureDotted;
    if (current !== prevPr.current) {
      setShowSpO2(!current);
      if (memory?.current) memory.current[deviceId] = { ...memory.current[deviceId], showSpO2: !current };
      prevPr.current = current;
    }
  }, [globalProps.pressureDotted, globalProps.pressureDefibDotted, type, deviceId, memory]);

  useEffect(() => {
    const current = type === "Défib" ? globalProps.co2DefibDotted : globalProps.co2Dotted;
    if (current !== prevCo2.current) {
      setShowCO2(!current);
      if (memory?.current) memory.current[deviceId] = { ...memory.current[deviceId], showCO2: !current };
      prevCo2.current = current;
    }
  }, [globalProps.co2Dotted, globalProps.co2DefibDotted, type, deviceId, memory]);

  useEffect(() => {
    const current = type === "Défib" ? globalProps.bpDefibDotted : globalProps.bpDotted;
    if (current !== prevBp.current) {
      setShowBP(!current);
      if (memory?.current) memory.current[deviceId] = { ...memory.current[deviceId], showBP: !current };
      prevBp.current = current;
    }
  }, [globalProps.bpDotted, globalProps.bpDefibDotted, type, deviceId, memory]);

  // INJECTION TACTIQUE (Avec délai pour vaincre la course de vitesse)
  useEffect(() => {
    if (shortId === 'CONTR') return;
    
    const timer = setTimeout(() => {
      const payload: any = { type: "visibility_state", target_device: deviceId, session_id: sessionId };
      if (type === "Défib") {
        payload.defibHrDotted = !showECG;
        payload.defibPressureDotted = !showSpO2;
        payload.defibCo2Dotted = !showCO2;
        payload.defibBpDotted = !showBP;
        payload.isDefibRemoteControl = globalProps.isDefibRemoteControl;
      } else {
        payload.hrDotted = !showECG;
        payload.pressureDotted = !showSpO2;
        payload.co2Dotted = !showCO2;
        payload.bpDotted = !showBP;
        payload.isRemoteControl = globalProps.isRemoteControl;
      }
      sendMessage(payload);
    }, 600); // On attend 600ms pour être sûr que le Scope a fini de redémarrer !
    
    return () => clearTimeout(timer);
  }, []); // [] = S'exécute strictement à l'apparition de l'appareil !

  // Synchronisation si l'étudiant clique lui-même
  useEffect(() => {
    if (!lastMessage) return;

    const target = lastMessage.target_device || lastMessage.source_device;
    if (target && target !== deviceId) return;
    if (type === "Défib" && lastMessage.dataType === "defib") {
      if (lastMessage.type === "HRscope" && lastMessage.isDefibHRDotted !== undefined) setShowECG(!lastMessage.isDefibHRDotted);
      if (lastMessage.type === "Prscope" && lastMessage.isDefibPressureDotted !== undefined) setShowSpO2(!lastMessage.isDefibPressureDotted);
      if (lastMessage.type === "COscope" && lastMessage.isDefibCO2Dotted !== undefined) setShowCO2(!lastMessage.isDefibCO2Dotted);
    }
    if (type !== "Défib" && lastMessage.dataType === "scope") {
      if (lastMessage.type === "HRscope" && lastMessage.isHRDotted !== undefined) setShowECG(!lastMessage.isHRDotted);
      if (lastMessage.type === "Prscope" && lastMessage.isPressureDotted !== undefined) setShowSpO2(!lastMessage.isPressureDotted);
      if (lastMessage.type === "COscope" && lastMessage.isCO2Dotted !== undefined) setShowCO2(!lastMessage.isCO2Dotted);
    }
   }, [lastMessage, type, deviceId]);

  // Clic manuel du formateur
  const handleVisibilityToggle = (sensor: 'ecg' | 'spo2' | 'co2' | 'bp', isVisible: boolean) => {

    if (sensor === 'ecg') { setShowECG(isVisible); if (memory?.current) memory.current[deviceId] = { ...memory.current[deviceId], showECG: isVisible }; }
    if (sensor === 'spo2') { setShowSpO2(isVisible); if (memory?.current) memory.current[deviceId] = { ...memory.current[deviceId], showSpO2: isVisible }; }
    if (sensor === 'co2') { setShowCO2(isVisible); if (memory?.current) memory.current[deviceId] = { ...memory.current[deviceId], showCO2: isVisible }; }
    if (sensor === 'bp') { setShowBP(isVisible); if (memory?.current) memory.current[deviceId] = { ...memory.current[deviceId], showBP: isVisible }; }

    const payload: any = { type: "visibility_state", target_device: deviceId, session_id: sessionId };
    const payload2: any = { type: "visibility_state", session_id: sessionId };

    if (type === "Défib") {
      payload2.target_device = 'defibrillator_CONTR';
      
      payload.defibHrDotted       = sensor === 'ecg'  ? !isVisible : !showECG;
      payload.defibPressureDotted = sensor === 'spo2' ? !isVisible : !showSpO2;
      payload.defibCo2Dotted      = sensor === 'co2'  ? !isVisible : !showCO2;
      payload.defibBpDotted       = sensor === 'bp'   ? !isVisible : !showBP;
      
      payload2.defibHrDotted       = payload.defibHrDotted;
      payload2.defibPressureDotted = payload.defibPressureDotted;
      payload2.defibCo2Dotted      = payload.defibCo2Dotted;
      payload2.defibBpDotted       = payload.defibBpDotted;
      
    } else {
      payload2.target_device = 'scope_CONTR';
      
      payload.hrDotted       = sensor === 'ecg'  ? !isVisible : !showECG;
      payload.pressureDotted = sensor === 'spo2' ? !isVisible : !showSpO2;
      payload.co2Dotted      = sensor === 'co2'  ? !isVisible : !showCO2;
      payload.bpDotted       = sensor === 'bp'   ? !isVisible : !showBP;
      
      payload2.hrDotted       = payload.hrDotted;
      payload2.pressureDotted = payload.pressureDotted;
      payload2.co2Dotted      = payload.co2Dotted;
      payload2.bpDotted       = payload.bpDotted;
    }
    sendMessage(payload);
    console.log(payload);
    sendMessage(payload2);
  };

  const handleForceShutdown = () => {
    sendMessage({ type: "defibrillator_action", action: "set_display_mode", display_mode: "ARRET", target_device: deviceId, session_id: sessionId });
  };

  if (shortId === 'CONTR') return null;

  return (
    <div style={{
      backgroundColor: "#000000",
      border: "1px solid #4a4e69",
      padding: "12px",
      borderRadius: "6px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      minWidth: "320px", 
      flexShrink: 0      
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong style={{ color: type === 'Scope' ? '#3498db' : '#e74c3c' }}>{type}</strong>
          <span style={{ fontSize: "0.8em", color: "#888", marginLeft: "8px" }}>ID: {shortId}</span>
        </div>
      </div>

      <div style={{ backgroundColor: "#1a1a1a", padding: "10px", borderRadius: "4px", border: "1px solid #2a2a3e" }}>
        <div style={{ fontSize: "0.75em", color: "#aaa", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "bold" }}>
          Contrôle de l'affichage
        </div>
        <div style={{ display: "flex", gap: "15px", fontSize: "0.9em", color: "#fff", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input type="checkbox" checked={showECG}  disabled={type === "Défib" ? !globalProps.isDefibRemoteControl : !globalProps.isRemoteControl} onChange={(e) => handleVisibilityToggle('ecg', e.target.checked)} style={{ cursor: "pointer", width: "16px", height: "16px" }} /> ECG/FRVA
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input type="checkbox" checked={showSpO2} disabled={type === "Défib" ? !globalProps.isDefibRemoteControl : !globalProps.isRemoteControl} onChange={(e) => handleVisibilityToggle('spo2', e.target.checked)} style={{ cursor: "pointer", width: "16px", height: "16px" }} /> SpO2/POULS
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input type="checkbox" checked={showCO2} disabled={type === "Défib" ? !globalProps.isDefibRemoteControl : !globalProps.isRemoteControl} onChange={(e) => handleVisibilityToggle('co2', e.target.checked)} style={{ cursor: "pointer", width: "16px", height: "16px" }} /> CO2
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input type="checkbox" checked={showBP} disabled={type === "Défib" ? !globalProps.isDefibRemoteControl : !globalProps.isRemoteControl} onChange={(e) => handleVisibilityToggle('bp', e.target.checked)} style={{ cursor: "pointer", width: "16px", height: "16px" }} /> TA
          </label>
        </div>
      </div>

      {type === "Défib" ? (
        <button onClick={handleForceShutdown} className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs px-2 py-1 rounded transition-colors">
          Force OFF
        </button>
      ) : (
        <div className="h-[24px]" />
      )}
    </div>
  );
}

// --- RYTHM BUTTON ---
function RythmButton({ value, label, img, onSelect }: { value: string, label: string, img: string, onSelect: (v: string, l: string) => void }) {
  return (
    <button onClick={() => onSelect(value, label)}>
      <img src={img} alt={label} />
      {label}
    </button>
  );
}


export default function ControlPanel(props: ControlPanelProps) {
  const modals = useModals();
  const [isRhythmModalOpen, setIsRhythmModalOpen] = useState(false);
  const [isLiveHardware, setIsLiveHardware] = useState(false);
  const { activeDevices, sendMessage, sessionId, lastMessage } = useWebSocket();
  const activeScopes = activeDevices.filter(id => id.startsWith('scope'));
  const activeDefibs = activeDevices.filter(id => id.startsWith('defib'));
  const [devicesSynced, setDevicesSynced] = useState(false);
  // Mémoire de tous les réglages individuels même quand les boîtes sont détruites.
  const individualMemory = useRef<Record<string, any>>({});

  useEffect(() => {
  if (lastMessage?.type === "sync_state" && lastMessage.device_states) {
    Object.entries(lastMessage.device_states).forEach(([devId, devState]: [string, any]) => {
      const isDefib = devId.startsWith('defib');
      individualMemory.current[devId] = {
        showECG: !(isDefib ? devState.defibHrDotted : devState.hrDotted),
        showSpO2: !(isDefib ? devState.defibPressureDotted : devState.pressureDotted),
        showCO2: !(isDefib ? devState.defibCo2Dotted : devState.co2Dotted),
        showBP: !(isDefib ? devState.defibBpDotted : devState.bpDotted),
      };
    });
    setDevicesSynced(true);
  }
}, [lastMessage]);

  const handleRhythmSelect = (value: string, label: string) => {
    props.setRhythm(value);
    props.setRhythmLabel(label);

    if (props.sendRhythm) {
        props.sendRhythm(value, label);
    }

    if (value === "tachy_a") props.setBpm(150);
    else if (value === "fv") props.setBpm(180);
    else if (value === "tsv") props.setBpm(180);
    else if (value === "jonctionnel") props.setBpm(130);
    else if (value === "flutt_a") props.setBpm(120);
    else if (value === "idiov") props.setBpm(35);
    else if (value === "tv_2") props.setBpm(160);
    else if (value === "1_bav") props.setBpm(55);
    else if (value === "2_bav_I") props.setBpm(45);
    else if (value === "2_bav_II") props.setBpm(40);
    else if (value === "3_bav") props.setBpm(35);
    else if (value === "tors") props.setBpm(300);
    else if (value === "tv_1") props.setBpm(170);
    else if (value === "rs_hvg") props.setBpm(75);
    else if (value === "rs_hd") props.setBpm(75);
    else if (value === "rs_hvd") props.setBpm(75);
    else if (value === "arret" || value === "asysto") props.setBpm(0);

    setIsRhythmModalOpen(false);
  };

  const handleLiveHardwareToggle = () => {
    const newValue = !isLiveHardware;
    setIsLiveHardware(newValue);
    sendMessage({
      type: "hardware_mode",
      isLiveHardware: newValue,
      session_id: sessionId,
    });
  };

  const listLog = props.logDisplay.map((logEntry: any, idx: number) => <p key={idx}>{logEntry}</p>);

  return (
    <div className="font-sans bg-black text-white h-screen max-h-screen overflow-hidden flex flex-col">
      <PageHeader title="Panneau de Contrôle" icon="🎛️" username={props.username} onLogout={props.onLogout} />

      <div className="flex-1 flex flex-col lg:flex-row w-full min-h-0 overflow-hidden">
        
        {/* --- COLONNE DE GAUCHE : SCOPE ET CONTROLES CIBLÉS (60%) --- */}
        <div className="w-full lg:w-[60%] flex flex-col p-4 gap-3 border-r border-[#222222] min-w-0 h-full overflow-hidden bg-[#111111] ">
          {/* Scope preview locked to 70% height */}
          <div className="relative w-full h-[70%] bg-black rounded-lg overflow-hidden shrink-0 border border-gray-800 shadow-xl">
            <ScaledScopeIframe src={`/scope?username=${props.username}&id=CONTR`} />
          </div>

          {/* Reserved bottom area for targeted device controls locked to 30% height */}
          <div className="w-full h-[30%] flex flex-col justify-between border-t border-gray-800 pt-2 shrink-0 overflow-hidden">
            <div className="flex justify-between items-center mb-2 shrink-0">
              <h3 className="text-[#FFFF] text-xs font-bold uppercase tracking-wider m-0">
                Contrôle Individuel
              </h3>
              
              <div className="flex gap-4">
                <label className="text-[#00ddff] font-bold cursor-pointer flex items-center gap-1.5 text-xs">
                  <input 
                    type="checkbox" 
                    checked={props.isRemoteControl} 
                    onChange={(e) => props.sendControlMode(e.target.checked)} 
                    className="w-3.5 h-3.5 cursor-pointer" 
                  /> 
                  Verrouiller Contrôle Scope
                </label>
                <label className="text-[#e74c3c] font-bold cursor-pointer flex items-center gap-1.5 text-xs">
                  <input 
                    type="checkbox" 
                    checked={props.isDefibRemoteControl} 
                    onChange={(e) => props.sendDefibControlMode(e.target.checked)} 
                    className="w-3.5 h-3.5 cursor-pointer" 
                  /> 
                  Verrouiller Contrôle Défib
                </label>
              </div>
            </div>

            <div className="flex-1 flex items-stretch gap-3 overflow-x-auto py-0 rounded-lg px-3 min-h-[100px]">
              {!devicesSynced || (activeScopes.length === 0 && activeDefibs.length === 0) ? (
                <div className="w-full text-center text-gray-500 italic text-xs py-3">
                  Aucun appareil connecté. En attente des appareils (Scope / Défibrillateur)...
                </div>
              ) : (
                <>
                  {activeScopes.map(deviceId => (
                    <DeviceBox key={deviceId} deviceId={deviceId} type="Scope" sessionId={sessionId} sendMessage={sendMessage}
                      globalProps={props} lastMessage={lastMessage} memory={individualMemory} />
                  ))}
                  {activeDefibs.map(deviceId => (
                    <DeviceBox key={deviceId} deviceId={deviceId} type="Défib" sessionId={sessionId} sendMessage={sendMessage}
                      globalProps={props} lastMessage={lastMessage} memory={individualMemory} />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
          
        {/* --- COLONNE DE DROITE : PANNEAU DE CONTRÔLE GLOBAL (40%) --- */}
        <div className="w-full lg:w-[40%] flex flex-col p-4 min-w-0 h-full overflow-y-auto">
          <div className="w-full bg-[#111111] border border-gray-800 rounded p-2 max-h-[100px] overflow-y-auto flex flex-col-reverse text-xs font-mono shrink-0 mb-3">
            {listLog}
          </div>
          <form onSubmit={props.sendLogInput} className="w-full shrink-0 mb-4">            
              <input 
                type="text" 
                placeholder="Annoter dans le log" 
                required 
                value={props.inputLog} 
                onChange={(e) => props.setInputLog(e.target.value)}
                className="w-full bg-[#111111] border border-gray-800 rounded p-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
          </form>
          
          <div className="flex-1 flex flex-col gap-2" style={{ visibility: props.starting ? 'visible' : 'hidden' }}>
            <AccordionSection title="🎬 Scénario" color="#ffffff" defaultOpen={false} summary={props.scenarioId}>
              <button onClick={() => modals.openScenariosList()} className="w-full bg-[#222222] hover:bg-[#333333] text-white border border-[#444444] rounded-lg py-2 px-3 text-xs font-bold transition-colors cursor-pointer mb-2">Sélectionner un scénario</button>
              <p style={{ margin: "4px 0", color: "#aaa", fontSize: "0.9em" }}>Sélectionné : <strong style={{ color: "white" }}>{props.scenarioId}</strong></p>
              <button onClick={() => props.onReset()} className="bg-green-700 hover:bg-green-600 text-white font-bold py-2.5 px-4 rounded-lg w-full transition-colors cursor-pointer text-xs border border-green-600/50">
                VALEURS PAR DEFAUT
              </button>
              
              {props.scenarioId !== "Aucun" && (
                <div style={{ marginTop: "15px", paddingTop: "15px", borderTop: "1px solid #444", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label htmlFor="showHintsCheckbox" style={{ margin: 0, color: "#3498db", fontWeight: "bold", fontSize: "0.9em", cursor: "pointer" }}>Afficher les indices</label>
                  <input type="checkbox" id="showHintsCheckbox" checked={props.showHints} onChange={(e) => props.onToggleHints(e.target.checked)} style={{ width: "18px", height: "18px", cursor: "pointer" }} />
                </div>
              )}
            </AccordionSection>

            <AccordionSection title="Cœur" color="#51ff00" defaultOpen={false} summary={`${props.rhythmLabel} · ${props.bpm} BPM · ${props.systolic}/${props.diastolic} mmHg`}>
              <div style={{ background: "#111", borderRadius: "6px", padding: "12px", border: "1px solid #51ff0033" }}>
                <div style={{ fontSize: "0.75em", color: "#51ff00aa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Rythme</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <strong style={{ color: "#3498db", fontSize: "1.05em" }}>{props.rhythmLabel}</strong>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => setIsRhythmModalOpen(true)} className="bg-[#222222] hover:bg-[#333333] text-[#51ff00] border border-[#51ff0044] rounded-md px-3 py-1 text-xs font-bold transition-colors cursor-pointer">Changer</button>
                  </div>
                </div>
              </div>
              <div style={{ background: "#111", borderRadius: "6px", padding: "12px", border: "1px solid #51ff0022" }}>
                <div style={{ fontSize: "0.75em", color: "#51ff00aa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>ECG</div>
                <SliderRow label="BPM" value={props.bpm} min={0} max={200} color="#51ff00" onChange={props.setBpm} />
                <button onClick={props.sendECG} className="w-full bg-[#222222] hover:bg-[#333333] text-[#51ff00] border border-[#51ff0044] rounded-lg py-2 text-xs font-bold transition-colors cursor-pointer mt-3">Envoyer ECG</button>
              </div>
              <div style={{ background: "#111", borderRadius: "6px", padding: "12px", border: "1px solid #ff000033" }}>
                <div style={{ fontSize: "0.75em", color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>Tension artérielle</div>
                <SliderRow label="Systolique (mmHg)" value={props.systolic} min={0} max={300} color="#ff4444" onChange={props.setSystolic} />
                <div style={{ marginTop: "10px" }}><SliderRow label="Diastolique (mmHg)" value={props.diastolic} min={0} max={200} color="#ff8888" onChange={(val) => { props.setDiastolic(val); if (val > props.systolic) props.setSystolic(val); }} /></div>
                <button onClick={props.sendPressure} className="w-full bg-[#222222] hover:bg-[#333333] text-[#ff6666] border border-[#ff444444] rounded-lg py-2 text-xs font-bold transition-colors cursor-pointer mt-3">Envoyer Pression</button>
              </div>
            </AccordionSection>

            <AccordionSection title=" Respiration" color="#00cfff" defaultOpen={false} summary={`SpO2 ${props.spo2}% · ${props.respiration} resp/min · CO2 ${props.co2} mmHg`}>
              <div style={{ background: "#111", borderRadius: "6px", padding: "12px", border: "1px solid #00cfff33" }}>
                <div style={{ fontSize: "0.75em", color: "#00cfff99", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>Oxygénation (SpO2)</div>
                <SliderRow label="SpO2 (%)" value={props.spo2} min={0} max={100} color="#00cfff" onChange={props.setSpo2} />
                {props.sendSpo2 && (
                  <button onClick={props.sendSpo2} className="w-full bg-[#222222] hover:bg-[#333333] text-[#00cfff] border border-[#00cfff44] rounded-lg py-2 text-xs font-bold transition-colors cursor-pointer mt-3">Envoyer SpO2</button>
                )}
              </div>
              
              <div style={{ background: "#111", borderRadius: "6px", padding: "12px", border: "1px solid #00cfff33" }}>
                <div style={{ fontSize: "0.75em", color: "#00cfff99", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>Capnographie</div>
                <SliderRow label="CO2 mmHg" value={props.co2} min={0} max={100} color="#00cfff" onChange={props.setCo2} />
                <button onClick={props.sendCO2} className="w-full bg-[#222222] hover:bg-[#333333] text-[#00cfff] border border-[#00cfff44] rounded-lg py-2 text-xs font-bold transition-colors cursor-pointer mt-3">Envoyer CO2</button>
              </div>
              
              <div style={{ background: "#111", borderRadius: "6px", padding: "12px", border: "1px solid #00cfff22" }}>
                <div style={{ fontSize: "0.75em", color: "#00cfff99", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>Fréquence respiratoire</div>
                <SliderRow label="FRVA (resp/min)" value={props.respiration} min={0} max={60} color="#00cfff" onChange={props.setRespiration} />
                <button onClick={props.sendRespiration} className="w-full bg-[#222222] hover:bg-[#333333] text-[#00cfff] border border-[#00cfff44] rounded-lg py-2 text-xs font-bold transition-colors cursor-pointer mt-3">Envoyer Respiration</button>
              </div>
            </AccordionSection>
          </div>
          <div className="flex gap-2 mt-3 pt-2 border-t border-[#222222] shrink-0">
            <button
              onClick={() => props.sendStart(props.starting)}
              className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                props.starting
                  ? "bg-red-950/60 hover:bg-red-900/80 text-red-300 border-red-700/60"
                  : "bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border-emerald-700/60"
              }`}
            >
              {props.starting ? "⏸ Pauser l'exercice" : "▶ Démarrer l'exercice"}
            </button>
            <button
              onClick={() => props.sendLogDemand()}
              className="flex-1 py-2.5 px-4 rounded-lg font-bold text-xs transition-colors cursor-pointer bg-[#222222] hover:bg-[#333333] text-slate-200 border border-[#444444] flex items-center justify-center gap-1.5"
            >
              🏁 Terminer l'exercice
            </button>
          </div>
        </div>
      </div>

      <ScenariosListModal
        isOpen={modals.showScenariosListModal}
        onClose={modals.closeScenarioslist}
        onScenarioSelect={(id) => {
          props.onScenarioSelect(id);
          modals.closeScenarioslist();
        }}
      />
      {isRhythmModalOpen && (
        <div className="sim-modal-overlay">
          <div className="text-white bg-[#34495e] p-8 rounded-2xl max-w-[450px] w-[90%] shadow-2xl flex flex-col max-h-[85vh]">
            <h2 className="text-2xl font-bold mt-0 mb-4">Choisir un rythme</h2>
            <div className="flex flex-col gap-2.5 overflow-y-auto mb-4 pr-1">
              <div className="font-bold text-slate-300 mt-4 mb-1">Rythmes Sinusaux & Supraventriculaires</div>
              <RythmButton value="sinusal" label="Sinusal" img="../images/rythm_image/Sinus.png" onSelect={handleRhythmSelect} />
              <RythmButton value="tachy_a" label="Tachy A." img="../images/rythm_image/tachya.png" onSelect={handleRhythmSelect} />
              <RythmButton value="tsv" label="TSV" img="../images/rythm_image/TSV.png" onSelect={handleRhythmSelect} />
              <RythmButton value="jonctionnel" label="Jonctionnel" img="../images/rythm_image/Junctionnel.png" onSelect={handleRhythmSelect} />
              <RythmButton value="fib_a" label="Fibrillation A." img="../images/rythm_image/FibA.png" onSelect={handleRhythmSelect} />
              <RythmButton value="flutt_a" label="Flutt A." img="../images/rythm_image/FluttA.png" onSelect={handleRhythmSelect} />

              <div className="font-bold text-slate-300 mt-4 mb-1">Troubles de la Conduction (BAV)</div>
              <RythmButton value="1_bav" label="1° BAV" img="../images/rythm_image/1BAV.png" onSelect={handleRhythmSelect} />
              <RythmButton value="2_bav_I" label="2° BAV I" img="../images/rythm_image/2BAV1.png" onSelect={handleRhythmSelect} />
              <RythmButton value="2_bav_II" label="2° BAV II" img="../images/rythm_image/2BAV2.png" onSelect={handleRhythmSelect} />
              <RythmButton value="3_bav" label="3° BAV" img="../images/rythm_image/3BAV.png" onSelect={handleRhythmSelect} />

              <div className="font-bold text-slate-300 mt-4 mb-1">Rythmes Ventriculaires & Chocs</div>
              <RythmButton value="idiov" label="Idiov." img="../images/rythm_image/idiov.png" onSelect={handleRhythmSelect} />
              <RythmButton value="tv_1" label="TV de type 1" img="../images/rythm_image/TV1.png" onSelect={handleRhythmSelect} />
              <RythmButton value="tv_2" label="TV de type 2" img="../images/rythm_image/TV2.png" onSelect={handleRhythmSelect} />
              <RythmButton value="tors" label="Torsade" img="../images/rythm_image/torsade.png" onSelect={handleRhythmSelect} />
              <RythmButton value="fv" label="FV" img="../images/rythm_image/FV.png" onSelect={handleRhythmSelect} />

              <div className="font-bold text-slate-300 mt-4 mb-1">Hypertrophies & Déviations</div>
              <RythmButton value="rs_hvg" label="RS av. HVG" img="../images/rythm_image/RSavHVG.png" onSelect={handleRhythmSelect} />
              <RythmButton value="rs_hd" label="RS av. HD" img="../images/rythm_image/RSavHD.png" onSelect={handleRhythmSelect} />
              <RythmButton value="rs_hvd" label="RS av. HVD" img="../images/rythm_image/RSavHD.png" onSelect={handleRhythmSelect} />

              <div className="font-bold text-slate-300 mt-4 mb-1">Ischémie</div>
              <RythmButton value="infarctus" label="Infarctus (STEMI)" img="../images/rythm_image/Sinus.png" onSelect={handleRhythmSelect} />

              <div className="font-bold text-slate-300 mt-4 mb-1">Stimulateurs Cardiaques (Pace)</div>
              <RythmButton value="stim" label="Stimulateur" img="../images/rythm_image/Stim.png" onSelect={handleRhythmSelect} />
              <RythmButton value="seq" label="Séq. A-V du stimulateur" img="../images/rythm_image/seqavsti.png" onSelect={handleRhythmSelect} />
              <RythmButton value="p_cap" label="P.capture stimulateur" img="../images/rythm_image/Pcapsti.png" onSelect={handleRhythmSelect} />

              <div className="font-bold text-slate-300 mt-4 mb-1">Arrêt Cardiaque</div>
              <RythmButton value="arret" label="Arrêt" img="../images/rythm_image/Asys.png" onSelect={handleRhythmSelect} />
              <RythmButton value="asysto" label="Asystolie" img="../images/rythm_image/Asys.png" onSelect={handleRhythmSelect} />
            </div>
            <button onClick={() => setIsRhythmModalOpen(false)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg w-full transition-colors cursor-pointer">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}