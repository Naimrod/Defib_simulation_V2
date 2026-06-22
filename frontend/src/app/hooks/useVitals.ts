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
  const { lastMessage, sessionId } = useWebSocket();

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
        const { patient, device } = msg;
        setVitals(prev => ({
            ...prev,
            rhythm: rhythmMap[patient.rhythmType] || patient.rhythmType,
            bpm: patient.heartRate,
            spo2: patient.spo2,
            co2: patient.co2,
            systolic: patient.bloodPressure.systolic,
            diastolic: patient.bloodPressure.diastolic,
            resp: patient.respiratoryRate,
            pouls: patient.pulse ?? patient.heartRate,

            // Pull Scope-specific visibility states
            isHRDotted: device.hrDotted,
            fcValue: !device.hrDotted,
            isPressureDotted: device.pressureDotted,
            isCO2Dotted: device.co2Dotted,
            isRemoteControl: device.isRemoteControl
        }));
        return;
    }

    if (msg.type === "ecg") {
      setVitals(prev => ({
        ...prev,
        bpm: msg.bpm ?? prev.bpm,
        spo2: msg.spo2 ?? prev.spo2,
        pouls: msg.pulse ?? msg.bpm ?? prev.pouls
      }));
    } else if (msg.type === "rhythm") {
      const canonicalRhythm = rhythmMap[msg.rhythm] || msg.rhythm;
      setVitals(prev => ({
        ...prev,
        rhythm: canonicalRhythm
      }));
    } else if (msg.type === "co2") {
      setVitals(prev => ({
        ...prev,
        co2: msg.co2 ?? prev.co2
      }));
    } else if (msg.type === "pressure") {
      setVitals(prev => ({
        ...prev,
        systolic: msg.systolic ?? prev.systolic,
        diastolic: msg.diastolic ?? prev.diastolic
      }));
    } else if (msg.type === "respiration") {
      setVitals(prev => ({
        ...prev,
        resp: msg.respirationRate ?? prev.resp
      }));
    } else if (msg.type === "HRscope") {
      if (msg.dataType === "defib") {
      setVitals(prev => ({
        ...prev,
        isDefibHRDotted: msg.isDefibHRDotted,
        fcValue: !msg.isDefibHRDotted
      }));}
      else {
        setVitals(prev => ({
        ...prev,
        isHRDotted: msg.isHRDotted,
        fcValue: !msg.isHRDotted
      }));
      }
    } else if (msg.type === "Prscope") {
      if (msg.dataType === "defib") {
      setVitals(prev => ({
        ...prev,
        isDefibPressureDotted: msg.isDefibPressureDotted,
      }));}
      else {
      setVitals(prev => ({
        ...prev,
        isPressureDotted: msg.isPressureDotted
      }));}
    } else if (msg.type === "COscope") {
      if (msg.dataType === "defib") {
      setVitals(prev => ({
        ...prev,
        isDefibCO2Dotted: msg.isDefibCO2Dotted,
      }));}
      else {
      setVitals(prev => ({
        ...prev,
        isCO2Dotted: msg.isCO2Dotted
      }));}
    } else if (msg.isRemoteControl !== undefined && msg.isRemoteControl !== null) {
      if (msg.dataType === "defib") {
      setVitals(prev => ({
        ...prev,
        isDefibRemoteControl: msg.isDefibRemoteControl,
      }));}
      else {
      setVitals(prev => ({
        ...prev,
        isRemoteControl: msg.isRemoteControl
      }));}
    } else if (msg.type === "visibility_state") {
      setVitals(prev => ({
        ...prev,
        isHRDotted: msg.hrDotted !== undefined ? msg.hrDotted : prev.isHRDotted,
        isPressureDotted: msg.pressureDotted !== undefined ? msg.pressureDotted : prev.isPressureDotted,
        isCO2Dotted: msg.co2Dotted !== undefined ? msg.co2Dotted : prev.isCO2Dotted,
        fcValue: msg.hrDotted !== undefined ? !msg.hrDotted : prev.fcValue
      }));
    } else if (msg.type === "defibrillator_action") {
      if (msg.action === "toggle_fc") {
        setVitals(prev => {
          const show_fc = msg.show_fc !== undefined ? msg.show_fc : !prev.fcValue;
          return {
            ...prev,
            fcValue: show_fc,
            isHRDotted: !show_fc
          };
        });
      } else if (msg.action === "toggle_vitals") {
        setVitals(prev => {
          const show_vitals = msg.show_vitals !== undefined ? msg.show_vitals : prev.isPressureDotted;
          return {
            ...prev,
            isPressureDotted: !show_vitals,
            isCO2Dotted: !show_vitals
          };
        });
      } else if (msg.action === "set_display_mode") {
        if (msg.display_mode === "ARRET") {
          setVitals(prev => ({
            ...prev,
            fcValue: false,
            isHRDotted: true,
            isPressureDotted: true,
            isCO2Dotted: true
          }));
        }
      }
    }
  }, [lastMessage]);

  const logout = useCallback(() => {
    sessionStorage.removeItem("username");
    window.location.href = "/connect";
  }, []);

  return {
    vitals,
    username: sessionId || 'anonymous',
    logout
  };
};
