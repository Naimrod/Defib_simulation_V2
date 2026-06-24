import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { RhythmType } from '../components/graphsdata/ECGRhythms';

export interface VitalsState {
  rhythm: string;
  fcValue: boolean;
  bpm: number;
  isHRDotted: boolean;
  spo2: number;
  isPressureDotted: boolean;
  co2: number;
  resp: number;
  isCO2Dotted: boolean;
  systolic: number;
  diastolic: number;
  pouls: number;
  isRemoteControl: boolean;
  isDefibHRDotted: boolean;
  isDefibPressureDotted: boolean;
  isDefibCO2Dotted: boolean;
  isDefibRemoteControl: boolean;
}

export const useVitals = () => {
  const { lastMessage, sessionId, sendMessage, deviceId, isConnected } = useWebSocket();

  const [vitals, setVitals] = useState<VitalsState>({
    rhythm: 'sinusRhythm',
    fcValue: false,
    bpm: 70,
    isHRDotted: true,
    spo2: 98,
    isPressureDotted: true,
    co2: 40,
    resp: 15,
    isCO2Dotted: true,
    systolic: 120,
    diastolic: 80,
    pouls: 70,
    isRemoteControl: true,
    isDefibHRDotted: true,
    isDefibPressureDotted: true,
    isDefibCO2Dotted: true,
    isDefibRemoteControl: true,
  });

  // --- REQUEST SIMULATION STATE SYNC ---
  useEffect(() => {
    if (isConnected) {
      sendMessage({
        type: "request_sync",
        session_id: sessionId,
        source_device: deviceId
      });
    }
  }, [isConnected, sessionId, deviceId, sendMessage]);

  useEffect(() => {
    if (!lastMessage) return;
    const msg = lastMessage as any;
    console.log("[useVitals] Received WebSocket message:", msg);

    const rhythmMap: Record<string, string> = {
      'sinusal': 'sinus',
      'tachy_a': "tachycardieAtriale",
      'tsv': "tsv",
      'jonctionnel': "jonctionnel",
      'flutt_a': "flutterAtrial",
      'rs_hvg': "sinusHVG",
      'rs_hd': "sinusHD",
      'rs_hvd': "sinusHVD",
      'fib_a': 'fibrillationAtriale',
      '1_bav': 'bav1',
      '2_bav_I': "bav2Type1",
      '2_bav_II': "bav2Type2",
      '3_bav': 'bav3',
      'fv': 'fibrillationVentriculaire',
      'FV': 'fibrillationVentriculaire',
      'tv_1': 'tachycardieVentriculaire',
      'tv_2': "tvType2",
      'tors': "torsade",
      'idiov': "idioventriculaire",
      'stim': 'electroEntrainement',
      'seq': 'electroEntrainement',
      'p_cap': 'electroEntrainement',
      'arret': 'asystole',
      'asysto': 'asystole',
      'choc': 'choc',
    };

    if (msg.type === "sync_state") {
      const patient = msg.patient || {};
      const device = msg.device || {};
      setVitals(prev => ({
        ...prev,
        bpm: patient.heartRate ?? prev.bpm,
        spo2: patient.spo2 ?? prev.spo2,
        co2: patient.co2 ?? prev.co2,
        resp: patient.respiratoryRate ?? prev.resp,
        systolic: patient.bloodPressure?.systolic ?? prev.systolic,
        diastolic: patient.bloodPressure?.diastolic ?? prev.diastolic,
        pouls: patient.heartRate ?? prev.pouls,
        rhythm: rhythmMap[patient.rhythmType] || patient.rhythmType || prev.rhythm,
        isHRDotted: device.hrDotted !== undefined ? device.hrDotted : prev.isHRDotted,
        isPressureDotted: device.pressureDotted !== undefined ? device.pressureDotted : prev.isPressureDotted,
        isCO2Dotted: device.co2Dotted !== undefined ? device.co2Dotted : prev.isCO2Dotted,
        isRemoteControl: device.isRemoteControl !== undefined ? device.isRemoteControl : prev.isRemoteControl,
        isDefibHRDotted: device.defibHrDotted !== undefined ? device.defibHrDotted : prev.isDefibHRDotted,
        isDefibPressureDotted: device.defibPressureDotted !== undefined ? device.defibPressureDotted : prev.isDefibPressureDotted,
        isDefibCO2Dotted: device.defibCo2Dotted !== undefined ? device.defibCo2Dotted : prev.isDefibCO2Dotted,
        isDefibRemoteControl: device.isDefibRemoteControl !== undefined ? device.isDefibRemoteControl : prev.isDefibRemoteControl
      }));
    } else if (msg.type === "ecg") {
      setVitals(prev => {
        const hr = msg.heartRate ?? msg.bpm ?? prev.bpm;
        return {
          ...prev,
          bpm: hr,
          spo2: msg.spo2 ?? prev.spo2,
          pouls: hr
        };
      });
    } else if (msg.type === "rhythm") {
      const canonicalRhythm = rhythmMap[msg.rhythm] || msg.rhythm;
      setVitals(prev => ({
        ...prev,
        rhythm: canonicalRhythm
      }));
    } else if (msg.type === "co2") {
      setVitals(prev => ({ ...prev, co2: msg.co2 ?? prev.co2 }));
    } else if (msg.type === "pressure") {
      setVitals(prev => ({
        ...prev,
        systolic: msg.systolic ?? prev.systolic,
        diastolic: msg.diastolic ?? prev.diastolic
      }));
    } else if (msg.type === "respiration") {
      setVitals(prev => ({ ...prev, resp: msg.respirationRate ?? prev.resp }));
    } else if (msg.type === "HRscope") {
      if (msg.dataType === "defib") {
        setVitals(prev => ({ ...prev, isDefibHRDotted: msg.isDefibHRDotted, fcValue: !msg.isDefibHRDotted }));
      } else {
        setVitals(prev => ({ ...prev, isHRDotted: msg.isHRDotted, fcValue: !msg.isHRDotted }));
      }
    } else if (msg.type === "Prscope") {
      if (msg.dataType === "defib") {
        setVitals(prev => ({ ...prev, isDefibPressureDotted: msg.isDefibPressureDotted }));
      } else {
        setVitals(prev => ({ ...prev, isPressureDotted: msg.isPressureDotted }));
      }
    } else if (msg.type === "COscope") {
      if (msg.dataType === "defib") {
        setVitals(prev => ({ ...prev, isDefibCO2Dotted: msg.isDefibCO2Dotted }));
      } else {
        setVitals(prev => ({ ...prev, isCO2Dotted: msg.isCO2Dotted }));
      }
    } else if (msg.isRemoteControl !== undefined && msg.isRemoteControl !== null) {
      if (msg.dataType === "defib") {
        setVitals(prev => ({ ...prev, isDefibRemoteControl: msg.isDefibRemoteControl }));
      } else {
        setVitals(prev => ({ ...prev, isRemoteControl: msg.isRemoteControl }));
      }
    } else if (msg.type === "visibility_state") {
      setVitals(prev => ({
        ...prev,
        isHRDotted: msg.hrDotted !== undefined ? msg.hrDotted : prev.isHRDotted,
        isPressureDotted: msg.pressureDotted !== undefined ? msg.pressureDotted : prev.isPressureDotted,
        isCO2Dotted: msg.co2Dotted !== undefined ? msg.co2Dotted : prev.isCO2Dotted,
        fcValue: msg.hrDotted !== undefined ? !msg.hrDotted : prev.fcValue,
        isDefibHRDotted: msg.defibHrDotted !== undefined ? msg.defibHrDotted : prev.isDefibHRDotted,
        isDefibPressureDotted: msg.defibPressureDotted !== undefined ? msg.defibPressureDotted : prev.isDefibPressureDotted,
        isDefibCO2Dotted: msg.defibCo2Dotted !== undefined ? msg.defibCo2Dotted : prev.isDefibCO2Dotted,
        isDefibRemoteControl: msg.isDefibRemoteControl !== undefined ? msg.isDefibRemoteControl : prev.isDefibRemoteControl,
        isRemoteControl: msg.isRemoteControl !== undefined ? msg.isRemoteControl : prev.isRemoteControl
      }));
    } else if (msg.type === "defibrillator_action") {
      if (msg.action === "toggle_fc") {
        setVitals(prev => {
          const show_fc = msg.show_fc !== undefined ? msg.show_fc : !prev.fcValue;
          return { ...prev, fcValue: show_fc, isHRDotted: !show_fc };
        });
      } else if (msg.action === "toggle_vitals") {
        setVitals(prev => {
          const show_vitals = msg.show_vitals !== undefined ? msg.show_vitals : prev.isPressureDotted;
          return { ...prev, isPressureDotted: !show_vitals, isCO2Dotted: !show_vitals };
        });
      } else if (msg.action === "set_display_mode") {
        if (msg.display_mode === "ARRET") {
          setVitals(prev => ({
            ...prev,
            fcValue: false,
            isHRDefibDotted: true,
            isPressureDefibDotted: true,
            isCO2DefibDotted: true
          }));
        }
      }
    }
  }, [lastMessage]);

  const logout = useCallback(() => {
    localStorage.removeItem("username");
    window.location.href = "/connect";
  }, []);

  // Calculate pulse state on the fly
  const pulselessRhythms = ["fibrillationVentriculaire", "asystole", "fv", "asysto", "arret"];
  const hasPulse = !pulselessRhythms.includes(vitals.rhythm);

  // Force SpO2 (Pressure) to be dotted if there is no pulse
  const exportedVitals = {
      ...vitals,
      // If hasPulse is false, we force it to `true` (dotted)
      // Otherwise, we respect whatever the Control Panel set
      isPressureDotted: !hasPulse ? true : vitals.isPressureDotted,
      isDefibPressureDotted: !hasPulse ? true : vitals.isDefibPressureDotted,
      // CO2 drops to CPR levels during cardiac arrest
      co2: !hasPulse ? 15 : vitals.co2
  };

  return {
    vitals: exportedVitals, // Return the medically accurate vitals
    hasPulse,               // Export hasPulse so UI elements can hide text values
    username: sessionId || 'anonymous',
    logout
  };
};