import { useState, useRef, useEffect, useCallback } from "react";
import { useAudio } from "../context/AudioContext";
import { useWebSocket } from "../context/WebSocketContext";
import { DisplayMode, PacerMode, DefibState, PatientState, SimulationWireMessage } from "@/types/simulation";

export const useDefibrillator = () => {
  const { lastMessage, sendMessage, deviceId, sessionId } = useWebSocket();
  const audioService = useAudio();

  // --- 1. LOCAL DEVICE STATE (Instance Specific) ---
  const [deviceState, setDeviceState] = useState<DefibState>({
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
  });

  // --- 2. SHARED PATIENT STATE (Global to Session) ---
  const [patientState, setPatientState] = useState<PatientState>({
    heart_rate: 0,
    pulse: null,
    rhythm_type: "asystole",
    blood_pressure: { systolic: 0, diastolic: 0 },
    respiratory_rate: 0,
    spo2: 0,
    co2: 0,
  });

  // --- 3. UI-ONLY TRANSIENT STATE ---
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

  // --- 4. REFS FOR SYNCHRONOUS TRACKING (Prevent race conditions) ---
  const isBootingRef = useRef(false);
  const bootTargetModeRef = useRef<DisplayMode | null>(null);
  const chargeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bootIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to clear all active hardware intervals
  const clearHardwareIntervals = useCallback(() => {
      if (chargeIntervalRef.current) {
          clearInterval(chargeIntervalRef.current);
          chargeIntervalRef.current = null;
      }
      if (bootIntervalRef.current) {
          clearInterval(bootIntervalRef.current);
          bootIntervalRef.current = null;
      }
  }, []);

  // --- INCOMING SIGNAL TRIAGE ---
  useEffect(() => {
    if (!lastMessage) return;
    const msg = lastMessage as any;

    // RULE 1: Ignore messages meant for other specific devices
    if (msg.target_device && msg.target_device !== deviceId) return;

    // RULE 2: Filter Local Echoes
    const isGlobalSyncType = ["ecg", "rhythm", "co2", "pressure", "respiration"].includes(msg.type);
    if (msg.source_device === deviceId && !isGlobalSyncType && msg.action !== "shock_delivered") {
        return;
    }

    // UPDATE LAST EVENT
    if (msg.type === "defibrillator_action") {
        setUiState(prev => ({ ...prev, lastEvent: msg.action }));
    } else if (msg.type === "scenario" && msg.action === "step_validated") {
        setUiState(prev => ({ ...prev, lastEvent: "stepValidated" }));
    }

    // RULE 3: Global Patient Updates
    if (msg.type === "ecg") {
      setPatientState(prev => ({ ...prev, heart_rate: msg.bpm ?? prev.heart_rate, spo2: msg.spo2 ?? prev.spo2 }));
    } else if (msg.type === "rhythm") {
      const rhythmMap: Record<string, string> = {
          'sinusal': 'sinus',
          'fv': 'fibrillationVentriculaire',
          'tv_1': 'tachycardieVentriculaire',
          'tv_2': 'tachycardieVentriculaire',
          'asysto': 'asystole',
          'arret': 'asystole',
          'fib_a': 'fibrillationAtriale',
          '1_bav': 'bav1',
          '3_bav': 'bav3',
          'stim': 'electroEntrainement',
          'seq': 'electroEntrainement',
          'p_cap': 'electroEntrainement'
      };
      const canonicalRhythm = rhythmMap[msg.rhythm] || msg.rhythm;
      setPatientState(prev => ({ ...prev, rhythm_type: canonicalRhythm }));
    } else if (msg.type === "co2") {
      setPatientState(prev => ({ ...prev, co2: msg.co2 }));
    } else if (msg.type === "pressure") {
      setPatientState(prev => ({ ...prev, blood_pressure: { systolic: msg.systolic, diastolic: msg.diastolic } }));
    } else if (msg.type === "respiration") {
      setPatientState(prev => ({ ...prev, respiratory_rate: msg.respirationRate }));
    }

    // RULE 4: Functional/Targeted Actions
    else if (msg.type === "defibrillator_action") {
        handleIncomingAction(msg.action, msg);
    }
  }, [lastMessage, deviceId]);

  const handleIncomingAction = (action: string, payload: any) => {
      if (action === "set_energy") {
          setDeviceState(prev => ({ ...prev, energy: payload.energy }));
      }
      if (action === "start_charge") startCharging(true);
      if (action === "cancel_charge") cancelCharge(true);
      if (action === "deliver_shock") deliverShock(true);
      if (action === "boot_start") startBootSequence(payload.target_mode, true);
      if (action === "toggle_fc") setDeviceState(prev => ({ ...prev, show_fc: payload.show_fc ?? !prev.show_fc }));
      if (action === "toggle_vitals") setDeviceState(prev => ({ ...prev, show_vitals: payload.show_vitals ?? !prev.show_vitals }));
      if (action === "toggle_pni") setDeviceState(prev => ({ ...prev, show_pni: payload.show_pni ?? !prev.show_pni }));
      if (action === "set_display_mode") setDisplayMode(payload.display_mode, true);
      
      // PNI authoritative sync
      if (action === "pni_start") setDeviceState(prev => ({ ...prev, is_pni_measuring: true, pni_step_value: 160 }));
      if (action === "pni_step") setDeviceState(prev => ({ ...prev, pni_step_value: payload.value }));
      if (action === "pni_done") setDeviceState(prev => ({ ...prev, is_pni_measuring: false, show_pni: true, pni_step_value: null }));
  };

  // --- OUTGOING SIGNALS ---

  const sendLocalAction = useCallback((action: string, payload: any = {}) => {
      sendMessage({
          type: "defibrillator_action",
          action,
          simuType: "simulator_ui",
          dataType: "command",
          source_device: deviceId,
          session_id: sessionId,
          ...payload
      });
  }, [deviceId, sessionId, sendMessage]);

  // --- FUNCTIONAL ACTIONS ---

  const startBootSequence = useCallback((targetMode: DisplayMode, isRemote: boolean = false) => {
      // Use Ref to prevent multiple interval starts
      if (isBootingRef.current && bootTargetModeRef.current === targetMode) return;
      
      clearHardwareIntervals();
      isBootingRef.current = true;
      bootTargetModeRef.current = targetMode;

      setDeviceState(prev => ({ ...prev, is_booting: true, display_mode: "ARRET" }));
      setUiState(prev => ({ ...prev, bootProgress: 0, bootTargetMode: targetMode, lastEvent: "bootStarted" }));

      bootIntervalRef.current = setInterval(() => {
          setUiState(prev => {
              if (prev.bootProgress >= 100) {
                  if (bootIntervalRef.current) {
                      clearInterval(bootIntervalRef.current);
                      bootIntervalRef.current = null;
                  }
                  isBootingRef.current = false;
                  const finalMode = bootTargetModeRef.current || targetMode;
                  setDeviceState(d => ({ ...d, is_booting: false, display_mode: finalMode }));
                  setUiState(u => ({ ...u, lastEvent: "bootCompleted" }));
                  return prev;
              }
              return { ...prev, bootProgress: prev.bootProgress + 10 };
          });
      }, 100);

      if (!isRemote) sendLocalAction("boot_start", { target_mode: targetMode });
  }, [clearHardwareIntervals, sendLocalAction]);

  const startCharging = useCallback((isRemote: boolean = false) => {
    if (deviceState.is_charging || deviceState.is_charged) return;
    
    // Physical button guard: Only allow manual charge in Manuel mode
    if (!isRemote && deviceState.display_mode !== "Manuel") {
        console.warn("[Defib] Manual charge blocked: Not in Manuel mode.");
        return;
    }

    setDeviceState(prev => ({ ...prev, is_charging: true }));
    setUiState(prev => ({ ...prev, chargeProgress: 0, lastEvent: "chargeStarted" }));
    audioService?.startChargingSound();

    if (chargeIntervalRef.current) clearInterval(chargeIntervalRef.current);
    chargeIntervalRef.current = setInterval(() => {
      setUiState(prev => {
        if (prev.chargeProgress >= 100) {
          if (chargeIntervalRef.current) {
              clearInterval(chargeIntervalRef.current);
              chargeIntervalRef.current = null;
          }
          setDeviceState(d => ({ ...d, is_charging: false, is_charged: true }));
          setUiState(u => ({ ...u, lastEvent: "chargeCompleted", isShockButtonBlinking: true }));
          audioService?.playChargedAlarm();
          sendLocalAction("chargeCompleted");
          return prev;
        }
        return { ...prev, chargeProgress: prev.chargeProgress + 5 };
      });
    }, 100);

    if (!isRemote) sendLocalAction("start_charge");
  }, [deviceState.is_charging, deviceState.is_charged, deviceState.display_mode, sendLocalAction, audioService]);

  const deliverShock = useCallback((isRemote: boolean = false) => {
    if (!deviceState.is_charged) return;

    audioService?.stopChargingSound();
    setDeviceState(prev => ({ ...prev, is_charged: false, shock_count: prev.shock_count + 1 }));
    setUiState(prev => ({ ...prev, showShockDelivered: true, isShockButtonBlinking: false, chargeProgress: 0, lastEvent: "shock_delivered" }));

    if (!isRemote) {
        sendMessage({ 
            type: "defibrillator_action", 
            action: "shock_delivered", 
            energy: deviceState.energy,
            simuType: "simulator_ui",
            dataType: "command",
            source_device: deviceId,
            session_id: sessionId
        });
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
          isBootingRef.current = false;
          bootTargetModeRef.current = null;
          setDeviceState(prev => ({ 
              ...prev, 
              display_mode: "ARRET", 
              is_booting: false,
              is_charging: false,
              is_charged: false
          }));
          setUiState(prev => ({
              ...prev,
              bootProgress: 0,
              bootTargetMode: null,
              chargeProgress: 0,
              isShockButtonBlinking: false,
              lastEvent: "powerOff"
          }));
          if (!isRemote) sendLocalAction("set_display_mode", { display_mode: "ARRET" });
          return;
      }

      // If already booting, just update the Ref and UI target state
      if (isBootingRef.current) {
          bootTargetModeRef.current = mode;
          setUiState(prev => ({ ...prev, bootTargetMode: mode }));
          if (!isRemote) sendLocalAction("set_display_mode", { display_mode: mode });
          return;
      }

      if (deviceState.display_mode === "ARRET") {
          startBootSequence(mode, isRemote);
      } else {
          setDeviceState(prev => ({ ...prev, display_mode: mode }));
          setUiState(prev => ({ ...prev, lastEvent: "modeChanged" }));
          if (!isRemote) sendLocalAction("set_display_mode", { display_mode: mode });
      }
  }, [deviceState.display_mode, startBootSequence, clearHardwareIntervals, sendLocalAction]);

  const toggle = useCallback((key: 'fc' | 'vitals' | 'pni' | 'synchro' | 'pacing') => {
      if (key === 'fc' || key === 'vitals' || key === 'pni') {
          setDeviceState(prev => {
              const newVal = key === 'fc' ? !prev.show_fc : (key === 'vitals' ? !prev.show_vitals : !prev.show_pni);
              const updates = { [key === 'fc' ? 'show_fc' : (key === 'vitals' ? 'show_vitals' : 'show_pni')]: newVal };
              sendLocalAction(`toggle_${key}`, updates);
              return { ...prev, ...updates };
          });
      } else if (key === 'synchro') {
          setDeviceState(prev => {
              const next = !prev.is_synchro_mode;
              sendLocalAction("toggle_synchro", { is_synchro_mode: next });
              return { ...prev, is_synchro_mode: next };
          });
      } else if (key === 'pacing') {
          setDeviceState(prev => {
              const next = !prev.is_pacing;
              sendLocalAction("toggle_pacing", { is_pacing: next });
              return { ...prev, is_pacing: next };
          });
      }
  }, [sendLocalAction]);

  return {
    deviceId,
    sessionId,
    device: { 
        ...deviceState, 
        ...uiState,
        displayMode: deviceState.display_mode,
        manualEnergy: deviceState.energy,
        lastEvent: uiState.lastEvent
    },
    patient: {
        ...patientState,
        rhythmType: patientState.rhythm_type,
        heartRate: patientState.heart_rate,
    },
    actions: {
        startCharging: () => startCharging(),
        deliverShock: () => deliverShock(),
        startPNIMeasurement: () => sendLocalAction("start_pni"),
        toggleVisibility: (key: any) => toggle(key),
        toggle,
        toggleIsPacing: () => toggle('pacing'),
        toggleSynchro: () => toggle('synchro'),
        cancelCharge: () => cancelCharge(),
        setDisplayMode,
        setEnergy: (e: number) => {
            setDeviceState(prev => ({ ...prev, energy: e }));
            sendLocalAction("set_energy", { energy: e });
        },
        setmanualEnergy: (e: string | number) => {
            if (e === "1-10") {
                setDeviceState(prev => ({ ...prev, energy: 10 as any }));
                sendLocalAction("set_energy", { energy: "1-10" });
                return;
            }
            const energy = Number(e);
            setDeviceState(prev => ({ ...prev, energy }));
            sendLocalAction("set_energy", { energy });
        },
        setPacerFrequency: (f: number) => {
            setDeviceState(prev => ({ ...prev, pacer_frequency: f }));
            sendLocalAction("set_pacer_frequency", { frequency: f });
        },
        setPacerIntensity: (i: number) => {
            setDeviceState(prev => ({ ...prev, pacer_intensity: i }));
            sendLocalAction("set_pacer_intensity", { intensity: i });
        },
        setPacerMode: (m: PacerMode) => {
            setDeviceState(prev => ({ ...prev, pacer_mode: m }));
            sendLocalAction("set_pacer_mode", { mode: m });
        },
        handleShockButtonPress: () => setUiState(prev => ({ ...prev, isShockButtonPressed: true })),
        handleShockButtonRelease: () => setUiState(prev => ({ ...prev, isShockButtonPressed: false })),
        updateUiState: (updates: Partial<typeof uiState>) => setUiState(prev => ({ ...prev, ...updates })),
        resetState: () => {
            clearHardwareIntervals();
            isBootingRef.current = false;
            bootTargetModeRef.current = null;
            setDeviceState(prev => ({ ...prev, display_mode: "ARRET", energy: 0, is_booting: false }));
        }
    },
    ...patientState,
    ...deviceState,
    ...uiState,
    heartRate: patientState.heart_rate,
    rhythmType: patientState.rhythm_type,
    displayMode: deviceState.display_mode,
    isBooting: deviceState.is_booting,
    manualEnergy: deviceState.energy,
  };
};
