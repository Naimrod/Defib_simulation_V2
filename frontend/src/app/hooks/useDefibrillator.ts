import { useState, useRef, useEffect, useCallback } from "react";
import { useAudio } from "../context/AudioContext";
import { useWebSocket } from "../context/WebSocketContext";
import { DisplayMode, PacerMode, DefibState, PatientState } from "@/types/simulation";

export interface LocalDefibState extends DefibState {
  isRemoteControl: boolean;
  show_spo2: boolean;
  show_co2: boolean;
}

export const useDefibrillator = () => {
  const { lastMessage, sendMessage, deviceId, sessionId } = useWebSocket();
  const audioService = useAudio();

  const [deviceState, setDeviceState] = useState<LocalDefibState>({
    display_mode: "ARRET",
    energy: 0,
    is_charging: false,
    is_charged: false,
    is_booting: false,
    is_synchro_mode: false,
    shock_count: 0,
    pacer_mode: "Fixe",
    pacer_frequency: 70,
    pacer_intensity: 30,
    is_pacing: false,
    show_fc: false,
    show_vitals: false,
    show_pni: false,
    is_pni_measuring: false,
    pni_step_value: null,
    
    isRemoteControl: true,
    show_spo2: false,
    show_co2: false,
  });

  const [patientState, setPatientState] = useState<PatientState>({
    heart_rate: 70,
    pulse: 70,
    rhythm_type: "rythm",
    blood_pressure: { systolic: 120, diastolic: 80 },
    respiratory_rate: 30,
    spo2: 98,
    co2: 40,
  });

  const [uiState, setUiState] = useState({
    isChargeButtonPressed: false,
    isShockButtonPressed: false,
    isShockButtonBlinking: false,
    selectedChannel: 1,
    lastEvent: null as string | null,
    showShockDelivered: false,
    showCPRMessage: false,
    chargeProgress: 0,
    bootProgress: 0, 
    bootTargetMode: null as DisplayMode | null,
  });

  const isBootingRef = useRef(false);
  const bootTargetModeRef = useRef<DisplayMode | null>(null);
  const chargeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bootIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearHardwareIntervals = useCallback(() => {
      if (chargeIntervalRef.current) clearInterval(chargeIntervalRef.current);
      if (bootIntervalRef.current) clearInterval(bootIntervalRef.current);
      chargeIntervalRef.current = null;
      bootIntervalRef.current = null;
  }, []);

  // --- INCOMING SIGNAL TRIAGE ---
  useEffect(() => {
    if (!lastMessage) return;
    const msg = lastMessage as any;

    if (msg.target_device && msg.target_device !== deviceId) return;

    const isGlobalSyncType = ["sync_state", "ecg", "rhythm", "co2", "pressure", "respiration"].includes(msg.type);
    if (msg.source_device === deviceId && !isGlobalSyncType && msg.action !== "shock_delivered") return;

    if (deviceId.startsWith("defibrillator") && msg.type === "defibrillator_action" && msg.source_device?.startsWith("defibrillator") && msg.source_device !== deviceId) return;

    if (msg.type === "defibrillator_action") setUiState(prev => ({ ...prev, lastEvent: msg.action }));
    else if (msg.type === "scenario" && msg.action === "step_validated") setUiState(prev => ({ ...prev, lastEvent: "stepValidated" }));

    const rhythmMap: Record<string, string> = {
        'sinusal': 'sinus', 'fv': 'fibrillationVentriculaire', 'tv_1': 'tachycardieVentriculaire',
        'tv_2': 'tachycardieVentriculaire', 'asysto': 'asystole', 'arret': 'asystole',
        'fib_a': 'fibrillationAtriale', '1_bav': 'bav1', '3_bav': 'bav3',
        'stim': 'electroEntrainement', 'seq': 'electroEntrainement', 'p_cap': 'electroEntrainement'
    };

    if (msg.type === "sync_state") {
      const patient = msg.patient || {};
      const device = msg.device || {};
      setPatientState(prev => ({
        ...prev,
        heart_rate: patient.heartRate ?? prev.heart_rate,
        pulse: patient.heartRate ?? prev.pulse,
        rhythm_type: rhythmMap[patient.rhythmType] || patient.rhythmType || prev.rhythm_type,
        blood_pressure: patient.bloodPressure ? { systolic: patient.bloodPressure.systolic, diastolic: patient.bloodPressure.diastolic } : prev.blood_pressure,
        respiratory_rate: patient.respiratoryRate ?? prev.respiratory_rate,
        spo2: patient.spo2 ?? prev.spo2,
        co2: patient.co2 ?? prev.co2,
      }));
      setDeviceState(prev => ({
        ...prev,
        display_mode: device.displayMode ?? prev.display_mode,
        energy: device.manualEnergy ?? prev.energy,
        is_pacing: device.isPacing ?? prev.is_pacing,
        pacer_frequency: device.pacerFrequency ?? prev.pacer_frequency,
        pacer_intensity: device.pacerIntensity ?? prev.pacer_intensity,
        is_synchro_mode: device.isSynchro ?? prev.is_synchro_mode,
        shock_count: device.shockCount ?? prev.shock_count,
        show_fc: device.defibHrDotted !== undefined ? !device.defibHrDotted : prev.show_fc,
        show_spo2: device.defibPressureDotted !== undefined ? !device.defibPressureDotted : prev.show_spo2,
        show_co2: device.defibCo2Dotted !== undefined ? !device.defibCo2Dotted : prev.show_co2,
        isRemoteControl: device.isDefibRemoteControl !== undefined ? device.isDefibRemoteControl : prev.isRemoteControl
      }));
    } else if (msg.type === "ecg") {
      setPatientState(prev => {
        const hr = msg.heartRate ?? msg.bpm ?? prev.heart_rate;
        return {
          ...prev,
          heart_rate: hr,
          pulse: msg.heartRate ?? msg.bpm ?? msg.pulse ?? prev.pulse,
          spo2: msg.spo2 ?? prev.spo2
        };
      });
    } else if (msg.type === "rhythm") {
      const rhythmMap: Record<string, string> = {
          'sinusal': 'sinus', 'fv': 'fibrillationVentriculaire', 'tv_1': 'tachycardieVentriculaire',
          'tv_2': 'tachycardieVentriculaire', 'asysto': 'asystole', 'arret': 'asystole',
          'fib_a': 'fibrillationAtriale', '1_bav': 'bav1', '3_bav': 'bav3',
          'stim': 'electroEntrainement', 'seq': 'electroEntrainement', 'p_cap': 'electroEntrainement'
      };
      setPatientState(prev => ({ ...prev, rhythm_type: rhythmMap[msg.rhythm] || msg.rhythm }));
    } else if (msg.type === "co2") {
      setPatientState(prev => ({ ...prev, co2: msg.co2 }));
    } else if (msg.type === "pressure") {
      setPatientState(prev => ({ ...prev, blood_pressure: { systolic: msg.systolic, diastolic: msg.diastolic } }));
    } else if (msg.type === "respiration") {
      setPatientState(prev => ({ ...prev, respiratory_rate: msg.respirationRate }));
    }
    else if (msg.type === "defibrillator_action") {
        handleIncomingAction(msg.action, msg);
    }
    
    // Explicitly reject visibility toggles if the Master Switch is OFF
    else if (msg.type === "visibility_state") {
      setDeviceState(prev => {
        const isRemote = msg.isDefibRemoteControl !== undefined ? msg.isDefibRemoteControl : prev.isRemoteControl;
        if (!isRemote) return { ...prev, isRemoteControl: isRemote }; // Allow unlocking, but ignore the rest
        
        return {
          ...prev,
          show_fc: msg.defibHrDotted !== undefined ? !msg.defibHrDotted : prev.show_fc,
          show_spo2: msg.defibPressureDotted !== undefined ? !msg.defibPressureDotted : prev.show_spo2,
          show_co2: msg.defibCo2Dotted !== undefined ? !msg.defibCo2Dotted : prev.show_co2,
          isRemoteControl: isRemote
        };
      });
    } else if (msg.type === "HRscope" && msg.dataType === "defib") {
      setDeviceState(prev => {
          if (!prev.isRemoteControl) { console.log("🔒 Lock Active: Ignored Control Panel FC toggle"); return prev; }
          return { ...prev, show_fc: !msg.isDefibHRDotted };
      });
    } else if (msg.type === "Prscope" && msg.dataType === "defib") {
      setDeviceState(prev => {
          if (!prev.isRemoteControl) { console.log("🔒 Lock Active: Ignored Control Panel SpO2 toggle"); return prev; }
          return { ...prev, show_spo2: !msg.isDefibPressureDotted };
      });
    } else if (msg.type === "COscope" && msg.dataType === "defib") {
      setDeviceState(prev => {
          if (!prev.isRemoteControl) { console.log("🔒 Lock Active: Ignored Control Panel CO2 toggle"); return prev; }
          return { ...prev, show_co2: !msg.isDefibCO2Dotted };
      });
    } else if (msg.type === "display_mode" && msg.dataType === "defib") {
      setDeviceState(prev => ({ ...prev, isRemoteControl: msg.isRemoteControl }));
    }
  }, [lastMessage, deviceId]);

  const handleIncomingAction = (action: string, payload: any) => {
      if (action === "set_energy") setDeviceState(prev => ({ ...prev, energy: payload.energy }));
      if (action === "start_charge") startCharging(true);
      if (action === "cancel_charge") cancelCharge(true);
      if (action === "deliver_shock") deliverShock(true);
      if (action === "boot_start") startBootSequence(payload.target_mode, true);
      
      if (action === "toggle_pni") setDeviceState(prev => ({ ...prev, show_pni: payload.show_pni ?? !prev.show_pni }));
      if (action === "set_display_mode") setDisplayMode(payload.display_mode, true);
      
      if (action === "pni_start") setDeviceState(prev => ({ ...prev, is_pni_measuring: true, pni_step_value: 160 }));
      if (action === "pni_step") setDeviceState(prev => ({ ...prev, pni_step_value: payload.value }));
      if (action === "pni_done") setDeviceState(prev => ({ ...prev, is_pni_measuring: false, show_pni: true, pni_step_value: null }));

      if (action === "toggle_pacing") setDeviceState(prev => ({ ...prev, is_pacing: payload.is_pacing ?? !prev.is_pacing }));
      if (action === "toggle_synchro") setDeviceState(prev => ({ ...prev, is_synchro_mode: payload.is_synchro_mode ?? !prev.is_synchro_mode }));
      if (action === "set_pacer_frequency") setDeviceState(prev => ({ ...prev, pacer_frequency: payload.frequency }));
      if (action === "set_pacer_intensity") setDeviceState(prev => ({ ...prev, pacer_intensity: payload.intensity }));
      if (action === "set_pacer_mode") setDeviceState(prev => ({ ...prev, pacer_mode: payload.mode }));
  };

  const sendLocalAction = useCallback((action: string, payload: any = {}) => {
      sendMessage({
          type: "defibrillator_action", action, simuType: "simulator_ui", dataType: "command",
          source_device: deviceId, session_id: sessionId, ...payload
      });
  }, [deviceId, sessionId, sendMessage]);

  const startBootSequence = useCallback((targetMode: DisplayMode, isRemote: boolean = false) => {
      if (isBootingRef.current) {
          if (bootTargetModeRef.current !== targetMode) {
              bootTargetModeRef.current = targetMode;
              setUiState(prev => ({ ...prev, bootTargetMode: targetMode }));
              if (!isRemote) sendLocalAction("boot_start", { target_mode: targetMode });
          }
          return;
      }
      clearHardwareIntervals();
      isBootingRef.current = true;
      bootTargetModeRef.current = targetMode;

      setDeviceState(prev => ({ ...prev, is_booting: true, display_mode: "ARRET" }));
      setUiState(prev => ({ ...prev, bootProgress: 0, bootTargetMode: targetMode, lastEvent: "bootStarted" }));

      let currentBootProgress = 0;
      const bootTimerId = setInterval(() => {
          currentBootProgress += 10;
          if (currentBootProgress >= 100) {
              clearInterval(bootTimerId);
              if (bootIntervalRef.current === bootTimerId) bootIntervalRef.current = null;
              isBootingRef.current = false;
              setDeviceState(d => ({ ...d, is_booting: false, display_mode: bootTargetModeRef.current || targetMode }));
              setUiState(u => ({ ...u, bootProgress: 100, lastEvent: "bootCompleted" }));
          } else {
              setUiState(u => ({ ...u, bootProgress: currentBootProgress }));
          }
      }, 100);
      bootIntervalRef.current = bootTimerId;
      if (!isRemote) sendLocalAction("boot_start", { target_mode: targetMode });
  }, [clearHardwareIntervals, sendLocalAction]);

  const startCharging = useCallback((isRemote: boolean = false) => {
    if (deviceState.is_charging || deviceState.is_charged) return;
    if (!isRemote && deviceState.display_mode !== "Manuel") return;

    setDeviceState(prev => ({ ...prev, is_charging: true }));
    setUiState(prev => ({ ...prev, chargeProgress: 0, lastEvent: "chargeStarted" }));
    audioService?.startChargingSound();

    if (chargeIntervalRef.current) clearInterval(chargeIntervalRef.current);
    let currentProgress = 0;
    const chargeTimerId = setInterval(() => {
      currentProgress += 5;
      if (currentProgress >= 100) {
          clearInterval(chargeTimerId);
          if (chargeIntervalRef.current === chargeTimerId) chargeIntervalRef.current = null;
          setDeviceState(d => ({ ...d, is_charging: false, is_charged: true }));
          setUiState(u => ({ ...u, chargeProgress: 100, lastEvent: "chargeCompleted", isShockButtonBlinking: true }));
          audioService?.playChargedAlarm();
          sendLocalAction("chargeCompleted");
      } else {
          setUiState(u => ({ ...u, chargeProgress: currentProgress }));
      }
    }, 100);
    chargeIntervalRef.current = chargeTimerId;
    if (!isRemote) sendLocalAction("start_charge");
  }, [deviceState.is_charging, deviceState.is_charged, deviceState.display_mode, sendLocalAction, audioService]);

  const deliverShock = useCallback((isRemote: boolean = false) => {
    if (!deviceState.is_charged) return;
    audioService?.stopChargingSound();
    setDeviceState(prev => ({ ...prev, is_charged: false, shock_count: prev.shock_count + 1 }));
    setUiState(prev => ({ ...prev, showShockDelivered: true, isShockButtonBlinking: false, chargeProgress: 0, lastEvent: "shock_delivered" }));

    if (!isRemote) {
        sendMessage({ type: "defibrillator_action", action: "shock_delivered", energy: deviceState.energy, simuType: "simulator_ui", dataType: "command", source_device: deviceId, session_id: sessionId });
    }
    audioService?.playDAEChocDelivre();
    setTimeout(() => {
      setUiState(prev => ({ ...prev, showShockDelivered: false, showCPRMessage: true, lastEvent: "rcpStarted" }));
      audioService?.playCommencerRCP();
    }, 2000);
  }, [deviceState.is_charged, deviceState.energy, deviceId, sessionId, audioService, sendMessage]);

  const cancelCharge = useCallback((isRemote: boolean = false) => {
    clearHardwareIntervals();
    audioService?.stopChargingSound();
    setDeviceState(prev => ({ ...prev, is_charging: false, is_charged: false }));
    setUiState(prev => ({ ...prev, chargeProgress: 0, isShockButtonBlinking: false, lastEvent: "chargeCancelled" }));
    if (!isRemote) sendLocalAction("cancel_charge");
  }, [clearHardwareIntervals, sendLocalAction, audioService]);

  const setDisplayMode = useCallback((mode: DisplayMode, isRemote: boolean = false) => {
      if (mode === "ARRET") {
          clearHardwareIntervals();
          audioService?.stopAll();
          isBootingRef.current = false;
          bootTargetModeRef.current = null;
          setDeviceState(prev => ({ 
              ...prev, display_mode: "ARRET", is_booting: false, is_charging: false, is_charged: false
          }));
          setUiState(prev => ({ ...prev, bootProgress: 0, bootTargetMode: null, chargeProgress: 0, isShockButtonBlinking: false, lastEvent: "powerOff" }));
          if (!isRemote) sendLocalAction("set_display_mode", { display_mode: "ARRET" });
          return;
      }

      if (isBootingRef.current) {
          bootTargetModeRef.current = mode;
          setUiState(prev => ({ ...prev, bootTargetMode: mode }));
          if (!isRemote) sendLocalAction("set_display_mode", { display_mode: mode });
          return;
      }

      if (deviceState.display_mode === "ARRET") startBootSequence(mode, isRemote);
      else {
          setDeviceState(prev => ({ ...prev, display_mode: mode }));
          setUiState(prev => ({ ...prev, lastEvent: "modeChanged" }));
          if (!isRemote) sendLocalAction("set_display_mode", { display_mode: mode });
      }
  }, [deviceState.display_mode, startBootSequence, clearHardwareIntervals, sendLocalAction]);

  const toggle = useCallback((key: 'fc' | 'vitals' | 'spo2' | 'co2' | 'pni' | 'synchro' | 'pacing') => {
      setDeviceState(prev => {
          if (prev.isRemoteControl) {
              console.log("Defib screen is locked by the Control Panel Master Switch!");
              return prev; 
          }

          let updates: any = {};
          let dottedPayload: any = {};
          let scopeType = "";

          if (key === 'fc') {
              updates.show_fc = !prev.show_fc; scopeType = "HRscope"; dottedPayload = { isDefibHRDotted: !updates.show_fc };
          } else if (key === 'spo2' || key === 'vitals') {
              updates.show_spo2 = !prev.show_spo2; scopeType = "Prscope"; dottedPayload = { isDefibPressureDotted: !updates.show_spo2 };
          } else if (key === 'co2') {
              updates.show_co2 = !prev.show_co2; scopeType = "COscope"; dottedPayload = { isDefibCO2Dotted: !updates.show_co2 };
          } else if (key === 'pni') updates.show_pni = !prev.show_pni;
          else if (key === 'synchro') updates.is_synchro_mode = !prev.is_synchro_mode;
          else if (key === 'pacing') updates.is_pacing = !prev.is_pacing;

          if (['fc', 'spo2', 'co2', 'vitals'].includes(key)) {
              sendMessage({ type: scopeType, simuType: "simulator_ui", dataType: "defib", ...dottedPayload, session_id: sessionId });
          } else if (key === 'synchro') sendLocalAction("toggle_synchro", { is_synchro_mode: updates.is_synchro_mode });
          else if (key === 'pacing') sendLocalAction("toggle_pacing", { is_pacing: updates.is_pacing });

          return { ...prev, ...updates };
      });
  }, [sendMessage, sendLocalAction, sessionId]);

  return {
    deviceId, sessionId,
    device: { ...deviceState, ...uiState, displayMode: deviceState.display_mode, manualEnergy: deviceState.energy, lastEvent: uiState.lastEvent },
    patient: { ...patientState, rhythmType: patientState.rhythm_type, heartRate: patientState.heart_rate },
    actions: {
        startCharging: () => startCharging(), deliverShock: () => deliverShock(), startPNIMeasurement: () => sendLocalAction("start_pni"),
        toggleVisibility: (key: any) => toggle(key), toggle, toggleIsPacing: () => toggle('pacing'), toggleSynchro: () => toggle('synchro'),
        cancelCharge: () => cancelCharge(), setDisplayMode,
        setEnergy: (e: number) => { setDeviceState(prev => ({ ...prev, energy: e })); sendLocalAction("set_energy", { energy: e }); },
        setmanualEnergy: (e: string | number) => {
            if (e === "1-10") { setDeviceState(prev => ({ ...prev, energy: 10 as any })); sendLocalAction("set_energy", { energy: "1-10" }); return; }
            const energy = Number(e); setDeviceState(prev => ({ ...prev, energy })); sendLocalAction("set_energy", { energy });
        },
        setPacerFrequency: (f: number) => { setDeviceState(prev => ({ ...prev, pacer_frequency: f })); sendLocalAction("set_pacer_frequency", { frequency: f }); },
        setPacerIntensity: (i: number) => { setDeviceState(prev => ({ ...prev, pacer_intensity: i })); sendLocalAction("set_pacer_intensity", { intensity: i }); },
        setPacerMode: (m: PacerMode) => { setDeviceState(prev => ({ ...prev, pacer_mode: m })); sendLocalAction("set_pacer_mode", { mode: m }); },
        handleShockButtonPress: () => setUiState(prev => ({ ...prev, isShockButtonPressed: true })),
        handleShockButtonRelease: () => setUiState(prev => ({ ...prev, isShockButtonPressed: false })),
        updateUiState: (updates: Partial<typeof uiState>) => setUiState(prev => ({ ...prev, ...updates })),
        resetState: () => {
          clearHardwareIntervals();
          isBootingRef.current = false;
          bootTargetModeRef.current = null;
          setDeviceState(prev => ({
            ...prev,
            display_mode: "ARRET",
            energy: 0,
            is_booting: false,
            show_fc: false,
            show_spo2: false,
            show_co2: false,
            show_pni: false
          }));
        }
    },
    ...patientState, ...deviceState, ...uiState,
    heartRate: patientState.heart_rate, rhythmType: patientState.rhythm_type,
    displayMode: deviceState.display_mode, isBooting: deviceState.is_booting, manualEnergy: deviceState.energy,
  };
};