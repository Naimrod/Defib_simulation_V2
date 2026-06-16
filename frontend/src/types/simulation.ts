// --- Internal React State Models ---

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

// --- WebSocket Wire Types (Matching your JSON stub & legacy JS) ---

export type MessageType = 
  | "ecg" 
  | "co2" 
  | "pressure" 
  | "respiration" 
  | "rhythm" 
  | "scenario" 
  | "defibrillator_action"
  | "defibrillator_state"
  | "status"
  | "error";

export type SimuType = "simulator_ui" | "control_panel" | "dashboard" | "scope";
export type DataType = "sensor" | "command" | "status";

export interface BaseWireMessage {
  type: MessageType;
  simuType?: SimuType;
  dataType?: DataType;
  session_id?: string;
  source_device?: string;
  target_device?: string;
  timestamp?: string;
}

export interface EcgWireMessage extends BaseWireMessage {
  type: "ecg";
  bpm: number;
  spo2: number;
}

export interface RhythmWireMessage extends BaseWireMessage {
  type: "rhythm";
  rhythm: string;       // e.g., "sinusal", "fv"
  rhythmLabel?: string; // e.g., "Sinusal", "Fibrillation Ventriculaire"
}

export interface Co2WireMessage extends BaseWireMessage {
  type: "co2";
  co2: number;
}

export interface PressureWireMessage extends BaseWireMessage {
  type: "pressure";
  systolic: number;
  diastolic: number;
}

export interface RespirationWireMessage extends BaseWireMessage {
  type: "respiration";
  respirationRate: number;
}

export interface DefibActionWireMessage extends BaseWireMessage {
  type: "defibrillator_action";
  action: string;
  [key: string]: any;
}

export type SimulationWireMessage = 
  | EcgWireMessage 
  | RhythmWireMessage 
  | Co2WireMessage 
  | PressureWireMessage 
  | RespirationWireMessage 
  | DefibActionWireMessage
  | BaseWireMessage;

// Legacy Support
export interface SimulationState {
  session_id: string;
  global_time: number;
  last_event: string | null;
  patient_state: PatientState;
  devices: Record<string, DefibState>;
}
