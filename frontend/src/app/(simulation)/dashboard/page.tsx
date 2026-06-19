"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWebSocket } from "../../context/WebSocketContext";
import styles from "../../styles/dashboard.module.css";

interface SensorData {
  label: string;
  value: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { lastMessage, sessionId } = useWebSocket();

  // --- États ---
  const [cards, setCards] = useState<Record<string, SensorData>>({});

  // --- 1. Signal Triage ---
  useEffect(() => {
    if (!lastMessage) return;
    const data = lastMessage;

    console.log("[Dashboard] Received:", data);

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
      <div style={{ flex: "1.5 1 600px", height: "70vh", position: "sticky", top: "20px", display: "flex", flexDirection: "column" }}>
          <h2>Aperçu du Moniteur (Scope)</h2>
          <div style={{ flex: 1, position: "relative", width: "100%", height: "100%", backgroundColor: "#000", borderRadius: "8px", overflow: "hidden" }}>
            <iframe 
              src={`/scope?username=${sessionId}`} 
              title="Scope Preview"
              allow="autoplay"
              style={{
                width: "100%",     
                height: "100%", 
                transform: "scale(0.75)",
                border: "none"
              }}
            />
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
