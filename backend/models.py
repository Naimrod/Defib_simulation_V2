from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

class DefibrillatorState(BaseModel):
    displayMode: str = "ARRET"
    manualEnergy: int = 0
    lastEvent: Optional[str] = None
    isPacing: bool = False
    pacerFrequency: int = 70
    pacerIntensity: int = 30
    isSynchro: bool = False
    hrDotted: bool = True
    pressureDotted: bool = True
    co2Dotted: bool = True
    defibHrDotted: bool = True
    defibPressureDotted: bool = True
    defibCo2Dotted: bool = True
    isDefibRemoteControl: bool = True
    shockCount: int = 0

class ScopeState(BaseModel):
    hrDotted: bool = True
    pressureDotted: bool = True
    co2Dotted: bool = True
    isRemoteControl: bool = True
    lastEvent: Optional[str] = None

class GenericDeviceState(BaseModel):
    lastEvent: Optional[str] = None

class BloodPressure(BaseModel):
    systolic: int = 120
    diastolic: int = 80

class PatientState(BaseModel):
    heartRate: int = 70
    rhythmType: str = "sinus"
    spo2: int = 98
    co2: int = 40
    bloodPressure: BloodPressure = Field(default_factory=BloodPressure)
    respiratoryRate: int = 15

class SessionState(BaseModel):
    scenario_id: Optional[str] = None
    current_step: int = 0
    natural_rhythm: str = "sinus"
    device_states: Dict[str, Any] = Field(default_factory=dict)
    patient_state: PatientState = Field(default_factory=PatientState)
    is_complete: bool = False
