"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWebSocket } from "../../context/WebSocketContext";
import styles from "../../styles/dashboard.module.css";
import { useInternalTimer } from "./Timer";
import { startLog } from "./Log";

interface SensorData {
  label: string;
  value: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { lastMessage, sessionId } = useWebSocket();

  // --- États ---
  const [cards, setCards] = useState<Record<string, SensorData>>({});
  const [username, setUsername] = useState<string>("Loading...");
  const { startTimer, stopTimer, resetTimer, getCurrentTime } = useInternalTimer();
  const { appendToLog, downloadLogFile } = startLog();

  // --- 1. Signal Triage ---
  useEffect(() => {
    if (!lastMessage) return;
    const data = lastMessage;

    console.log("[Dashboard] Received:", data);

    if (data.type === "sync_state") {
      const patient = data.patient || {};
      const device = data.device || {};
      setCards(prev => {
        const next = { ...prev };
        
        const bpm = patient.heartRate ?? "N/A";
        const spo2 = patient.spo2 ?? "N/A";
        next["card-ecg"] = { label: "Paramètres Vitaux (ECG/SpO2)", value: `BPM: ${bpm} | Spo2: ${spo2}%`, timestamp: getCurrentTime() };
        
        const co2 = patient.co2 ?? "N/A";
        next["card-co2"] = { label: "Capnographie (CO2)", value: `${co2} mmHg`, timestamp: getCurrentTime() };
        
        const sys = patient.bloodPressure?.systolic ?? "N/A";
        const dia = patient.bloodPressure?.diastolic ?? "N/A";
        next["card-pressure"] = { label: "Pression Artérielle", value: `${sys}/${dia} mmHg`, timestamp: getCurrentTime() };
        
        const resp = patient.respiratoryRate ?? "N/A";
        next["card-respiration"] = { label: "Fréquence Respiratoire", value: `${resp} resp/min`, timestamp: getCurrentTime() };
        
        const rhythm = patient.rhythmType ?? "N/A";
        next["card-rhythm"] = { label: "Rythme Cardiaque", value: rhythm, timestamp: getCurrentTime() };
        
        const mode = device.displayMode ?? "ARRET";
        const energy = device.manualEnergy ?? 0;
        next["card-defib-action"] = { label: "Action Défibrillateur", value: `Mode: ${mode} | Énergie: ${energy}J | Action: Sync`, timestamp: getCurrentTime() };
        
        return next;
      });
      return;
    }

    let cardId = "";
    let displayLabel = "";
    let displayValue = "";

    // Extraction et formatage selon le protocole V2
    if (data.type === "ecg" || (data.dataType === "sensor" && (data.bpm !== undefined || data.spo2 !== undefined))) {
      cardId = "card-ecg";
      displayLabel = "Paramètres Vitaux (ECG/SpO2)";
      const bpm = data.bpm ?? data.heartRate ?? "N/A";
      const spo2 = data.spo2 ?? "N/A";
      displayValue = `BPM: ${bpm} | Spo2: ${spo2}%`;
    }
    else if (data.type === "defibrillator_action") {
      cardId = "card-defib-action";
      displayLabel = "Action Défibrillateur";
      const mode = data.display_mode ?? data.newMode ?? data.mode ?? "Manuel";
      const energy = data.energy ?? data.newEnergy ?? "N/A";
      displayValue = `Mode: ${mode} | Énergie: ${energy}J | Action: ${data.action ?? "N/A"}`;
    }
    else if (data.type === "pressure" || (data.dataType === "sensor" && (data.systolic !== undefined || data.diastolic !== undefined))) {
      cardId = "card-pressure";
      displayLabel = "Pression Artérielle";
      displayValue = `${data.systolic ?? "N/A"}/${data.diastolic ?? "N/A"} mmHg`;
    }
    else if (data.type === "co2" || (data.dataType === "sensor" && data.co2 !== undefined)) {
      cardId = "card-co2";
      displayLabel = "Capnographie (CO2)";
      displayValue = `${data.co2 ?? "N/A"} mmHg`;
    }
    else if (data.type === "respiration" || (data.dataType === "sensor" && data.respirationRate !== undefined)) {
      cardId = "card-respiration";
      displayLabel = "Fréquence Respiratoire";
      displayValue = `${data.respirationRate ?? "N/A"} resp/min`;
    }
    else if (data.type === "rhythm" || (data.dataType === "sensor" && data.rhythm)) {
      cardId = "card-rhythm";
      displayLabel = "Rythme Cardiaque";
      displayValue = `${data.rhythmLabel ?? data.rhythm ?? "N/A"}`;
    }
    else if (data.type === "scenario") {
      cardId = "card-scenario";
      displayLabel = "Scénario en cours";
      displayValue = `${data.title ?? data.action ?? "N/A"} ${data.step !== undefined ? `(Étape ${data.step + 1})` : ""}`;
    }
    else if (data.type === "Prscope") {
      if (data.dataType === "defib") {
        cardId = "PrDefib"
        displayLabel = "Defib SPO2 montrée"
        displayValue = `${!data.isDefibPressureDotted}`
      }
      else {
      cardId = "PrScope";
      displayLabel = "Scope SPO2 montrée";
      displayValue = `${!data.isPressureDotted}`
    }}
    else if (data.type === "HRscope") {
      if (data.dataType === "defib") {
        cardId = "HRDefib"
        displayLabel = "Defib FC montrée"
        displayValue = `${!data.isDefibHRDotted}`
      }
      else {
      cardId = "HRScope";
      displayLabel = "Scope FC montrée";
      displayValue = `${!data.isHRDotted}`
    }}
    else if (data.type === "COscope") {
      if (data.dataType === "defib") {
        cardId = "CODefib"
        displayLabel = "Defib CO2 montrée"
        displayValue = `${!data.isDefibCO2Dotted}`
      }
      cardId = "COScope";
      displayLabel = "Scope CO2 montrée";
      displayValue = `${!data.isCO2Dotted}`
    }
      else if (data.type === "simu_start" || (data.dataType === "control" && data.start)) {
      if (data.action == "start") {
        startTimer();
        const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        console.log("Exercise started")
        appendToLog(`Exercice démarré à ${time}`)
      } else {
        stopTimer();
        console.log(`Timer stopped at ${getCurrentTime()}`);
        appendToLog(`Exercice pausé au bout de ${Math.floor(getCurrentTime() / 60)} minutes ${getCurrentTime() % 60} secondes`);
      }
      cardId = "card-session";
      displayLabel = "Exercice :";
      displayValue = displayValue = (data.action === "start") ? `En cours ` : `En pause : ${Math.floor(getCurrentTime() / 60)} minutes ${getCurrentTime() % 60} secondes`;
    }
    else if (data.type === "demandlog" || (data.dataType === "control" && data.demandlog)) {
      resetTimer();
      const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      appendToLog(`Exercice terminé à ${time}`)
      downloadLogFile();
      cardId = "card-log";
      displayLabel = "Log demandé"
      displayValue = "Log envoyé"
    }
    else if (data.type === "HRscope" || (data.dataType === "scope" && data.isHRDotted)) {
      cardId = "card-activationHR"
      displayLabel = `Heart Rate Scope`
      if (data.isHRDotted === false) {
        displayValue = "Activated"
        const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        appendToLog(`Patch ECG posé à ${time} (à ${Math.floor(getCurrentTime() / 60)} minutes ${getCurrentTime() % 60} secondes)`)
        console.log(getCurrentTime())
      } else if (data.isHRDotted === true) {
        displayValue = "Deactivated"
        const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        appendToLog(`Patch ECG déconnecté à ${time} (à ${Math.floor(getCurrentTime() / 60)} minutes ${getCurrentTime() % 60} secondes)`)
      }
    }
    else if (data.type === "Prscope" || (data.dataType === "scope" && data.isPressureDotted)) {
      cardId = "card-activationSPO2"
      displayLabel = `SpO2 scope`
      if (data.isPressureDotted === false) {
        displayValue = "Activated"
        const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        appendToLog(`Oxymètre posé à ${time} (à ${Math.floor(getCurrentTime() / 60)} minutes ${getCurrentTime() % 60} secondes secondes)`)
      } else if (data.isHRDotted === true) {
        displayValue = "Deactivated"
        const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        appendToLog(`Oxymètre ECG déconnecté à ${time} (à ${Math.floor(getCurrentTime() / 60)} minutes ${getCurrentTime() % 60} secondes secondes)`)
      }
    } else if (data.type === "COscope" || (data.dataType === "scope" && data.isCO2Dotted)) {
      cardId = "card-activationCO2"
      displayLabel = `CO2 scope`
      if (data.isCO2Dotted === false) {
        displayValue = "Activated"
        const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        appendToLog(`Capngraphe posé à ${time} (à ${Math.floor(getCurrentTime() / 60)} minutes ${getCurrentTime() % 60} secondes)`)
      } else if (data.isHRDotted === true) {
        displayValue = "Deactivated"
        const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        appendToLog(`Capnographe déconnecté à ${time} (à ${Math.floor(getCurrentTime() / 60)} minutes ${getCurrentTime() % 60} secondes)`)
      }
    } 
    else {
      // Fallback pour données brutes
      cardId = "card-" + (data.type ?? "unknown");
      displayLabel = data.type ?? "Données";
      displayValue = typeof data === 'object' ? JSON.stringify(data) : String(data);
    }

    setCards((prevCards) => ({
      ...prevCards,
      [cardId]: { label: displayLabel, value: displayValue },
    }));
  }, [lastMessage]);

