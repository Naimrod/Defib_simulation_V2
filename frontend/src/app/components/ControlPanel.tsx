"use client";

import React, { useState } from "react";
import { useModals } from "../hooks/useModals";
import ScenariosListModal from "./modals/ScenariosListModal";
import styles from "../styles/controlPanel.module.css";
import { useWebSocket } from "../context/WebSocketContext";

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
  sendCO2: () => void;
  setStart: (val: boolean) => void;
  sendStart: (val: boolean) => void;
  sendLogDemand: (val: boolean) => void;
  sendPressure: () => void;
  sendRespiration: () => void;
  sendRhythm: () => void;
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
            <span style={{ color: "#aaa", fontWeight: "normal", fontSize: "0.85em" }}>
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

// --- Checkbox avec label ---
function CheckRow({
  id,
  label,
  checked,
  color,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  color?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: "1px solid #333",
      }}
    >
      <label htmlFor={id} style={{ color: color ?? "#ccc", cursor: "pointer" }}>
        {label}
      </label>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: color }}
      />
    </div>
  );
}

// --- THE INDIVIDUAL CONTROL DEVICE BOX ---
function DeviceBox({ deviceId, type, sessionId, sendMessage, globalProps, lastMessage, notifyLocalChange  }: any) {
  const shortId = deviceId.split('_')[1] || deviceId;

  // On garde les états locaux
  if (shortId !== 'CONTR') {
  const [showECG, setShowECG] = useState(type === "Défib" ? !globalProps.hrDefibDotted : !globalProps.hrDotted);
  const [showSpO2, setShowSpO2] = useState(type === "Défib" ? !globalProps.pressureDefibDotted : !globalProps.pressureDotted);
  const [showCO2, setShowCO2] = useState(type === "Défib" ? !globalProps.co2DefibDotted : !globalProps.co2Dotted);
  const [showBP, setShowBP] = useState(type === "Défib" ? !globalProps.bpDefibDotted : !globalProps.bpDotted); 


  React.useEffect(() => { setShowECG(type === "Défib" ? !globalProps.hrDefibDotted : !globalProps.hrDotted); }, [globalProps.hrDotted, globalProps.hrDefibDotted, type]);
  React.useEffect(() => { setShowSpO2(type === "Défib" ? !globalProps.pressureDefibDotted : !globalProps.pressureDotted); }, [globalProps.pressureDotted, globalProps.pressureDefibDotted, type]);
  React.useEffect(() => { setShowCO2(type === "Défib" ? !globalProps.co2DefibDotted : !globalProps.co2Dotted); }, [globalProps.co2Dotted, globalProps.co2DefibDotted, type]);
  React.useEffect(() => { setShowBP(type === "Défib" ? !globalProps.bpDefibDotted : !globalProps.bpDotted); }, [globalProps.bpDotted, globalProps.bpDefibDotted, type]);

  React.useEffect(() => {
    if (!lastMessage) return;
    

    if (lastMessage.source_device === deviceId) {
      if (lastMessage.type === "HRscope") setShowECG(!lastMessage.isHRDotted);
      if (lastMessage.type === "Prscope") setShowSpO2(!lastMessage.isPressureDotted);
      if (lastMessage.type === "COscope") setShowCO2(!lastMessage.isCO2Dotted);
      if (lastMessage.type === "visibility_state" && lastMessage.bpDotted !== undefined) setShowBP(!lastMessage.bpDotted);
    }
  }, [lastMessage, deviceId]);

  const prevRemoteControl = React.useRef(type === "Défib" ? globalProps.isDefibRemoteControl : globalProps.isRemoteControl);

  React.useEffect(() => {
    const currentRemote = type === "Défib" ? globalProps.isDefibRemoteControl : globalProps.isRemoteControl;

    // If the instructor just turned the Remote Control ON
    if (currentRemote && !prevRemoteControl.current) {
       const payload: any = {
         type: "visibility_state",
         target_device: deviceId,
         session_id: sessionId
       };
       
       if (type === "Défib") {
         payload.defibHrDotted = !showECG;
         payload.defibPressureDotted = !showSpO2;
         payload.defibCo2Dotted = !showCO2;
         payload.defibBpDotted = !showBP;
       } else {
         payload.hrDotted = !showECG;
         payload.pressureDotted = !showSpO2;
         payload.co2Dotted = !showCO2;
         payload.bpDotted = !showBP;
       }
       
       sendMessage(payload);
    }
    
    prevRemoteControl.current = currentRemote;
  }, [globalProps.isRemoteControl, globalProps.isDefibRemoteControl, type, showECG, showSpO2, showCO2, showBP, deviceId, sessionId, sendMessage]);

  const handleVisibilityToggle = (sensor: 'ecg' | 'spo2' | 'co2' | 'bp', isVisible: boolean) => {
    // Mise à jour visuelle locale immédiate
    if (sensor === 'ecg') setShowECG(isVisible);
    if (sensor === 'spo2') setShowSpO2(isVisible);
    if (sensor === 'co2') setShowCO2(isVisible);
    if (sensor === 'bp') setShowBP(isVisible); 

    // On prévient le panneau de contrôle de décocher le Master visuellement (sans impacter les autres)
    notifyLocalChange(sensor, isVisible);

    // On envoie l'ordre ciblé au serveur
    const payload: any = { type: "visibility_state", target_device: deviceId, session_id: sessionId };
    const payload2: any = {
      type: "visibility_state",
      target_device: '',
      session_id: sessionId
    };

    if (type === "Défib") {
      payload2.target_device = 'defibrillator_CONTR';
      if (sensor === 'ecg') payload.defibHrDotted = !isVisible;
      if (sensor === 'spo2') payload.defibPressureDotted = !isVisible;
      if (sensor === 'co2') payload.defibCo2Dotted = !isVisible;
      if (sensor === 'bp') payload.defibBpDotted = !isVisible;
      if (sensor === 'ecg') payload2.defibHrDotted = !isVisible;
      if (sensor === 'spo2') payload2.defibPressureDotted = !isVisible;
      if (sensor === 'co2') payload2.defibCo2Dotted = !isVisible;
      if (sensor === 'bp') payload2.defibBpDotted = !isVisible;
    } else {
      payload2.target_device = 'scope_CONTR'
      if (sensor === 'ecg') payload.hrDotted = !isVisible;
      if (sensor === 'spo2') payload.pressureDotted = !isVisible;
      if (sensor === 'co2') payload.co2Dotted = !isVisible;
      if (sensor === 'bp') payload.bpDotted = !isVisible; 
      if (sensor === 'ecg') payload2.hrDotted = !isVisible;
      if (sensor === 'spo2') payload2.pressureDotted = !isVisible;
      if (sensor === 'co2') payload2.co2Dotted = !isVisible;
      if (sensor === 'bp') payload2.bpDotted = !isVisible;
    }
    sendMessage(payload);
    sendMessage(payload2);
  };

  const handleForceShutdown = () => {
    sendMessage({ type: "defibrillator_action", action: "set_display_mode", display_mode: "ARRET", target_device: deviceId, session_id: sessionId });
  };

    return (
    <div style={{
      backgroundColor: "#1a1a2e",
      border: "1px solid #4a4e69",
      padding: "12px",
      borderRadius: "6px",
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong style={{ color: type === 'Scope' ? '#3498db' : '#e74c3c' }}>{type}</strong>
          <span style={{ fontSize: "0.8em", color: "#888", marginLeft: "8px" }}>ID: {shortId}</span>
        </div>
        {type === "Défib" && (
          <button onClick={handleForceShutdown} style={{ backgroundColor: "#c0392b", padding: "4px 8px", fontSize: "0.8em", borderRadius: "4px", border: "none", color: "white", cursor: "pointer", fontWeight: "bold" }}>
            Force OFF
          </button>
        )}
      </div>

      <div style={{ backgroundColor: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "4px", border: "1px solid #2a2a3e" }}>
        <div style={{ fontSize: "0.75em", color: "#aaa", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "bold" }}>
          Contrôle de l'affichage
        </div>
        <div style={{ display: "flex", gap: "15px", fontSize: "0.9em", color: "#fff", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input type="checkbox" checked={showECG} onChange={(e) => handleVisibilityToggle('ecg', e.target.checked)} style={{ cursor: "pointer", width: "16px", height: "16px" }} /> ECG
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input type="checkbox" checked={showSpO2} onChange={(e) => handleVisibilityToggle('spo2', e.target.checked)} style={{ cursor: "pointer", width: "16px", height: "16px" }} /> SpO2
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input type="checkbox" checked={showCO2} onChange={(e) => handleVisibilityToggle('co2', e.target.checked)} style={{ cursor: "pointer", width: "16px", height: "16px" }} /> CO2
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input type="checkbox" checked={showBP} onChange={(e) => handleVisibilityToggle('bp', e.target.checked)} style={{ cursor: "pointer", width: "16px", height: "16px" }} /> TA
          </label>
        </div>
      </div>
    </div>
  );
  }else {
    sendMessage({
      type: "visibility_state",
      defibHRdotted: true,
      target_device: 'CONTR',
      session_id: sessionId,
    })    
  }
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
  const { activeDevices, sendMessage, sessionId } = useWebSocket();
  const activeScopes = activeDevices.filter(id => id.startsWith('scope'));
  const activeDefibs = activeDevices.filter(id => id.startsWith('defib'));

  // --- LOGIQUE MASTER ---
  const [masterECG, setMasterECG] = useState(!props.hrDotted && !props.hrDefibDotted);
  const [masterSpO2, setMasterSpO2] = useState(!props.pressureDotted && !props.pressureDefibDotted);
  const [masterCO2, setMasterCO2] = useState(!props.co2Dotted && !props.co2DefibDotted);
  const [masterBP, setMasterBP] = useState(!props.bpDotted && !props.bpDefibDotted);

  const [commandECG, setCommandECG] = useState({ val: masterECG, ts: 0 });
  const [commandSpO2, setCommandSpO2] = useState({ val: masterSpO2, ts: 0 });
  const [commandCO2, setCommandCO2] = useState({ val: masterCO2, ts: 0 });
  const [commandBP, setCommandBP] = useState({ val: masterBP, ts: 0 });

  // Sécurité pour garder le Master synchro si on recharge la page
  React.useEffect(() => { setMasterECG(!props.hrDotted && !props.hrDefibDotted); }, [props.hrDotted, props.hrDefibDotted]);
  React.useEffect(() => { setMasterSpO2(!props.pressureDotted && !props.pressureDefibDotted); }, [props.pressureDotted, props.pressureDefibDotted]);
  React.useEffect(() => { setMasterCO2(!props.co2Dotted && !props.co2DefibDotted); }, [props.co2Dotted, props.co2DefibDotted]);
  React.useEffect(() => { setMasterBP(!props.bpDotted && !props.bpDefibDotted); }, [props.bpDotted, props.bpDefibDotted]);

  const toggleMasterECG = (checked: boolean) => {
    setMasterECG(checked);
    setCommandECG({ val: checked, ts: Date.now() }); // Génère un ordre qui force les enfants
    props.sendHRDotted(!checked);
    props.sendDefibHRDotted(!checked);
  };
  const toggleMasterSpO2 = (checked: boolean) => {
    setMasterSpO2(checked);
    setCommandSpO2({ val: checked, ts: Date.now() });
    props.sendPressureDotted(!checked);
    props.sendDefibPressureDotted(!checked);
  };
  const toggleMasterCO2 = (checked: boolean) => {
    setMasterCO2(checked);
    setCommandCO2({ val: checked, ts: Date.now() });
    props.sendCO2Dotted(!checked);
    props.sendDefibCO2Dotted(!checked);
  };
  const toggleMasterBP = (checked: boolean) => {
    setMasterBP(checked);
    setCommandBP({ val: checked, ts: Date.now() });
    props.sendBPDotted(!checked);
    props.sendDefibBPDotted(!checked);
  };

  const notifyLocalChange = (sensor: string, isVisible: boolean) => {
    // Décoche visuellement le Master, sans générer de `ts` (donc les autres appareils ignorent ça !)
    if (!isVisible) {
      if (sensor === 'ecg') setMasterECG(false);
      if (sensor === 'spo2') setMasterSpO2(false);
      if (sensor === 'co2') setMasterCO2(false);
      if (sensor === 'bp') setMasterBP(false);
    }
  };

  const handleRhythmSelect = (value: string, label: string) => {
    props.setRhythm(value);
    props.setRhythmLabel(label);
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
  
  

  return (
    <div className={styles.container}>
      <div className={styles.userHeader}>
        <span>User: <strong>{props.username}</strong></span>
        <button onClick={props.onLogout} className={styles.logoutBtn}>Logout</button>
      </div>

      <h1>Panneau de contrôle des constantes</h1>

      <div style={{ display: "flex", gap: "25px", alignItems: "flex-start", flexWrap: "wrap" }}>

        {/* Left column: Scope preview */}
        <div className={styles.controlBox} style={{ flex: "1.5 1 600px", height: "85vh", position: "sticky", top: "20px", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <h2>Aperçu du Moniteur (Scope)</h2>
          <div
            style={{
              flex: 1,
              position: "relative",
              width: "100%",
              height: "100%",
              backgroundColor: "#000",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <iframe
                src={`/scope?username=${props.username}`}
                title="Scope Preview"
                allow="autoplay"
                style={{ width: "100%", height: "100%", border: "none" }}
                />
          </div>
        </div>

        {/* Right column: controls */}
        <div className={styles.panelContainer} style={{ overflowY: "scroll", width: "30%", height: "85vh" }}>

          {/* 🎬 Scénario */}
          <AccordionSection
            title="🎬 Scénario"
            color="#ffffff"
            defaultOpen={true}
            summary={props.scenarioId}
          >
            <button onClick={() => modals.openScenariosList()}>Sélectionner un scénario</button>
            <p style={{ margin: "4px 0", color: "#aaa", fontSize: "0.9em" }}>
              Sélectionné :{" "}
              <strong style={{ color: "white" }}>{props.scenarioId}</strong>
            </p>
            <button onClick={() => props.onReset()}
            style={{ backgroundColor: "#00c800"}}>
              VALEURS PAR DEFAUT
              </button>
            <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
              <button
                onClick={() => props.sendStart(props.starting)}
                style={{
                  flex: 1,
                  background: props.starting ? "#7a2020" : "#1a5c1a",
                  borderColor: props.starting ? "#ff4444" : "#44ff44",
                  color: props.starting ? "#ff8888" : "#88ff88",
                  fontWeight: "bold",
                }}
              >
                {props.starting ? "⏸ Pauser l'exercice" : "▶ Démarrer l'exercice"}
              </button>
              <button
                onClick={() => props.sendLogDemand(true)}
                style={{ flex: 1 }}
              >
                📋 Envoyer le log
              </button>
            </div>
            {props.scenarioId !== "Aucun" && (
              <div style={{
                marginTop: "15px",
                paddingTop: "15px",
                borderTop: "1px solid #444",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <label htmlFor="showHintsCheckbox" style={{ margin: 0, color: "#3498db", fontWeight: "bold", fontSize: "0.9em", cursor: "pointer" }}>
                  Afficher les indices
                </label>
                <input
                  type="checkbox"
                  id="showHintsCheckbox"
                  checked={props.showHints}
                  onChange={(e) => props.onToggleHints(e.target.checked)}
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
              </div>
            )}
          </AccordionSection>

          {/* 💓 Cœur */}
          <AccordionSection
            title="Cœur"
            color="#51ff00"
            defaultOpen={true}
            summary={`${props.rhythmLabel} · ${props.bpm} BPM · SpO2 ${props.spo2}% · ${props.systolic}/${props.diastolic} mmHg`}
          >
            {/* Rythme */}
            <div
              style={{
                background: "#111",
                borderRadius: "6px",
                padding: "12px",
                border: "1px solid #51ff0033",
              }}
            >
              <div
                style={{
                  fontSize: "0.75em",
                  color: "#51ff00aa",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "8px",
                }}
              >
                Rythme
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <strong style={{ color: "#3498db", fontSize: "1.05em" }}>
                  {props.rhythmLabel}
                </strong>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setIsRhythmModalOpen(true)}
                    style={{ color: "#51ff00", fontSize: "0.85em", padding: "6px 12px" }}
                  >
                    Changer
                  </button>
                </div>
              </div>
            </div>

            {/* ECG / SpO2 */}
            <div
              style={{
                background: "#111",
                borderRadius: "6px",
                padding: "12px",
                border: "1px solid #51ff0022",
              }}
            >
              <div
                style={{
                  fontSize: "0.75em",
                  color: "#51ff00aa",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "10px",
                }}
              >
                ECG / SpO2
              </div>
              <SliderRow
                label="BPM"
                value={props.bpm}
                min={0}
                max={200}
                color="#51ff00"
                onChange={props.setBpm}
              />
              <div style={{ marginTop: "10px" }}>
                <SliderRow
                  label="SpO2 (%)"
                  value={props.spo2}
                  min={0}
                  max={100}
                  color="#e5ff00"
                  onChange={props.setSpo2}
                />
              </div>
              <button
                onClick={props.sendECG}
                style={{ marginTop: "12px", color: "#e5ff00", width: "100%" }}
              >
                Envoyer ECG
              </button>
            </div>

            {/* Tension */}
            <div
              style={{
                background: "#111",
                borderRadius: "6px",
                padding: "12px",
                border: "1px solid #ff000033",
              }}
            >
              <div
                style={{
                  fontSize: "0.75em",
                  color: "#ff6666",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "10px",
                }}
              >
                Tension artérielle
              </div>
              <SliderRow
                label="Systolique (mmHg)"
                value={props.systolic}
                min={0}
                max={300}
                color="#ff4444"
                onChange={props.setSystolic}
              />
              <div style={{ marginTop: "10px" }}>
                <SliderRow
                  label="Diastolique (mmHg)"
                  value={props.diastolic}
                  min={0}
                  max={200}
                  color="#ff8888"
                  onChange={(val) => {
                    props.setDiastolic(val);
                    if (val > props.systolic) props.setSystolic(val);
                  }}
                />
              </div>
              <button
                onClick={props.sendPressure}
                style={{ marginTop: "12px", width: "100%" }}
              >
                Envoyer Pression
              </button>
            </div>
          </AccordionSection>

          {/* 💨 Respiration */}
          <AccordionSection
            title=" Respiration"
            color="#00cfff"
            defaultOpen={false}
            summary={`CO2 ${props.co2} mmHg · ${props.respiration} resp/min`}
          >
            <div
              style={{
                background: "#111",
                borderRadius: "6px",
                padding: "12px",
                border: "1px solid #00cfff33",
              }}
            >
              <div
                style={{
                  fontSize: "0.75em",
                  color: "#00cfff99",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "10px",
                }}
              >
                Capnographie
              </div>
              <SliderRow
                label="CO2 (mmHg)"
                value={props.co2}
                min={0}
                max={100}
                color="#00cfff"
                onChange={props.setCo2}
              />
              <button
                onClick={props.sendCO2}
                style={{ marginTop: "12px", width: "100%" }}
              >
                Envoyer CO2
              </button>
            </div>

            <div
              style={{
                background: "#111",
                borderRadius: "6px",
                padding: "12px",
                border: "1px solid #00cfff22",
              }}
            >
              <div
                style={{
                  fontSize: "0.75em",
                  color: "#00cfff99",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "10px",
                }}
              >
                Fréquence respiratoire
              </div>
              <SliderRow
                label="Fréquence (resp/min)"
                value={props.respiration}
                min={0}
                max={60}
                color="#00cfff"
                onChange={props.setRespiration}
              />
              <button
                onClick={props.sendRespiration}
                style={{ marginTop: "12px", width: "100%" }}
              >
                Envoyer Respiration
              </button>
            </div>
          </AccordionSection>

          {/* 📡 Capteurs */}
          <AccordionSection
            title="📡 Gestion des écrans"
            color="#a855f7"
            defaultOpen={false}
          >
            {/* Master global controls */}
            <div style={{ backgroundColor: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px", marginBottom: "20px", border: "1px solid rgba(142, 68, 173, 0.4)" }}>

              {/* Remote Control Locks */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <label style={{ color: "#3498db", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={props.isRemoteControl}
                    onChange={(e) => props.sendControlMode(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  Verrouiller Contrôle Scope
                </label>
                <label style={{ color: "#e74c3c", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={props.isDefibRemoteControl}
                    onChange={(e) => props.sendDefibControlMode(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  Verrouiller Contrôle Défib
                </label>
              </div>

              {/* Master Visibility Switches */}
              <h3 style={{ color: "#d2b4de", fontSize: "0.85em", textTransform: "uppercase", marginBottom: "12px", fontWeight: "bold" }}>
                Visibilité Globale (Tous les écrans)
              </h3>
              <div style={{ display: "flex", gap: "25px", fontSize: "0.95em", color: "#fff" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input type="checkbox" checked={masterECG} onChange={(e) => toggleMasterECG(e.target.checked)} style={{ cursor: "pointer", width: "16px", height: "16px" }} /> ECG
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input type="checkbox" checked={masterSpO2} onChange={(e) => toggleMasterSpO2(e.target.checked)} style={{ cursor: "pointer", width: "16px", height: "16px" }} /> SpO2
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input type="checkbox" checked={masterCO2} onChange={(e) => toggleMasterCO2(e.target.checked)} style={{ cursor: "pointer", width: "16px", height: "16px" }} /> CO2
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input type="checkbox" checked={masterBP} onChange={(e) => toggleMasterBP(e.target.checked)} style={{ cursor: "pointer", width: "16px", height: "16px" }} /> TA
                </label>
                {/* Bouton non fonctionnel */}
                {/*
                <button onClick={handleLiveHardwareToggle}>
                  {isLiveHardware ? "(🟢 Mode Hardware)" : "(🔴 Mode Simulation)" }
                </button>
                */}
              </div>
            </div>

            {/* Individual connected devices */}
            <h3 style={{ color: "#d2b4de", fontSize: "0.85em", textTransform: "uppercase", marginBottom: "10px", fontWeight: "bold" }}>
              Contrôle Individuel (Ciblé)
            </h3>
            {activeScopes.length === 0 && activeDefibs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#888", fontStyle: "italic", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "6px" }}>
                En attente de connexion des moniteurs...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {activeScopes.map(deviceId => (
                  <DeviceBox
                    key={deviceId} deviceId={deviceId} type="Scope" sessionId={sessionId} sendMessage={sendMessage}
                    globalProps={props}
                    commands={{ ecg: commandECG, spo2: commandSpO2, co2: commandCO2, bp: commandBP }}
                    notifyLocalChange={notifyLocalChange}
                  />
                ))}
                {activeDefibs.map(deviceId => (
                  <DeviceBox
                    key={deviceId} deviceId={deviceId} type="Défib" sessionId={sessionId} sendMessage={sendMessage}
                    globalProps={props}
                    commands={{ ecg: commandECG, spo2: commandSpO2, co2: commandCO2, bp: commandBP }}
                    notifyLocalChange={notifyLocalChange}
                  />
                ))}
              </div>
            )}
          </AccordionSection>

        </div>
      </div>

      {/* ── Modals ── */}
      <ScenariosListModal
        isOpen={modals.showScenariosListModal}
        onClose={modals.closeScenarioslist}
        onScenarioSelect={(id) => {
          props.onScenarioSelect(id);
          modals.closeScenarioslist();
        }}
      />
      {isRhythmModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.dialog}>
            <h2>Choisir un rythme</h2>
            <div className={styles.modalGrid}>
              <div className={styles.modalSectionTitle}>Rythmes Sinusaux & Supraventriculaires</div>
              <RythmButton value="sinusal" label="Sinusal" img="../images/rythm_image/Sinus.png" onSelect={handleRhythmSelect} />
              <RythmButton value="tachy_a" label="Tachy A." img="../images/rythm_image/tachya.png" onSelect={handleRhythmSelect} />
              <RythmButton value="tsv" label="TSV" img="../images/rythm_image/TSV.png" onSelect={handleRhythmSelect} />
              <RythmButton value="jonctionnel" label="Jonctionnel" img="../images/rythm_image/Junctionnel.png" onSelect={handleRhythmSelect} />
              <RythmButton value="fib_a" label="Fibrillation A." img="../images/rythm_image/FibA.png" onSelect={handleRhythmSelect} />
              <RythmButton value="flutt_a" label="Flutt A." img="../images/rythm_image/FluttA.png" onSelect={handleRhythmSelect} />

              <div className={styles.modalSectionTitle}>Troubles de la Conduction (BAV)</div>
              <RythmButton value="1_bav" label="1° BAV" img="../images/rythm_image/1BAV.png" onSelect={handleRhythmSelect} />
              <RythmButton value="2_bav_I" label="2° BAV I" img="../images/rythm_image/2BAV1.png" onSelect={handleRhythmSelect} />
              <RythmButton value="2_bav_II" label="2° BAV II" img="../images/rythm_image/2BAV2.png" onSelect={handleRhythmSelect} />
              <RythmButton value="3_bav" label="3° BAV" img="../images/rythm_image/3BAV.png" onSelect={handleRhythmSelect} />

              <div className={styles.modalSectionTitle}>Rythmes Ventriculaires & Chocs</div>
              <RythmButton value="idiov" label="Idiov." img="../images/rythm_image/idiov.png" onSelect={handleRhythmSelect} />
              <RythmButton value="tv_1" label="TV de type 1" img="../images/rythm_image/TV1.png" onSelect={handleRhythmSelect} />
              <RythmButton value="tv_2" label="TV de type 2" img="../images/rythm_image/TV2.png" onSelect={handleRhythmSelect} />
              <RythmButton value="tors" label="Torsade" img="../images/rythm_image/torsade.png" onSelect={handleRhythmSelect} />
              <RythmButton value="fv" label="FV" img="../images/rythm_image/FV.png" onSelect={handleRhythmSelect} />

              <div className={styles.modalSectionTitle}>Hypertrophies & Déviations</div>
              <RythmButton value="rs_hvg" label="RS av. HVG" img="../images/rythm_image/RSavHVG.png" onSelect={handleRhythmSelect} />
              <RythmButton value="rs_hd" label="RS av. HD" img="../images/rythm_image/RSavHD.png" onSelect={handleRhythmSelect} />
              <RythmButton value="rs_hvd" label="RS av. HVD" img="../images/rythm_image/RSavHD.png" onSelect={handleRhythmSelect} />

              <div className={styles.modalSectionTitle}>Stimulateurs Cardiaques (Pace)</div>
              <RythmButton value="stim" label="Stimulateur" img="../images/rythm_image/Stim.png" onSelect={handleRhythmSelect} />
              <RythmButton value="seq" label="Séq. A-V du stimulateur" img="../images/rythm_image/seqavsti.png" onSelect={handleRhythmSelect} />
              <RythmButton value="p_cap" label="P.capture stimulateur" img="../images/rythm_image/Pcapsti.png" onSelect={handleRhythmSelect} />

              <div className={styles.modalSectionTitle}>Arrêt Cardiaque</div>
              <RythmButton value="arret" label="Arrêt" img="../images/rythm_image/Asys.png" onSelect={handleRhythmSelect} />
              <RythmButton value="asysto" label="Asystolie" img="../images/rythm_image/Asys.png" onSelect={handleRhythmSelect} />
            </div>
            <button onClick={() => setIsRhythmModalOpen(false)} className={styles.closeBtn}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}