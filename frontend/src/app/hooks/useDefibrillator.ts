import { useState, useRef, useEffect, useCallback } from "react";
import { useAudio } from "../context/AudioContext";
import { useWebSocket } from "../context/WebSocketContext";
import { DisplayMode, PacerMode, DefibState, PatientState } from "@/types/simulation";
import { RhythmType } from "../components/graphsdata/ECGRhythms";

export interface ExtendedDefibrillatorState extends DefibState, PatientState {
  // UI-only transient states (Stay client-side)
  isChargeButtonPressed: boolean;
  isShockButtonPressed: boolean;
  isShockButtonBlinking: boolean;
  
  selectedChannel: number;
  lastEvent: string | null;
  showShockDelivered: boolean;
  showCPRMessage: boolean;
  chargeProgress: number; // Client-side animation of progress
}

export const useDefibrillator = (deviceId: string = "defib_main") => {
  const { lastMessage, sendMessage } = useWebSocket();
  const audioService = useAudio();

  const defaultDeviceState: DefibState = {
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
  };

  const defaultPatientState: PatientState = {
    heart_rate: 0,
    pulse: null,
    rhythm_type: "asystole",
    blood_pressure: { systolic: 0, diastolic: 0 },
    respiratory_rate: 0,
    spo2: 0,
    co2: 0,
  };

  // Maintain local state instead of expecting a full SimulationState from server
  const [deviceState, setDeviceState] = useState<DefibState>(defaultDeviceState);
  const [patientState, setPatientState] = useState<PatientState>(defaultPatientState);

  // --- Local UI-only State ---
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

  const shockMessageTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cprMessageTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chargeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevIsChargedRef = useRef(false);
  const prevIsChargingRef = useRef(false);

  // Handle incoming websocket messages incrementally
  useEffect(() => {
    if (!lastMessage) return;

    // Optional: Filter by target_device if your backend sends it (we use broadcast for now)
    const { type, source_device, session_id, ...payload } = lastMessage;

    if (type === "ecg") {
      setPatientState(prev => ({
        ...prev,
        heart_rate: payload.bpm ?? prev.heart_rate,
        spo2: payload.spo2 ?? prev.spo2
      }));
    } else if (type === "co2") {
      setPatientState(prev => ({
        ...prev,
        co2: payload.co2 ?? prev.co2
      }));
    } else if (type === "pressure") {
      setPatientState(prev => ({
        ...prev,
        blood_pressure: {
          systolic: payload.systolic ?? prev.blood_pressure.systolic,
          diastolic: payload.diastolic ?? prev.blood_pressure.diastolic
        }
      }));
    } else if (type === "respiration") {
      setPatientState(prev => ({
        ...prev,
        respiratory_rate: payload.respirationRate ?? prev.respiratory_rate
      }));
    } else if (type === "rhythm") {
      setPatientState(prev => ({
        ...prev,
        rhythm_type: payload.rhythm ?? prev.rhythm_type
      }));
    } else if (type === "defibrillator_action" && source_device === deviceId) {
       // Example handling of an action that came from us or another remote
       // Usually, the simulator handles its own internal state, but if the remote
       // changes the mode, we'd update it here.
       setDeviceState(prev => ({ ...prev, ...payload }));
    } else if (type === "defibrillator_state") {
        // If we implement state broadcasting from remote
        if (payload.device_id === deviceId) {
             setDeviceState(prev => ({ ...prev, ...payload.state }));
        }
    }
  }, [lastMessage, deviceId]);

  useEffect(() => {
    // Trigger local effects when device state changes
    if (deviceState.is_charged && !prevIsChargedRef.current) {
      setUiState(prev => ({ ...prev, isShockButtonBlinking: true, chargeProgress: 100 }));
      audioService?.playChargedAlarm();
    }
    
    if (!deviceState.is_charged && prevIsChargedRef.current) {
        setUiState(prev => ({ ...prev, isShockButtonBlinking: false, chargeProgress: 0 }));
    }

    // Audio Sync for charging sound
    if (deviceState.is_charging && !prevIsChargingRef.current) {
        audioService?.startChargingSound();
    } else if (!deviceState.is_charging && prevIsChargingRef.current) {
        audioService?.stopChargingSound();
    }

    prevIsChargedRef.current = deviceState.is_charged;
    prevIsChargingRef.current = deviceState.is_charging;
  }, [deviceState.is_charged, deviceState.is_charging, audioService]);

  const updateUiState = useCallback((updates: Partial<typeof uiState>) => {
    setUiState(prev => ({ ...prev, ...updates }));
  }, []);

  const patchDeviceState = useCallback((updates: Partial<DefibState>) => {
      setDeviceState(prev => {
          const next = { ...prev, ...updates };
          // Optionally broadcast device state back to remotes
          sendMessage({ type: "defibrillator_state", device_id: deviceId, state: next });
          return next;
      });
  }, [sendMessage, deviceId]);

  const sendIntent = useCallback((event: string, payload: any = {}) => {
       // Adapt old sendIntent to simple flat messages if necessary
       // We keep it generic and use the type logic
       sendMessage({ type: "defibrillator_action", action: event, device_id: deviceId, ...payload });
  }, [sendMessage, deviceId]);

  // --- Intent Wrappers (Python Engine Calls) ---
  
  const updateState = useCallback((payload: Partial<ExtendedDefibrillatorState>) => {
    Object.entries(payload).forEach(([key, value]) => {
      if (key === "rhythmType") {
        sendMessage({ type: "rhythm", rhythm: value });
      } else if (key === "heartRate") {
        sendMessage({ type: "ecg", bpm: value });
      } else if (key === "blood_pressure" || key === "bloodPressure") {
        sendMessage({ type: "pressure", systolic: value?.systolic, diastolic: value?.diastolic });
      } else if (key === "displayMode") {
        patchDeviceState({ display_mode: value as DisplayMode });
      } else if (key === "manualEnergy") {
        patchDeviceState({ energy: Number(value) });
      } else if (key === "isCharging" && value === false) {
        cancelCharge();
      } else if (key === "show_fc" || key === "showFCValue") {
        patchDeviceState({ show_fc: value as boolean });
      } else if (key === "show_vitals" || key === "showVitalSigns") {
        patchDeviceState({ show_vitals: value as boolean });
      } else if (key === "show_pni" || key === "showPNIValues") {
        patchDeviceState({ show_pni: value as boolean });
      } else if (key === "isPNIMeasuring" && value === true) {
        startPNIMeasurement();
      }
    });
  }, [sendMessage, patchDeviceState]);

  const resetState = useCallback(() => {
    patchDeviceState({ display_mode: "ARRET" });
    sendMessage({ type: "rhythm", rhythm: "asystole" });
    sendMessage({ type: "ecg", bpm: 0 });
    updateUiState({
        lastEvent: null,
        showShockDelivered: false,
        showCPRMessage: false,
        chargeProgress: 0,
        isShockButtonBlinking: false
    });
  }, [sendMessage, patchDeviceState, updateUiState]);

  const setDisplayMode = useCallback((mode: DisplayMode) => {
    patchDeviceState({ display_mode: mode });
  }, [patchDeviceState]);

  const setmanualEnergy = useCallback((energy: string) => {
    patchDeviceState({ energy: Number(energy) });
  }, [patchDeviceState]);

  const toggleSynchroMode = useCallback(() => {
    patchDeviceState({ is_synchro_mode: !deviceState.is_synchro_mode });
  }, [patchDeviceState, deviceState.is_synchro_mode]);

  const startCharging = useCallback(() => {
    if (deviceState.is_charging || deviceState.is_charged) return;
    
    updateUiState({ isChargeButtonPressed: true });
    setTimeout(() => updateUiState({ isChargeButtonPressed: false }), 300);
    
    patchDeviceState({ is_charging: true });

    // Local progress bar animation
    if (chargeIntervalRef.current) clearInterval(chargeIntervalRef.current);
    updateUiState({ chargeProgress: 0 });
    chargeIntervalRef.current = setInterval(() => {
      setUiState(prev => {
        if (prev.chargeProgress >= 100) {
          if (chargeIntervalRef.current) clearInterval(chargeIntervalRef.current);
          patchDeviceState({ is_charging: false, is_charged: true });
          return prev;
        }
        return { ...prev, chargeProgress: prev.chargeProgress + 2 };
      });
    }, 100);
  }, [deviceState, patchDeviceState, updateUiState]);

  const deliverShock = useCallback(() => {
    if (!deviceState.is_charged) return;

    updateUiState({ isShockButtonPressed: true });
    setTimeout(() => updateUiState({ isShockButtonPressed: false }), 300);

    patchDeviceState({ is_charged: false, shock_count: deviceState.shock_count + 1 });

    // Local UI feedback (Banners & Sounds)
    if (audioService) {
      audioService.stopAll();
      audioService.playDAEChocDelivre();
    }

    updateUiState({ showShockDelivered: true, showCPRMessage: false });
    
    if (shockMessageTimerRef.current) clearTimeout(shockMessageTimerRef.current);
    shockMessageTimerRef.current = setTimeout(() => {
      updateUiState({ showShockDelivered: false, showCPRMessage: true });
      audioService?.playCommencerRCP();
    }, 2000);

    if (cprMessageTimerRef.current) clearTimeout(cprMessageTimerRef.current);
    cprMessageTimerRef.current = setTimeout(() => {
      updateUiState({ showCPRMessage: false });
    }, 4000);

  }, [deviceState, patchDeviceState, updateUiState, audioService]);

  const cancelCharge = useCallback(() => {
    patchDeviceState({ is_charging: false, is_charged: false });
    if (chargeIntervalRef.current) clearInterval(chargeIntervalRef.current);
    updateUiState({ chargeProgress: 0, isShockButtonBlinking: false });
  }, [patchDeviceState, updateUiState]);

  const setPacerFrequency = useCallback((frequency: number) => {
    patchDeviceState({ pacer_frequency: frequency });
  }, [patchDeviceState]);

  const setPacerIntensity = useCallback((intensity: number) => {
    patchDeviceState({ pacer_intensity: intensity });
  }, [patchDeviceState]);

  const setPacerMode = useCallback((mode: PacerMode) => {
    patchDeviceState({ pacer_mode: mode });
  }, [patchDeviceState]);

  const toggleIsPacing = useCallback(() => {
    patchDeviceState({ is_pacing: !deviceState.is_pacing });
  }, [patchDeviceState, deviceState.is_pacing]);

  const toggle = useCallback((key: 'fc' | 'vitals' | 'pni' | 'synchro' | 'pacing') => {
      if (key === 'fc') patchDeviceState({ show_fc: !deviceState.show_fc });
      if (key === 'vitals') patchDeviceState({ show_vitals: !deviceState.show_vitals });
      if (key === 'pni') patchDeviceState({ show_pni: !deviceState.show_pni });
      if (key === 'synchro') toggleSynchroMode();
      if (key === 'pacing') toggleIsPacing();
  }, [deviceState, patchDeviceState, toggleSynchroMode, toggleIsPacing]);

  const startPNIMeasurement = useCallback(() => {
      patchDeviceState({ is_pni_measuring: true });
      setTimeout(() => {
          patchDeviceState({ is_pni_measuring: false });
      }, 3000);
  }, [patchDeviceState]);

  const stopPNIMeasurement = useCallback(() => {
      patchDeviceState({ is_pni_measuring: false });
  }, [patchDeviceState]);


  const actions = {
    updateState,
    resetState,
    setDisplayMode,
    startCharging,
    deliverShock,
    cancelCharge,
    toggleSynchroMode,
    setPacerFrequency,
    setPacerIntensity,
    setPacerMode,
    toggleIsPacing,
    setmanualEnergy,
    toggle,
    startPNIMeasurement,
    stopPNIMeasurement,
    handleShockButtonPress: () => {}, 
    handleShockButtonRelease: () => {},
    clearLastEvent: () => updateUiState({ lastEvent: null }),
  };

  const device = { ...deviceState, ...uiState };

  return {
    device,
    patient: patientState,
    actions,
    
    // Legacy mapping (to avoid breaking 20+ components at once)
    ...patientState,
    ...device,
    
    lastEvent: uiState.lastEvent,
    
    displayMode: deviceState.display_mode as any,
    manualEnergy: deviceState.energy === 10 ? "1-10" : deviceState.energy.toString(),
    rhythmType: patientState.rhythm_type as any,
    heartRate: patientState.heart_rate,
    pacerFrequency: deviceState.pacer_frequency,
    pacerIntensity: deviceState.pacer_intensity,
    pacerMode: deviceState.pacer_mode as any,
    isPacing: deviceState.is_pacing,
    isCharging: deviceState.is_charging,
    shockCount: deviceState.shock_count,
    isCharged: deviceState.is_charged,
    isSynchroMode: deviceState.is_synchro_mode,
    showFCValue: deviceState.show_fc,
    showVitalSigns: deviceState.show_vitals,
    showPNIValues: deviceState.show_pni,
    isPNIMeasuring: deviceState.is_pni_measuring,
    pniStepValue: deviceState.pni_step_value,

    // Action Methods
    ...actions,
  };
};
