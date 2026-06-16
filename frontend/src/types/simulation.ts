// Pure Data Models (Mirroring the Python Backend)

export type DisplayMode = "DAE" | "ARRET" | "Moniteur" | "Stimulateur" | "Manuel" | null;
export type PacerMode = "Fixe" | "Sentinelle";

export interface BloodPressure {
  systolic: number;
  diastolic: number;
  map?: number | null;
}

export interface PatientState {
  heart_rate: number;
  pulse?: number | null;
  rhythm_type: string;
  blood_pressure: BloodPressure;
  respiratory_rate: number;
  spo2: number;
  co2: number;
}

export interface DefibState {
  display_mode: DisplayMode;
  energy: number;
  is_charging: boolean;
  is_charged: boolean;
  is_synchro_mode: boolean;
  shock_count: number;
  
  // Pacer settings
  pacer_mode: PacerMode;
  pacer_frequency: number;
  pacer_intensity: number;
  is_pacing: boolean;

  // Visibility & PNI state
  show_fc: boolean;
  show_vitals: boolean;
  show_pni: boolean;
  is_pni_measuring: boolean;
  pni_step_value?: number | null;
}

export interface SimulationState {
  session_id: string;
  global_time: number;
  last_event: string | null;
  patient_state: PatientState;
  devices: Record<string, DefibState>;
}

// Inbound Intents (Events sent to Python)
export type SimulationIntentEvent = 
  | "set_patient_state"
  | "set_display_mode"
  | "set_energy"
  | "toggle_synchro"
  | "start_charge"
  | "cancel_charge"
  | "deliver_shock"
  | "set_pacer_mode"
  | "set_pacer_frequency"
  | "set_pacer_intensity"
  | "toggle_pacing"
  | "toggle_fc"
  | "toggle_vitals"
  | "toggle_pni"
  | "start_pni"
  | "stop_pni"
  | "step_validated";

export interface SimulationIntent {
  event: SimulationIntentEvent;
  device_id: string;
  payload?: Record<string, any>;
}
