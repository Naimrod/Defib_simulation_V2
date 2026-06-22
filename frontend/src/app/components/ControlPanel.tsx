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
        <span>User: <strong>{props.username}</strong></span>
        <button onClick={props.onLogout} className={styles.logoutBtn}>Logout</button>
      </div>

      <h1>Panneau de contrôle des constantes</h1>
      
      <div style={{ display: "flex", gap: "25px", alignItems: "flex-start", flexWrap: "wrap" }}>
        
        <div className={styles.controlBox} style={{ flex: "1.5 1 600px", height: "85vh", position: "sticky", top: "20px", display: "flex", flexDirection: "column" }}>
          <h2>Aperçu du Moniteur (Scope)</h2>
          <div style={{ flex: 1, position: "relative", width: "100%", height: "100%", backgroundColor: "#000", borderRadius: "8px", overflow: "hidden" }}>
            <iframe 
              src={`/scope?username=${props.username}`} 
              title="Scope Preview"
              allow="autoplay"
              style={{
                width: "100%",     
                height: "100%", 
                border: "none"
              }}
            />
          </div>
        </div>

        <div className={styles.panelContainer} style={{ flex: "1 1 400px" }}>
          
          <div className={styles.controlBox}>
            <h2>Choix du scénario</h2>
            <button onClick={() => modals.openScenariosList()}>Sélectionner un scénario</button>
            <p style={{ marginTop: "15px" }}>
              Scénario sélectionné : <strong style={{ color: "white" }}>{props.scenarioId}</strong>
            </p>
            <button onClick={() => props.sendStart(props.starting)} style={{ marginTop: "10px" }}>
              {props.starting ? "Pauser l'exercice" : "Démarrer l'exercice"}
            </button>
            <button onClick={() => props.sendLogDemand(true)} style={{ marginTop: "10px" }}>
              Envoyer le log
            </button>
          </div>

          <div className={styles.controlBox}>
            <h2 style={{color : "#51ff00"}}>Simulateur de Rythme Cardiaque</h2>
            <label style={{color : "#51ff00"}}>Rythme sélectionné :</label>
            <button onClick={() => setIsRhythmModalOpen(true)} style={{color : "#51ff00"}}>Sélectionner un rythme</button>
            <p style={{ textAlign: "center", margin: "15px 0" }}>
              <strong style={{ color: "#3498db", fontSize: "1.1em" }}>{props.rhythmLabel}</strong>
            </p>
            <button onClick={props.sendRhythm} style={{ marginTop: "auto" }}>Envoyer le Rythme</button>
          </div>

          <div className={styles.controlBox}>
            <h2 style={{color : "#51ff00"}}>Simulateur ECG</h2>
            <label style={{color : "#51ff00"}}>BPM: {props.bpm}</label>
            <input type="range" min="0" max="200" value={props.bpm} onChange={(e) => props.setBpm(Number(e.target.value))} />
            
            <label style={{color : "#e5ff00"}}>SpO2 (%): {props.spo2}</label>
            <input type="range" min="0" max="100" value={props.spo2} onChange={(e) => props.setSpo2(Number(e.target.value))} style={{color : "#e5ff00"}}/>
            
            <button onClick={props.sendECG} style={{ marginTop: "auto", color : "#e5ff00" }} >Envoyer l'ECG</button>
          </div>

          <div className={styles.controlBox}>
            <h2 style={{color : "#ff0000"}}>Simulateur de Pression</h2>
            <label>Systolique (mmHg): {props.systolic}</label>
            <input type="range" min="0" max="300" value={props.systolic} onChange={(e) => props.setSystolic(Number(e.target.value))} />
            
            <label>Diastolique (mmHg): {props.diastolic}</label>
            <input type="range" min="0" max="200" value={props.diastolic} onChange={(e) => {
              const val = Number(e.target.value);
              props.setDiastolic(val);
              if(val > props.systolic) props.setSystolic(val);
            }} />
            
            <button onClick={props.sendPressure} style={{ marginTop: "auto" }}>Envoyer Donnée de Respiration</button>
          </div>

          <div className={styles.controlBox}>
            <h2>CO2 et Respiration</h2>
            <label>CO2 (mmHg): {props.co2}</label>
            <input type="range" min="0" max="100" value={props.co2} onChange={(e) => props.setCo2(Number(e.target.value))} />
            <button onClick={props.sendCO2} style={{ marginBottom: "10px" }}>Envoyer Donnée CO2 </button>

            <label>Fréquence (resp/min): {props.respiration}</label>
            <input type="range" min="0" max="60" value={props.respiration} onChange={(e) => props.setRespiration(Number(e.target.value))} />
            <button onClick={props.sendRespiration} style={{ marginTop: "auto" }}>Envoyer Donnée de Respiration</button>
          </div>

          <div className={styles.controlBox}>
            <h2>Capteurs et constantes</h2>

            <div style={{ marginBottom: "15px", paddingBottom: "15px", borderBottom: "1px solid #444" }}>
              <label htmlFor="remoteControlSwitch" style={{ color: "#3498db", fontWeight: "bold" }}>
                Forcer l'affichage (Control Panel)
              </label>
              <input 
                type="checkbox" 
                id="remoteControlSwitch" 
                checked={props.isRemoteControl} 
                onChange={(e) => props.sendControlMode(e.target.checked)}
              />
            </div>

            <label htmlFor="hrDotted">ECG</label>
            <input type="checkbox" id="hrDotted" checked={!props.hrDotted} onChange={(e) => props.sendHRDotted(!e.target.checked)}/>
            
            <label htmlFor="pressureDotted">SpO2</label>
            <input type="checkbox" id="pressureDotted" checked={!props.pressureDotted} onChange={(e) => props.sendPressureDotted(!e.target.checked)}/>
            
            <label htmlFor="co2Dotted">CO2</label>
            <input type="checkbox" id="co2Dotted" checked={!props.co2Dotted} onChange={(e) => props.sendCO2Dotted(!e.target.checked)}/>
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

            <button onClick={() => setIsRhythmModalOpen(false)} className={styles.closeBtn}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}

function RhythmButton({ value, label, img, onSelect }: { value: string, label: string, img: string, onSelect: (v: string, l: string) => void }) {
  return (
    <button onClick={() => onSelect(value, label)}>
      <img src={img} alt={label} />
      {label}
    </button>
  );
}