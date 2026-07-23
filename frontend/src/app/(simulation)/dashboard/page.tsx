"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWebSocket } from "../../context/WebSocketContext";
import PageHeader from "../../components/PageHeader";

interface SensorData {
  label: string;
  value: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { activeDevices, subscribeMessage, sessionId } = useWebSocket();

  // --- États ---
  const [cards, setCards] = useState<Record<string, SensorData>>({});
  const [username, setUsername] = useState<string>("Loading...");

  // --- 1. Signal Triage ---
  useEffect(() => {
    const handleMessage = (data: any) => {
      if (!data) return;

      console.log("[Dashboard] Received:", data);

      if (data.type === "sync_state") {
        const patient = data.patient || {};
        const device = data.device || {};
        setCards(prev => {
          const next = { ...prev };
          
          const bpm = patient.heartRate ?? "N/A";
          const spo2 = patient.spo2 ?? "N/A";
          next["card-ecg"] = { label: "Paramètres Vitaux (ECG/SpO2)", value: `BPM: ${bpm} | Spo2: ${spo2}%` };
          
          const co2 = patient.co2 ?? "N/A";
          next["card-co2"] = { label: "Capnographie (CO2)", value: `${co2} mmHg` };
          
          const sys = patient.bloodPressure?.systolic ?? "N/A";
          const dia = patient.bloodPressure?.diastolic ?? "N/A";
          next["card-pressure"] = { label: "Pression Artérielle", value: `${sys}/${dia} mmHg` };
          
          const resp = patient.respiratoryRate ?? "N/A";
          next["card-respiration"] = { label: "Fréquence Respiratoire", value: `${resp} resp/min` };
          
          const rhythm = patient.rhythmType ?? "N/A";
          next["card-rhythm"] = { label: "Rythme Cardiaque", value: rhythm };
          
          const mode = device.displayMode ?? "ARRET";
          const energy = device.manualEnergy ?? 0;
          next["card-defib-action"] = { label: "Action Défibrillateur", value: `Mode: ${mode} | Énergie: ${energy}J | Action: Sync` };
          
          return next;
        });
        return;
      }

      let cardId = "";
      let displayLabel = "";
      let displayValue = "";

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
          cardId = "PrDefib";
          displayLabel = "Defib SPO2 montrée";
          displayValue = `${!data.isDefibPressureDotted}`;
        } else {
          cardId = "PrScope";
          displayLabel = "Scope SPO2 montrée";
          displayValue = `${!data.isPressureDotted}`;
        }
      }
      else if (data.type === "HRscope") {
        if (data.dataType === "defib") {
          cardId = "HRDefib";
          displayLabel = "Defib FC montrée";
          displayValue = `${!data.isDefibHRDotted}`;
        } else {
          cardId = "HRScope";
          displayLabel = "Scope FC montrée";
          displayValue = `${!data.isHRDotted}`;
        }
      }
      else if (data.type === "COscope") {
        if (data.dataType === "defib") {
          cardId = "CODefib";
          displayLabel = "Defib CO2 montrée";
          displayValue = `${!data.isDefibCO2Dotted}`;
        } else {
          cardId = "COScope";
          displayLabel = "Scope CO2 montrée";
          displayValue = `${!data.isCO2Dotted}`;
        }
      }
      else {
        cardId = "card-" + (data.type ?? "unknown");
        displayLabel = data.type ?? "Données";
        displayValue = typeof data === 'object' ? JSON.stringify(data) : String(data);
      }

      setCards((prevCards) => ({
        ...prevCards,
        [cardId]: { label: displayLabel, value: displayValue },
      }));
    };

    const unsubscribe = subscribeMessage(handleMessage);
    return () => unsubscribe();
  }, [subscribeMessage]);

  const handleLogout = () => {
    localStorage.removeItem("username");
    router.push("/connect");
  };

  const activeCardIds = Object.keys(cards);

  return (
    <div className="font-sans bg-black text-white min-h-screen flex flex-col">
      <PageHeader title="Monitorage Live (Backend Brain)" icon="📊" username={sessionId} onLogout={handleLogout} />
    
      <div className="p-[30px] flex-1 flex flex-col">
        
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <h2 className="text-xl font-semibold mb-3">Aperçu du Moniteur (Scope)</h2>
          <div style={{ flex: 1, position: "relative", backgroundColor: "#000", borderRadius: "8px", overflow: "hidden" }}>
            <iframe 
              src={`/scope?username=${sessionId}&id=CONTR`}
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
          <h2 className="text-xl font-semibold mb-3">Aperçu du Défibrillateur</h2>
          <div style={{ flex: 1, position: "relative", backgroundColor: "#000", borderRadius: "8px", overflow: "hidden" }}>
            <iframe 
              src={`/defibrillator?username=${sessionId}&id=CONTR`}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl w-full mx-auto">
        {activeCardIds.length > 0 ? (
          activeCardIds.map((id) => (
            <div key={id} className="bg-[#1a1a1a] p-6 border border-gray-700 rounded-xl relative shadow-lg flex flex-col justify-between">
              <h2 className="text-lg font-bold text-gray-200">{cards[id].label}</h2>
              <div className="text-2xl font-bold text-cyan-400 mt-2">{cards[id].value}</div>
              <div className="text-xs text-green-400 font-bold mt-3 flex items-center gap-1.5">● Live</div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 italic text-center col-span-full py-8">
            En attente de données provenant du backend authoritative...
          </p>
        )}
      </div>
    </div>
  );
}
