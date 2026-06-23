"use client";

import React, { useState } from "react";
import { useModals } from "../hooks/useModals";
import ScenariosListModal from "./modals/ScenariosListModal";
import styles from "../styles/controlPanel.module.css";

interface ControlPanelProps {
  username: string;
  onLogout: () => void;
  scenarioId: string;
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

export default function ControlPanel(props: ControlPanelProps) {
  const modals = useModals();
  const [isRhythmModalOpen, setIsRhythmModalOpen] = useState(false);

  const handleRhythmSelect = (value: string, label: string) => {
    props.setRhythm(value);
    props.setRhythmLabel(label);
    setIsRhythmModalOpen(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.userHeader}>
        <span>
          User: <strong>{props.username}</strong>
        </span>
        <button onClick={props.onLogout} className={styles.logoutBtn}>
          Logout
        </button>
      </div>

      <h1>Panneau de contrôle des constantes</h1>

      <div style={{ display: "flex", gap: "25px", alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* ── Aperçu Scope ── */}
        <div
          className={styles.controlBox}
          style={{
            flex: "1.5 1 600px",
            height: "85vh",
            position: "sticky",
            top: "20px",
            display: "flex",
            flexDirection: "column",
          }}
        >
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

        {/* ── Panneau de contrôle ── */}
        <div className={styles.panelContainer} style={{ flex: "1 1 400px" }}>

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
                onClick={() => props.sendLogDemand(false)}
                style={{ flex: 1 }}
              >
                📋 Envoyer le log
              </button>
            </div>
          </AccordionSection>

          {/*  Cœur */}
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
                  <button
                    onClick={props.sendRhythm}
                    style={{ fontSize: "0.85em", padding: "6px 12px" }}
                  >
                    Envoyer
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

            {/* Pression */}
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
                Pression artérielle
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

          {/*  Respiration */}
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

          {/*  Capteurs */}
          <AccordionSection
            title="Capteurs & Affichage"
            color="#a855f7"
            defaultOpen={false}
          >
            <div
              style={{
                background: "#111",
                borderRadius: "6px",
                padding: "12px",
                border: "1px solid #a855f733",
              }}
            >
              <div
                style={{
                  fontSize: "0.75em",
                  color: "#a855f799",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "10px",
                }}
              >
                Mode d'affichage
              </div>
              <CheckRow
                id="remoteControlSwitch"
                label="Forcer l'affichage (Control Panel)"
                checked={props.isRemoteControl}
                color="#3498db"
                onChange={(v) => props.sendControlMode(v)}
              />
            </div>

            <div
              style={{
                background: "#111",
                borderRadius: "6px",
                padding: "12px",
                border: "1px solid #a855f722",
              }}
            >
              <div
                style={{
                  fontSize: "0.75em",
                  color: "#a855f799",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "6px",
                }}
              >
                Visibilité des courbes (scope)
              </div>
              <CheckRow
                id="hrDotted"
                label="ECG visible"
                checked={!props.hrDotted}
                color="#51ff00"
                onChange={(v) => props.sendHRDotted(!v)}
              />
              <CheckRow
                id="pressureDotted"
                label="SpO2 visible"
                checked={!props.pressureDotted}
                color="#e5ff00"
                onChange={(v) => props.sendPressureDotted(!v)}
              />
              <CheckRow
                id="co2Dotted"
                label="CO2 visible"
                checked={!props.co2Dotted}
                color="#00cfff"
                onChange={(v) => props.sendCO2Dotted(!v)}
              />
            </div>
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
              <RhythmButton value="sinusal" label="Sinusal" img="../images/rythm_image/Sinus.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="tachy_a" label="Tachy A." img="../images/rythm_image/tachya.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="tsv" label="TSV" img="../images/rythm_image/TSV.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="jonctionnel" label="Jonctionnel" img="../images/rythm_image/Junctionnel.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="fib_a" label="Fibrillation A." img="../images/rythm_image/FibA.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="flutt_a" label="Flutt A." img="../images/rythm_image/FluttA.png" onSelect={handleRhythmSelect} />

              <div className={styles.modalSectionTitle}>Troubles de la Conduction (BAV)</div>
              <RhythmButton value="1_bav" label="1° BAV" img="../images/rythm_image/1BAV.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="2_bav_I" label="2° BAV I" img="../images/rythm_image/2BAV1.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="2_bav_II" label="2° BAV II" img="../images/rythm_image/2BAV2.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="3_bav" label="3° BAV" img="../images/rythm_image/3BAV.png" onSelect={handleRhythmSelect} />

              <div className={styles.modalSectionTitle}>Rythmes Ventriculaires & Chocs</div>
              <RhythmButton value="idiov" label="Idiov." img="../images/rythm_image/idiov.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="tv_1" label="TV de type 1" img="../images/rythm_image/TV1.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="tv_2" label="TV de type 2" img="../images/rythm_image/TV2.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="tors" label="Torsade" img="../images/rythm_image/torsade.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="fv" label="FV" img="../images/rythm_image/FV.png" onSelect={handleRhythmSelect} />

              <div className={styles.modalSectionTitle}>Hypertrophies & Déviations</div>
              <RhythmButton value="rs_hvg" label="RS av. HVG" img="../images/rythm_image/RSavHVG.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="rs_hd" label="RS av. HD" img="../images/rythm_image/RSavHD.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="rs_hvd" label="RS av. HVD" img="../images/rythm_image/RSavHD.png" onSelect={handleRhythmSelect} />

              <div className={styles.modalSectionTitle}>Stimulateurs Cardiaques (Pace)</div>
              <RhythmButton value="stim" label="Stimulateur" img="../images/rythm_image/Stim.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="seq" label="Séq. A-V du stimulateur" img="../images/rythm_image/seqavsti.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="p_cap" label="P.capture stimulateur" img="../images/rythm_image/Pcapsti.png" onSelect={handleRhythmSelect} />

              <div className={styles.modalSectionTitle}>Arrêt Cardiaque</div>
              <RhythmButton value="arret" label="Arrêt" img="../images/rythm_image/Asys.png" onSelect={handleRhythmSelect} />
              <RhythmButton value="asysto" label="Asystolie" img="../images/rythm_image/Asys.png" onSelect={handleRhythmSelect} />
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

function RhythmButton({
  value,
  label,
  img,
  onSelect,
}: {
  value: string;
  label: string;
  img: string;
  onSelect: (v: string, l: string) => void;
}) {
  return (
    <button onClick={() => onSelect(value, label)}>
      <img src={img} alt={label} />
      {label}
    </button>
  );
}