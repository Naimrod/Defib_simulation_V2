"""
Authoritative state schemas and JSON serialization/validation models.

This module defines Pydantic schemas representing the structures of device states, 
patient states, sessions, and scenario configuration files used throughout the 
medical defibrillator simulation.
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List

class DefibrillatorState(BaseModel):
    """
    Represents the operational state of a physical defibrillator device.
    
    Attributes:
        displayMode (str): Active display setting (e.g. "ARRET", "Moniteur", "Manuel", "Stimulateur", "DAE").
        manualEnergy (int): Target energy in Joules set during manual defibrillation mode.
        lastEvent (Optional[str]): The last recorded command or event identifier (e.g. "shockDelivered").
        isPacing (bool): Indicator whether cardiac pacing mode is turned ON.
        pacerFrequency (int): Cardiac pacing frequency set in beats per minute (BPM).
        pacerIntensity (int): Pacing current intensity set in milliamperes (mA).
        isSynchro (bool): Flag indicating synchronized cardioversion mode is active.
        hrDotted (bool): Whether Heart Rate digits are hidden/dotted on the general scope screen.
        pressureDotted (bool): Whether blood pressure digits are hidden/dotted on the general scope.
        co2Dotted (bool): Whether CO2 digits are hidden/dotted on the general scope.
        defibHrDotted (bool): Whether Heart Rate digits are hidden/dotted on the defibrillator screen.
        defibPressureDotted (bool): Whether blood pressure digits are hidden/dotted on the defibrillator screen.
        defibCo2Dotted (bool): Whether CO2 digits are hidden/dotted on the defibrillator screen.
        isDefibRemoteControl (bool): Whether the defibrillator screen controls are overridden by the instructor panel.
        shockCount (int): Number of shocks delivered during the active session.
    """
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
    """
    Represents the operational configuration of the general patient monitor scope.
    
    Attributes:
        hrDotted (bool): Whether Heart Rate digits are hidden/dotted on the scope screen.
        pressureDotted (bool): Whether blood pressure digits are hidden/dotted on the scope screen.
        co2Dotted (bool): Whether CO2 digits are hidden/dotted on the scope screen.
        isRemoteControl (bool): Whether the scope screen is overridden by the instructor panel.
        lastEvent (Optional[str]): The last recorded event for the scope.
    """
    hrDotted: bool = True
    pressureDotted: bool = True
    co2Dotted: bool = True
    isRemoteControl: bool = True
    lastEvent: Optional[str] = None

class GenericDeviceState(BaseModel):
    """
    Fall-back representation for generic connected devices (such as dashboards).
    
    Attributes:
        lastEvent (Optional[str]): The last event ID sent or received.
    """
    lastEvent: Optional[str] = None

class BloodPressure(BaseModel):
    """
    Physiological representation of a patient's blood pressure values.
    
    Attributes:
        systolic (int): Systolic pressure in mmHg.
        diastolic (int): Diastolic pressure in mmHg.
    """
    systolic: int = 120
    diastolic: int = 80

class PatientState(BaseModel):
    """
    Authoritative representation of the patient's physiological vitals.
    
    Attributes:
        heartRate (int): Unified heart rate in beats per minute (BPM).
        rhythmType (str): Canonical cardiac rhythm name (e.g. "sinus", "asystole", "fv").
        spo2 (int): Peripheral capillary oxygen saturation percentage (%).
        co2 (int): End-tidal carbon dioxide level in mmHg.
        bloodPressure (BloodPressure): Blood pressure values object.
        respiratoryRate (int): Respiratory rate in breaths per minute.
    """
    heartRate: int = 70
    rhythmType: str = "sinus"
    spo2: int = 98
    co2: int = 40
    bloodPressure: BloodPressure = Field(default_factory=BloodPressure)
    respiratoryRate: int = 15

class SessionState(BaseModel):
    """
    Authoritative state of an active training/simulation session.
    
    Attributes:
        scenario_id (Optional[str]): ID of the scenario currently loaded or active.
        current_step (int): Index of the current step in the scenario timeline.
        natural_rhythm (str): Default cardiac rhythm baseline the patient reverts to after chocs.
        device_states (Dict[str, Any]): Dictionary mapping unique device IDs or template device keys 
                                        to their respective states (e.g. DefibrillatorState).
        patient_state (PatientState): Current physiological vitals of the patient.
        is_complete (bool): Flag indicating if the loaded scenario has been successfully completed.
        show_hints (bool): Toggle visibility of hint/step description box on student screens.
    """
    scenario_id: Optional[str] = None
    current_step: int = 0
    natural_rhythm: str = "sinus"
    device_states: Dict[str, Any] = Field(default_factory=dict)
    patient_state: PatientState = Field(default_factory=PatientState)
    is_complete: bool = False
    show_hints: bool = False

class ScenarioStep(BaseModel):
    """
    A single instruction step in a scenario timeline.
    
    Attributes:
        step (int): Index/order of the step.
        description (str): Human-readable instruction description shown to the student.
        validation (Dict[str, Any]): Condition rules logic mapping required to pass the step.
        onComplete (Optional[List[Dict[str, Any]]]): List of delay-action sequences triggered when 
                                                     the step validation is successfully met.
    """
    step: int
    description: str
    validation: Dict[str, Any]
    onComplete: Optional[List[Dict[str, Any]]] = None

class Scenario(BaseModel):
    """
    Pydantic schema representing the complete structure of a scenario configuration JSON file.
    
    Attributes:
        id (str): Unique scenario identifier.
        title (str): Scenario name.
        description (str): Overview of the patient case.
        initialState (PatientState): Physiological values loaded at the start of the scenario.
        steps (List[ScenarioStep]): Ordered sequence of validation steps.
    """
    id: str
    title: str
    description: str
    initialState: PatientState
    steps: List[ScenarioStep]
