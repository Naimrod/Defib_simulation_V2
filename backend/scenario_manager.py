from typing import List, Dict, Any, Optional
import asyncio
import os
import json
from models import (
    SessionState,
    DefibrillatorState,
    ScopeState,
    GenericDeviceState,
    Scenario,
    SessionData,
)


# -------SCENARIO MANAGER-------------------------
class ScenarioManager:
    PROPERTY_MAPPING = {
        "isSynchroMode": "isSynchro",
        "pulse": "heartRate",
        "heart_rate": "heartRate",
    }

    def __init__(self, manager: "ConnectionManager"):
        self.manager = manager
        self.scenarios: Dict[str, Any] = {}
        self.session_states: Dict[str, Dict[str, Any]] = {}  # session_id -> state
        self.transition_tasks: Dict[str, asyncio.Task] = {}  # session_id -> Task
        self.load_scenarios()

    def load_scenarios(self):
        base_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "data", "scenarios"
        )
        if not os.path.exists(base_path):
            print(f"Warning: Scenario path {base_path} not found.")
            return

        for filename in os.listdir(base_path):
            if filename.endswith(".json"):
                try:
                    with open(os.path.join(base_path, filename), "r") as f:
                        scenario_data = json.load(f)
                        # Authoritative validation via Pydantic model
                        validated_scenario = Scenario.model_validate(scenario_data)
                        self.scenarios[validated_scenario.id] = (
                            validated_scenario.model_dump()
                        )
                except Exception as e:
                    print(f"Failed to load/validate scenario {filename}: {e}")
        print(f"Loaded {len(self.scenarios)} scenarios.")

    def get_session_state(self, session_id: str) -> Dict[str, Any]:
        if session_id not in self.session_states:
            self.session_states[session_id] = SessionState().model_dump()
        return self.session_states[session_id]

    def get_device_state(self, session_id: str, device_id: str) -> Dict[str, Any]:
        state = self.get_session_state(session_id)
        if "device_states" not in state:
            state["device_states"] = {}
        if device_id not in state["device_states"]:
            # Extract device type from device_id prefix ({type}_{salt})
            device_type = "defibrillator"  # default fallback
            if "_" in device_id:
                parts = device_id.split("_", 1)
                if parts[0] in ["defibrillator", "scope", "control", "dashboard"]:
                    device_type = parts[0]
            elif device_id.startswith("defibrillator"):
                device_type = "defibrillator"
            elif device_id.startswith("scope"):
                device_type = "scope"
            elif device_id.startswith("control"):
                device_type = "control"
            elif device_id.startswith("dashboard"):
                device_type = "dashboard"

            if device_type == "defibrillator":
                state["device_states"][device_id] = DefibrillatorState().model_dump()
            elif device_type == "scope":
                state["device_states"][device_id] = ScopeState().model_dump()
            elif device_type in ["control", "dashboard"]:
                state["device_states"][device_id] = GenericDeviceState().model_dump()
            else:
                state["device_states"][device_id] = GenericDeviceState().model_dump()

            # Inherit active visibility/remote states from any existing device states
            if device_type in ["scope", "defibrillator"]:
                dev_state = state["device_states"][device_id]
                propagate_keys = [
                    "hrDotted",
                    "pressureDotted",
                    "co2Dotted",
                    "isRemoteControl",
                    "defibHrDotted",
                    "defibPressureDotted",
                    "defibCo2Dotted",
                    "isDefibRemoteControl",
                ]
                for existing_state in state["device_states"].values():
                    for k in propagate_keys:
                        if k in existing_state and existing_state[k] is not None:
                            dev_state[k] = existing_state[k]
        return state["device_states"][device_id]

    def get_state_value(
        self, session_id: str, property_name: str, device_id: Optional[str] = None
    ):
        state = self.get_session_state(session_id)
        mapped_prop = self.PROPERTY_MAPPING.get(property_name, property_name)

        # 1. Specific device targeted
        if device_id:
            dev_state = state.get("device_states", {}).get(device_id)
            if dev_state and mapped_prop in dev_state:
                return dev_state[mapped_prop]

        # 2. Fallback to last updated device
        last_dev_id = state.get("last_updated_device")
        if last_dev_id:
            dev_state = state.get("device_states", {}).get(last_dev_id)
            if dev_state and mapped_prop in dev_state:
                return dev_state[mapped_prop]

        # 3. Fallback to patient state
        val = state.get("patient_state", {}).get(mapped_prop)
        if val is not None:
            return val

        # 4. Fallback to scanning any device
        for dev_state in state.get("device_states", {}).values():
            if mapped_prop in dev_state:
                return dev_state[mapped_prop]
        return None

    async def start_scenario(self, session_id: str, scenario_id: str):
        if scenario_id not in self.scenarios:
            return
        scenario = self.scenarios[scenario_id]
        state = self.get_session_state(session_id)
        state.update(
            {
                "scenario_id": scenario_id,
                "current_step": 0,
                "is_complete": False,
                "show_hints": False,
            }
        )
        state["patient_state"] = scenario.get("initialState", {}).copy()
        state["natural_rhythm"] = state["patient_state"].get("rhythmType", "sinus")

        steps = scenario.get("steps", [])
        first_step = steps[0] if steps else {}
        await self.manager.broadcast(
            {
                "type": "scenario",
                "action": "start",
                "scenario_id": scenario_id,
                "title": scenario["title"],
                "step_description": first_step.get("description", ""),
                "total_steps": len(steps),
                "show_hints": False,
            },
            session_id,
        )

        await self.apply_vitals_update(session_id, state["patient_state"])

    async def stop_scenario(self, session_id: str):
        if session_id in self.session_states:
            self.session_states[session_id]["scenario_id"] = None
            self.session_states[session_id]["show_hints"] = False
            self.session_states[session_id]["is_complete"] = False
            self.session_states[session_id]["current_step"] = 0
        await self.manager.broadcast({"type": "scenario", "action": "stop"}, session_id)

    async def toggle_hints(self, session_id: str, show_hints: bool):
        state = self.get_session_state(session_id)
        state["show_hints"] = show_hints
        await self.manager.broadcast(
            {"type": "scenario", "action": "toggle_hints", "show_hints": show_hints},
            session_id,
        )
        # Trigger vitals update to broadcast full sync_state
        await self.apply_vitals_update(session_id, {})

    async def update_device_state(
        self, session_id: str, device_id: str, updates: Dict[str, Any]
    ):
        state = self.get_session_state(session_id)

        # 1. Update the isolated device state
        dev_state = self.get_device_state(session_id, device_id)
        dev_state.update(updates)

        # 2. Track last updated device
        state["last_updated_device"] = device_id

        # Propagate visibility/remote override updates to all other device states in the session
        propagate_keys = [
            "hrDotted",
            "pressureDotted",
            "co2Dotted",
            "isRemoteControl",
            "defibHrDotted",
            "defibPressureDotted",
            "defibCo2Dotted",
            "isDefibRemoteControl",
        ]
        prop_updates = {k: v for k, v in updates.items() if k in propagate_keys}
        if prop_updates:
            for other_dev_id, other_dev_state in state.get("device_states", {}).items():
                if other_dev_id != device_id:
                    other_dev_state.update(prop_updates)

        await self.check_physiology_rules(
            session_id, device_id, updates.get("lastEvent")
        )
        await self.check_step_advancement(session_id)

    async def run_pni_cycle(self, session_id: str):
        state = self.get_session_state(session_id)
        patient = state.setdefault("patient_state", {})

        def update_pni_devices(updates: Dict[str, Any]):
            for dev_id, dev_state in state.get("device_states", {}).items():
                if dev_id.startswith("defibrillator") or dev_id.startswith("scope"):
                    dev_state.update(updates)

        # 1. PNI Start
        patient["is_pni_measuring"] = True
        patient["pni_step_value"] = 160
        update_pni_devices({"is_pni_measuring": True, "pni_step_value": 160})
        await self.apply_vitals_update(session_id, {})
        await self.manager.broadcast(
            {
                "type": "defibrillator_action",
                "action": "pni_start",
                "is_pni_measuring": True,
            },
            session_id,
        )

        # 2. PNI Steps
        for val in [160, 140, 120, 100, 80, 60, 40, 20]:
            await asyncio.sleep(0.5)
            patient["pni_step_value"] = val
            update_pni_devices({"pni_step_value": val})
            await self.apply_vitals_update(session_id, {})
            await self.manager.broadcast(
                {"type": "defibrillator_action", "action": "pni_step", "value": val},
                session_id,
            )

        # 3. PNI Done
        patient["is_pni_measuring"] = False
        patient["show_pni"] = True
        patient["pni_step_value"] = None
        bp = patient.get("bloodPressure", {"systolic": 120, "diastolic": 80})
        patient["displayed_bp"] = {
            "systolic": bp.get("systolic", 120),
            "diastolic": bp.get("diastolic", 80),
        }
        update_pni_devices(
            {"is_pni_measuring": False, "show_pni": True, "pni_step_value": None}
        )
        await self.apply_vitals_update(session_id, {})
        await self.manager.broadcast(
            {
                "type": "defibrillator_action",
                "action": "pni_done",
                "is_pni_measuring": False,
                "show_pni": True,
            },
            session_id,
        )

    async def check_physiology_rules(
        self, session_id: str, device_id: str, last_event: Optional[str]
    ):
        state = self.get_session_state(session_id)
        device = self.get_device_state(session_id, device_id)

        # 1. SHOCK PHYSICS (Transient)
        if last_event == "shockDelivered":
            # Apply immediate choc rhythm and flat vitals
            await self.apply_vitals_update(
                session_id,
                {
                    "rhythmType": "choc",
                    "heartRate": 0,
                    "spo2": 0,
                    "co2": 0,
                    "bloodPressure": {"systolic": 0, "diastolic": 0},
                    "respiratoryRate": 0,
                },
            )
            # Revert to asystole after a short delay
            asyncio.create_task(
                self.delayed_vitals_update(
                    session_id,
                    {
                        "rhythmType": "asystole",
                        "heartRate": 0,
                        "spo2": 0,
                        "co2": 0,
                        "bloodPressure": {"systolic": 0, "diastolic": 0},
                        "respiratoryRate": 0,
                    },
                    0.5,
                )
            )
            return

        # 2. PACING PHYSICS (Captured state)
        # ONLY apply if Pacing is ON and Intensity is high, and the event was pacer-related
        pacer_events = [
            "toggle_pacing",
            "set_pacer_frequency",
            "set_pacer_intensity",
            "set_pacer_mode",
            "set_display_mode",
        ]
        if (
            last_event in pacer_events
            and device.get("isPacing")
            and device.get("pacerIntensity", 0) >= 90
        ):
            pacer_bpm = device.get("pacerFrequency", 70)
            await self.apply_vitals_update(
                session_id,
                {"rhythmType": "electroEntrainement", "heartRate": pacer_bpm},
            )

    async def update_patient_state(self, session_id: str, updates: Dict[str, Any]):
        await self.apply_vitals_update(session_id, updates)
        await self.check_step_advancement(session_id)

    def is_step_met(self, validation: Dict[str, Any], session_id: str) -> bool:
        if "all_of" in validation:
            return all(
                self.check_condition(c, session_id) for c in validation["all_of"]
            )
        if "any_of" in validation:
            return any(
                self.check_condition(c, session_id) for c in validation["any_of"]
            )
        return self.check_condition(validation, session_id)

    def check_condition(self, condition: Dict[str, Any], session_id: str) -> bool:
        c_type = condition.get("type")
        target_device = condition.get("deviceId")
        if c_type == "stateChange":
            prop = condition.get("property")
            expected = condition.get("value")
            actual = self.get_state_value(session_id, prop, target_device)
            if actual is None:
                return False

            operator = condition.get("operator", "==")
            if operator in [">=", "<=", ">", "<"]:
                try:
                    act_num = float(actual)
                    exp_num = float(expected)
                    if operator == ">=":
                        return act_num >= exp_num
                    if operator == "<=":
                        return act_num <= exp_num
                    if operator == ">":
                        return act_num > exp_num
                    if operator == "<":
                        return act_num < exp_num
                except (ValueError, TypeError):
                    return False

            # Default / Equality checking
            if isinstance(actual, bool) or isinstance(expected, bool):

                def to_bool(v):
                    if isinstance(v, bool):
                        return v
                    return str(v).lower() in ["true", "1", "yes"]

                return to_bool(actual) == to_bool(expected)
            return str(actual) == str(expected)

        if c_type == "event":
            state = self.get_session_state(session_id)
            if target_device:
                dev_state = state.get("device_states", {}).get(target_device)
                if dev_state:
                    return dev_state.get("lastEvent") == condition.get("eventName")
            else:
                last_dev_id = state.get("last_updated_device")
                if last_dev_id:
                    dev_state = state.get("device_states", {}).get(last_dev_id)
                    if dev_state:
                        return dev_state.get("lastEvent") == condition.get("eventName")
                # Fallback to scanning any device
                for dev_state in state.get("device_states", {}).values():
                    if dev_state.get("lastEvent") == condition.get("eventName"):
                        return True
        return False

    async def check_step_advancement(self, session_id: str):
        state = self.get_session_state(session_id)
        if not state["scenario_id"] or state["is_complete"]:
            return
        scenario = self.scenarios.get(state["scenario_id"])
        steps = scenario.get("steps", [])
        curr_idx = state["current_step"]
        if curr_idx >= len(steps):
            return
        step = steps[curr_idx]
        if self.is_step_met(step["validation"], session_id):
            state["current_step"] += 1
            if step.get("onComplete"):
                asyncio.create_task(
                    self.run_on_complete_actions(session_id, step["onComplete"])
                )
            if state["current_step"] >= len(steps):
                state["is_complete"] = True
                await self.manager.broadcast(
                    {
                        "type": "scenario",
                        "action": "complete",
                        "scenario_id": scenario["id"],
                    },
                    session_id,
                )
                # Automatically exit scenario mode on the server
                state["scenario_id"] = None
                state["is_complete"] = False
                state["current_step"] = 0
            else:
                next_step = steps[state["current_step"]]
                await self.manager.broadcast(
                    {
                        "type": "scenario",
                        "action": "advance",
                        "step": state["current_step"],
                        "step_description": next_step.get("description", ""),
                        "scenario_id": scenario["id"],
                    },
                    session_id,
                )

    async def run_on_complete_actions(
        self, session_id: str, actions: Optional[List[Dict[str, Any]]]
    ):
        if not actions:
            return
        for action in actions:
            if action["action"] == "updateState":
                delay = action.get("delay", 0) / 1000.0
                if delay > 0:
                    await asyncio.sleep(delay)
                await self.apply_vitals_update(session_id, action["payload"])

    async def delayed_vitals_update(
        self, session_id: str, payload: Dict[str, Any], delay: float
    ):
        await asyncio.sleep(delay)
        await self.apply_vitals_update(session_id, payload)

    async def apply_vitals_update_sync_state(self, session_id: str):
        state = self.get_session_state(session_id)
        scenario_id = state.get("scenario_id")
        scenario = self.scenarios.get(scenario_id) if scenario_id else None
        steps = scenario.get("steps", []) if scenario else []
        curr_step_idx = state.get("current_step", 0)
        curr_step = steps[curr_step_idx] if curr_step_idx < len(steps) else None

        scenario_data = None
        if scenario_id:
            scenario_data = {
                "scenario_id": scenario_id,
                "title": scenario.get("title") if scenario else None,
                "current_step": curr_step_idx,
                "step_description": curr_step.get("description") if curr_step else None,
                "total_steps": len(steps),
                "is_complete": state.get("is_complete", False),
                "show_hints": state.get("show_hints", False),
            }

        import time

        await self.manager.broadcast(
            {
                "type": "sync_state",
                "global_time": time.time(),
                "patient": state["patient_state"],
                "scenario": scenario_data,
            },
            session_id,
        )

    async def transition_vitals_loop(self, session_id: str, targets: Dict[str, Any]):
        state = self.get_session_state(session_id)
        patient = state["patient_state"]

        rates = {
            "heartRate": 10.0,
            "spo2": 5.0,
            "co2": 3.0,
            "respiratoryRate": 2.0,
            "systolic": 10.0,
            "diastolic": 10.0,
        }

        interval = 0.5

        target_values = {}
        for key in ["heartRate", "spo2", "co2", "respiratoryRate"]:
            if key in targets and targets[key] is not None:
                target_values[key] = float(targets[key])

        if "bloodPressure" in targets and targets["bloodPressure"] is not None:
            bp = targets["bloodPressure"]
            if "systolic" in bp and bp["systolic"] is not None:
                target_values["systolic"] = float(bp["systolic"])
            if "diastolic" in bp and bp["diastolic"] is not None:
                target_values["diastolic"] = float(bp["diastolic"])

        try:
            while True:
                updated = {}
                for key in ["heartRate", "spo2", "co2", "respiratoryRate"]:
                    if key in target_values:
                        curr = float(patient.get(key, 0))
                        targ = target_values[key]
                        if curr != targ:
                            step = rates[key] * interval
                            if curr < targ:
                                new_val = min(targ, curr + step)
                            else:
                                new_val = max(targ, curr - step)
                            patient[key] = int(round(new_val))
                            updated[key] = patient[key]

                bp = patient.get("bloodPressure", {})
                if not isinstance(bp, dict):
                    bp = {"systolic": 120, "diastolic": 80}
                bp_updated = False
                for subkey in ["systolic", "diastolic"]:
                    if subkey in target_values:
                        curr = float(bp.get(subkey, 0))
                        targ = target_values[subkey]
                        if curr != targ:
                            step = rates[subkey] * interval
                            if curr < targ:
                                new_val = min(targ, curr + step)
                            else:
                                new_val = max(targ, curr - step)
                            bp[subkey] = int(round(new_val))
                            bp_updated = True

                if bp_updated:
                    patient["bloodPressure"] = bp
                    updated["bloodPressure"] = bp

                if not updated:
                    break

                for key, val in updated.items():
                    if key == "heartRate":
                        await self.manager.broadcast(
                            {"type": "ecg", "heartRate": val, "bpm": val, "pulse": val},
                            session_id,
                        )
                    elif key == "spo2":
                        await self.manager.broadcast(
                            {"type": "ecg", "spo2": val}, session_id
                        )
                    elif key == "co2":
                        await self.manager.broadcast(
                            {"type": "co2", "co2": val}, session_id
                        )
                    elif key == "bloodPressure":
                        await self.manager.broadcast(
                            {
                                "type": "pressure",
                                "systolic": val["systolic"],
                                "diastolic": val["diastolic"],
                            },
                            session_id,
                        )
                    elif key == "respiratoryRate":
                        await self.manager.broadcast(
                            {"type": "respiration", "respirationRate": val}, session_id
                        )

                await self.apply_vitals_update_sync_state(session_id)
                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            for key in ["heartRate", "spo2", "co2", "respiratoryRate"]:
                if key in target_values:
                    patient[key] = int(round(target_values[key]))
            if "systolic" in target_values or "diastolic" in target_values:
                bp = patient.get("bloodPressure", {})
                if not isinstance(bp, dict):
                    bp = {"systolic": 120, "diastolic": 80}
                if "systolic" in target_values:
                    bp["systolic"] = int(round(target_values["systolic"]))
                if "diastolic" in target_values:
                    bp["diastolic"] = int(round(target_values["diastolic"]))
                patient["bloodPressure"] = bp
            raise

    async def apply_vitals_update(self, session_id: str, payload: Dict[str, Any]):
        state = self.get_session_state(session_id)

        # Rhythm change happens instantly
        if "rhythmType" in payload:
            state["patient_state"]["rhythmType"] = payload["rhythmType"]
            if payload["rhythmType"] != "choc":
                state["natural_rhythm"] = payload["rhythmType"]
            await self.manager.broadcast(
                {"type": "rhythm", "rhythm": payload["rhythmType"]}, session_id
            )

        # Cancel any previous vitals transition task
        if session_id in self.transition_tasks:
            self.transition_tasks[session_id].cancel()
            try:
                await self.transition_tasks[session_id]
            except asyncio.CancelledError:
                pass
            del self.transition_tasks[session_id]

        # Start a new transition loop task for numeric parameters
        ramp_payload = {
            k: v
            for k, v in payload.items()
            if k in ["heartRate", "spo2", "co2", "respiratoryRate", "bloodPressure"]
        }
        if ramp_payload:
            self.transition_tasks[session_id] = asyncio.create_task(
                self.transition_vitals_loop(session_id, ramp_payload)
            )
        else:
            # If no numeric parameters are changed, broadcast current state immediately
            await self.apply_vitals_update_sync_state(session_id)

    async def send_current_state(
        self, websocket: WebSocket, session_id: str, device_id: str
    ):
        state = self.get_session_state(session_id)
        patient = state["patient_state"]
        device = self.get_device_state(session_id, device_id)

        scenario_id = state.get("scenario_id")
        scenario = self.scenarios.get(scenario_id) if scenario_id else None
        steps = scenario.get("steps", []) if scenario else []
        curr_step_idx = state.get("current_step", 0)
        curr_step = steps[curr_step_idx] if curr_step_idx < len(steps) else None

        import time

        await websocket.send_json(
            {
                "type": "sync_state",
                "global_time": time.time(),
                "patient": patient,
                "device": device,
                "scenario": {
                    "scenario_id": scenario_id,
                    "title": scenario.get("title") if scenario else None,
                    "current_step": curr_step_idx,
                    "step_description": curr_step.get("description")
                    if curr_step
                    else None,
                    "total_steps": len(steps),
                    "is_complete": state.get("is_complete", False),
                    "show_hints": state.get("show_hints", False),
                }
                if scenario_id
                else None,
            }
        )