  const handleLogout = () => {
    sessionStorage.removeItem("username");
    router.push("/connect");
  };

  const activeCardIds = Object.keys(cards);

  return (
    <div className={styles.container}>
      <div className={styles.userHeader}>
        <span>Session: <strong>{sessionId}</strong></span>
        <button onClick={handleLogout} className={styles.logoutBtn}>
          Quitter
        </button>
      </div>

      <h1>Monitorage Live (Backend Brain)</h1>
    
      <div style={{ display: "flex", flexDirection: "row", gap: "30px", width: "100%", height: "65vh", marginBottom: "30px" }}>
        
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <h2>Aperçu du Moniteur (Scope)</h2>
          <div style={{ flex: 1, position: "relative", backgroundColor: "#000", borderRadius: "8px", overflow: "hidden" }}>
            <iframe 
              src={`/scope?username=${sessionId}`} 
              title="Scope Preview"
              allow="autoplay"
              style={{
                width: "100%",    
                height: "100%", 
                transform: "scale(0.90)",
                transformOrigin: "center center",
                border: "none"
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <h2>Aperçu du Défibrillateur</h2>
          <div style={{ flex: 1, position: "relative", backgroundColor: "#000", borderRadius: "8px", overflow: "hidden" }}>
            <iframe 
              src={`/defibrillator?username=${sessionId}`} 
              title="Defib Preview"
              allow="autoplay"
              style={{
                width: "100%",    
                height: "100%", 
                border: "none",
                transform: "scale(0.90)",
                transformOrigin: "center center",
              }}
            />
          </div>
        </div>

      </div>

      <div className={styles.dashboardGrid}>
        {activeCardIds.length > 0 ? (
          activeCardIds.map((id) => (
            <div key={id} className={styles.sensorCard}>
              <h2>{cards[id].label}</h2>
              <div className={styles.dataValue}>{cards[id].value}</div>
              <div className={styles.statusLive}>● Live</div>
            </div>
          ))
        ) : (
          <p className={styles.emptyState}>
            En attente de données provenant du backend authoritative...
          </p>
        )}
      </div>
    </div>
  );
}
