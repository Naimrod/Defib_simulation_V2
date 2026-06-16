import { useState, useRef, useEffect, useCallback } from "react";
import { useAudio } from "../context/AudioContext";
import { useWebSocket } from "../context/WebSocketContext";
import { DisplayMode, PacerMode, DefibState, PatientState, SimulationWireMessage } from "@/types/simulation";

export const useDefibrillator = (deviceId: string = "defib_main") => {
  const { lastMessage, sendMessage } = useWebSocket();
  const audioService = useAudio();

  // --- 1. LOCAL DEVICE STATE (Instance Specific) ---
  const [deviceState, setDeviceState] = useState<DefibState>({
    display_mode: "ARRET",
    energy: 0,
    is_charging: false,
    is_charged: false,
    is_synchro_mode: false,
    shock_count: 0,
    pacer_mode: "Fixe",
    pacer_frequency: 70,
    pacer_intensity: 30,
    is_pacing: false,
    show_fc: true,
    show_vitals: true,
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
  });

  const chargeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- INCOMING SIGNAL TRIAGE ---
  useEffect(() => {
    if (!lastMessage) return;
    const msg = lastMessage as any;

    // RULE 1: Ignore messages meant for other specific devices
    if (msg.target_device && msg.target_device !== deviceId) return;

    // RULE 2: Filter Local Echoes (To prevent infinite loops/jitter)
    // If we are the source, only process global patient data (re-sync) or specific functional results
    const isGlobalSyncType = ["ecg", "rhythm", "co2", "pressure", "respiration"].includes(msg.type);
    if (msg.source_device === deviceId && !isGlobalSyncType && msg.action !== "shock_delivered") {
        return;
    }

    // RULE 3: Global Patient Updates (Sync everyone)
    if (msg.type === "ecg") {
      setPatientState(prev => ({ ...prev, heart_rate: msg.bpm ?? prev.heart_rate, spo2: msg.spo2 ?? prev.spo2 }));
    } else if (msg.type === "rhythm") {
      setPatientState(prev => ({ ...prev, rhythm_type: msg.rhythm }));
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
      // These come from the Remote or functional results of a Global event
      if (action === "set_energy") setDeviceState(prev => ({ ...prev, energy: payload.energy }));
      if (action === "start_charge") startCharging(true);
      if (action === "cancel_charge") cancelCharge(true);
      if (action === "deliver_shock") deliverShock(true);
      if (action === "toggle_fc") setDeviceState(prev => ({ ...prev, show_fc: payload.show_fc ?? !prev.show_fc }));
      if (action === "toggle_vitals") setDeviceState(prev => ({ ...prev, show_vitals: payload.show_vitals ?? !prev.show_vitals }));
      if (action === "toggle_pni") setDeviceState(prev => ({ ...prev, show_pni: payload.show_pni ?? !prev.show_pni }));
      if (action === "set_display_mode") setDeviceState(prev => ({ ...prev, display_mode: payload.display_mode }));
  };

  // --- OUTGOING SIGNALS ---

  const broadcastPatientUpdate = (type: string, payload: any) => {
      sendMessage({
          type,
          simuType: "simulator_ui",
          dataType: "sensor",
          source_device: deviceId,
          ...payload
      });
  };

  const sendLocalAction = (action: string, payload: any = {}) => {
      sendMessage({
          type: "defibrillator_action",
          action,
          simuType: "simulator_ui",
          dataType: "command",
          source_device: deviceId,
          ...payload
      });
  };

  // --- FUNCTIONAL ACTIONS ---

  const startCharging = useCallback((isRemote: boolean = false) => {
    if (deviceState.is_charging || deviceState.is_charged) return;
    
    setDeviceState(prev => ({ ...prev, is_charging: true }));
    updateUiState({ chargeProgress: 0 });

    if (chargeIntervalRef.current) clearInterval(chargeIntervalRef.current);
    chargeIntervalRef.current = setInterval(() => {
      setUiState(prev => {
        if (prev.chargeProgress >= 100) {
          if (chargeIntervalRef.current) clearInterval(chargeIntervalRef.current);
          setDeviceState(d => ({ ...d, is_charging: false, is_charged: true }));
          return prev;
        }
        return { ...prev, chargeProgress: prev.chargeProgress + 5 };
      });
    }, 100);

    if (!isRemote) sendLocalAction("start_charge");
  }, [deviceState, deviceId]);

  const deliverShock = useCallback((isRemote: boolean = false) => {
    if (!deviceState.is_charged) return;

    setDeviceState(prev => ({ ...prev, is_charged: false, shock_count: prev.shock_count + 1 }));
    updateUiState({ showShockDelivered: true, isShockButtonBlinking: false });

    // Shocks are global functional impact
    if (!isRemote) {
        sendMessage({ 
            type: "defibrillator_action", 
            action: "shock_delivered", 
            energy: deviceState.energy,
            simuType: "simulator_ui",
            dataType: "command",
            source_device: deviceId
        });
    }

    audioService?.playDAEChocDelivre();
    setTimeout(() => {
      updateUiState({ showShockDelivered: false, showCPRMessage: true });
      audioService?.playCommencerRCP();
    }, 2000);
  }, [deviceState, deviceId, audioService, sendMessage]);

  const toggleVisibility = useCallback((key: 'fc' | 'vitals' | 'pni') => {
      setDeviceState(prev => {
          const newVal = key === 'fc' ? !prev.show_fc : (key === 'vitals' ? !prev.show_vitals : !prev.show_pni);
          const updates = { [key === 'fc' ? 'show_fc' : (key === 'vitals' ? 'show_vitals' : 'show_pni')]: newVal };
          sendLocalAction(`toggle_${key}`, updates);
          return { ...prev, ...updates };
      });
  }, []);

  const cancelCharge = useCallback((isRemote: boolean = false) => {
    setDeviceState(prev => ({ ...prev, is_charging: false, is_charged: false }));
    updateUiState({ chargeProgress: 0 });
    if (!isRemote) sendLocalAction("cancel_charge");
  }, []);

  const setDisplayMode = useCallback((mode: DisplayMode) => {
      setDeviceState(prev => ({ ...prev, display_mode: mode }));
      sendLocalAction("set_display_mode", { display_mode: mode });
  }, []);

  const updatePatientVitals = useCallback((updates: Partial<PatientState>) => {
      if (updates.heart_rate !== undefined) {
          broadcastPatientUpdate("ecg", { bpm: updates.heart_rate, spo2: updates.spo2 ?? patientState.spo2 });
      }
      if (updates.rhythm_type !== undefined) {
          broadcastPatientUpdate("rhythm", { rhythm: updates.rhythm_type });
      }
      // ... handle other vitals
  }, [patientState, deviceId]);

  const toggle = useCallback((key: 'fc' | 'vitals' | 'pni' | 'synchro' | 'pacing') => {
      if (key === 'fc' || key === 'vitals' || key === 'pni') {
          toggleVisibility(key);
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
  }, [toggleVisibility]);

  const updateUiState = (updates: Partial<typeof uiState>) => setUiState(prev => ({ ...prev, ...updates }));

  return {
    deviceId,
    device: { ...deviceState, ...uiState },
    patient: patientState,
    actions: {
        startCharging: () => startCharging(),
        deliverShock: () => deliverShock(),
        toggleVisibility,
        toggle, // Restored for backward compatibility
        cancelCharge: () => cancelCharge(),
        setDisplayMode,
        setEnergy: (e: number) => {
            setDeviceState(prev => ({ ...prev, energy: e }));
            sendLocalAction("set_energy", { energy: e });
        },
        setmanualEnergy: (e: string | number) => {
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
        handleShockButtonPress: () => {}, // UI only
        handleShockButtonRelease: () => {}, // UI only
        updatePatientVitals,
        resetState: () => {
            setDeviceState(prev => ({ ...prev, display_mode: "ARRET", energy: 0 }));
            broadcastPatientUpdate("rhythm", { rhythm: "asystole" });
            broadcastPatientUpdate("ecg", { bpm: 0, spo2: 0 });
        }
    },
    // Legacy support
    ...patientState,
    ...deviceState,
    ...uiState,
    heartRate: patientState.heart_rate,
    rhythmType: patientState.rhythm_type,
    displayMode: deviceState.display_mode,
  };
};
