"""
Main entrypoint and orchestration server for the Defibrillator and Scope Simulation backend.

This FastAPI application coordinates simulation state synchronizations, handles real-time 
WebSocket communication between connected devices (monitors, controls, defibrillators, 
and dashboards), validates scenario step achievements, and manages automatic patient physiological updates.
"""

import json
import asyncio
import os
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse  

# Import Pydantic models for session and device states
from models import SessionState, DefibrillatorState, ScopeState, GenericDeviceState, Scenario

#-------MODELS-------------------------
class SessionData(BaseModel):
    """
    HTTP model mapping connection request identifiers.
    """
    username: str

#-------SCENARIO MANAGER-------------------------
class ScenarioManager:
    """
    Manages loaded training scenarios, validates active scenario steps,
    and isolates device configurations and physiological patient state.
    """
    PROPERTY_MAPPING = {
        "isSynchroMode": "isSynchro",
        "pulse": "heartRate",
        "heart_rate": "heartRate"
    }

    def __init__(self, manager: 'ConnectionManager'):
        """
        Initializes ScenarioManager.
        
        Args:
            manager (ConnectionManager): Real-time websocket communication manager instance.
        """
        self.manager = manager
        self.scenarios: Dict[str, Any] = {}
        self.session_states: Dict[str, Dict[str, Any]] = {} # session_id -> state
        self.load_scenarios()

    def load_scenarios(self):
        """
        Loads all scenario configuration JSON files from data/scenarios directory
        and validates them against the Scenario Pydantic model.
        """
        base_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "scenarios")
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
                        self.scenarios[validated_scenario.id] = validated_scenario.model_dump()
                except Exception as e:
                    print(f"Failed to load/validate scenario {filename}: {e}")
        print(f"Loaded {len(self.scenarios)} scenarios.")

    def get_session_state(self, session_id: str) -> Dict[str, Any]:
        """
        Retrieves the state dictionary for the given session ID. Creates a new 
        session state initialized with Pydantic schema defaults if it does not exist.
        
        Args:
            session_id (str): Unique identifier of the session/doctor.
            
        Returns:
            Dict[str, Any]: Reference to the session state dictionary.
        """
        if session_id not in self.session_states:
            self.session_states[session_id] = SessionState().model_dump()
        return self.session_states[session_id]

    def get_device_type(self, device_id: str) -> str:
        """
        Resolves a socket connection ID prefix to its canonical device type.
        
        Args:
            device_id (str): Raw device ID (e.g. "defibrillator_K8S3E").
            
        Returns:
            str: Canonical device type ("defibrillator", "scope", "control", "dashboard").
        """
        if "_" in device_id:
            parts = device_id.split("_", 1)
            if parts[0] in ["defibrillator", "scope", "control", "dashboard"]:
                return parts[0]
        if device_id.startswith("defibrillator"): return "defibrillator"
        if device_id.startswith("scope"): return "scope"
        if device_id.startswith("control") or device_id == "remote": return "control"
        if device_id.startswith("dashboard"): return "dashboard"
        return "control"  # default fallback

    def get_device_state(self, session_id: str, device_id: str) -> Dict[str, Any]:
        """
        Retrieves the isolated state configuration for a unique connection ID.
        If the device is connecting for the first time, it initializes its state 
        by deep-copying the type-level template state to prevent a zombie default state.
        
        Args:
            session_id (str): Active session ID.
            device_id (str): Unique connection ID of the device.
            
        Returns:
            Dict[str, Any]: Dictionary representing the device's isolated state.
        """
        import copy
        state = self.get_session_state(session_id)
        if "device_states" not in state:
            state["device_states"] = {}
            
        device_type = self.get_device_type(device_id)
        
        # 1. Ensure type-level template state is initialized
        if device_type not in state["device_states"]:
            if device_type == "defibrillator":
                state["device_states"][device_type] = DefibrillatorState().model_dump()
            elif device_type == "scope":
                state["device_states"][device_type] = ScopeState().model_dump()
            else:
                state["device_states"][device_type] = GenericDeviceState().model_dump()
                
        # 2. Initialize requested device ID from template deep copy if not present
        if device_id not in state["device_states"]:
            state["device_states"][device_id] = copy.deepcopy(state["device_states"][device_type])
            
        return state["device_states"][device_id]

    def get_state_value(self, session_id: str, property_name: str, device_id: Optional[str] = None):
        """
        Retrieves a property value from either a targeted device state, the last 
        updated device state, or patient physiology state. Used for scenario condition evaluation.
        
        Args:
            session_id (str): Unique identifier of the session.
            property_name (str): The state variable name to lookup.
            device_id (Optional[str]): Targeted connection ID.
            
        Returns:
            Any: Value of the property, or None if not found.
        """
        state = self.get_session_state(session_id)
        mapped_prop = self.PROPERTY_MAPPING.get(property_name, property_name)
        
        # 1. Specific device targeted
        if device_id:
            dev_state = state.get("device_states", {}).get(device_id)
            if dev_state and mapped_prop in dev_state:
                return dev_state[mapped_prop]
            canonical_type = self.get_device_type(device_id)
            dev_state = state.get("device_states", {}).get(canonical_type)
            if dev_state and mapped_prop in dev_state:
                return dev_state[mapped_prop]
                
        # 2. Fallback to last updated device
        last_dev_id = state.get("last_updated_device")
        if last_dev_id:
            dev_state = state.get("device_states", {}).get(last_dev_id)
            if dev_state and mapped_prop in dev_state:
                return dev_state[mapped_prop]
            canonical_last = self.get_device_type(last_dev_id)
            dev_state = state.get("device_states", {}).get(canonical_last)
            if dev_state and mapped_prop in dev_state:
                return dev_state[mapped_prop]
                
        # 3. Fallback to patient state
        val = state.get("patient_state", {}).get(mapped_prop)
        if val is not None: return val
        
        # 4. Fallback to scanning any device
        for dev_state in state.get("device_states", {}).values():
            if mapped_prop in dev_state:
                return dev_state[mapped_prop]
        return None

    async def start_scenario(self, session_id: str, scenario_id: str):
        """
        Starts the execution of a scenario by loading its initial patient state
        and broadcasting start parameters to connected devices.
        
        Args:
            session_id (str): Active session identifier.
            scenario_id (str): ID of the scenario to launch.
        """
        if scenario_id not in self.scenarios: return
        scenario = self.scenarios[scenario_id]
        state = self.get_session_state(session_id)
        state.update({
            "scenario_id": scenario_id,
            "current_step": 0,
            "is_complete": False,
            "show_hints": False
        })
        state["patient_state"] = scenario.get("initialState", {}).copy()

        steps = scenario.get("steps", [])
        first_step = steps[0] if steps else {}
        await self.manager.broadcast({
            "type": "scenario",
            "action": "start",
            "scenario_id": scenario_id,
            "title": scenario["title"],
            "step_description": first_step.get("description", ""),
            "total_steps": len(steps),
            "show_hints": False
        }, session_id)

        await self.apply_vitals_update(session_id, state["patient_state"])

    async def stop_scenario(self, session_id: str):
        """
        Terminates the active scenario, clearing it from session state
        and broadcasting stop message to devices.
        
        Args:
            session_id (str): Active session ID.
        """
        if session_id in self.session_states:
            self.session_states[session_id]["scenario_id"] = None
            self.session_states[session_id]["show_hints"] = False
        await self.manager.broadcast({"type": "scenario", "action": "stop"}, session_id)

    async def toggle_hints(self, session_id: str, show_hints: bool):
        """
        Toggles scenario step/hint visibility on student defibrillator screens.
        
        Args:
            session_id (str): Active session ID.
            show_hints (bool): True to show hints, False to hide them.
        """
        state = self.get_session_state(session_id)
        state["show_hints"] = show_hints
        await self.manager.broadcast({
            "type": "scenario",
            "action": "toggle_hints",
            "show_hints": show_hints
        }, session_id)
        # Trigger vitals update to broadcast full sync_state
        await self.apply_vitals_update(session_id, {})

    def get_active_device_ids(self, session_id: str, device_type: str) -> List[str]:
        """
        Returns connection IDs of active connected devices matching a target device type.
        
        Args:
            session_id (str): Active session ID.
            device_type (str): Target canonical device type.
            
        Returns:
            List[str]: List of active socket connection IDs.
        """
        if session_id not in self.manager.active_connections:
            return []
        active_ids = []
        for dev_id in self.manager.active_connections[session_id].keys():
            if self.get_device_type(dev_id) == device_type:
                active_ids.append(dev_id)
        return active_ids

    async def update_device_state(self, session_id: str, device_id: str, updates: Dict[str, Any]):
        """
        Updates device state parameters. If the update is sourced from an instructor 
        remote/control panel, the changes are written to the canonical type template 
        and propagated to all active devices of that type. Local actions from unique 
        devices are written only to the sending device and the corresponding template.
        
        Args:
            session_id (str): Active session ID.
            device_id (str): Origin connection ID of the device (or targeted type template).
            updates (Dict[str, Any]): Dictionary of values to update in state.
        """
        state = self.get_session_state(session_id)
        
        # 1. Resolve canonical device type
        device_type = self.get_device_type(device_id)
        
        # 2. Determine if the update is from a control/remote panel
        # If the sender is control/remote, it means the update is a command targeting a device type template
        is_control_update = device_type == "control" or device_id in ["defibrillator", "scope"]
        
        if is_control_update:
            target_type = device_id if device_id in ["defibrillator", "scope"] else "defibrillator"
            # Update template
            template_state = self.get_device_state(session_id, target_type)
            template_state.update(updates)
            # Update all active devices of this type
            active_ids = self.get_active_device_ids(session_id, target_type)
            for act_id in active_ids:
                dev_state = self.get_device_state(session_id, act_id)
                dev_state.update(updates)
                
            state["last_updated_device"] = target_type
            await self.check_physiology_rules(session_id, target_type, updates.get("lastEvent"))
        else:
            # Local update from a specific unique device
            dev_state = self.get_device_state(session_id, device_id)
            dev_state.update(updates)
            
            # Also update the template state so new connections inherit it
            template_state = self.get_device_state(session_id, device_type)
            template_state.update(updates)
            
            state["last_updated_device"] = device_id
            await self.check_physiology_rules(session_id, device_id, updates.get("lastEvent"))
            
        await self.check_step_advancement(session_id)

    async def run_pni_cycle(self, session_id: str):
        """
        Simulates a non-invasive blood pressure (PNI) measurement cycle
        by broadcasting incremental values to the defibrillator client.
        
        Args:
            session_id (str): Active session ID.
        """
        await self.manager.broadcast({"type": "defibrillator_action", "action": "pni_start", "is_pni_measuring": True}, session_id)
        for val in [160, 140, 120, 100, 80, 60, 40, 20]:
            await asyncio.sleep(0.5)
            await self.manager.broadcast({"type": "defibrillator_action", "action": "pni_step", "value": val}, session_id)
        await self.manager.broadcast({"type": "defibrillator_action", "action": "pni_done", "is_pni_measuring": False, "show_pni": True}, session_id)

    async def check_physiology_rules(self, session_id: str, device_id: str, last_event: Optional[str]):
        """
        Applies physiological changes based on active clinical rules.
        Includes shock transient rhythm updates and cardiac pacing/capture simulation.
        
        Args:
            session_id (str): Active session ID.
            device_id (str): Device connection ID or canonical type key of device triggers.
            last_event (Optional[str]): Action identifier triggering the check.
        """
        state = self.get_session_state(session_id)
        device = self.get_device_state(session_id, device_id)
        
        # 1. SHOCK PHYSICS (Transient)
        if last_event == "shockDelivered":
            await self.apply_vitals_update(session_id, {"rhythmType": "choc"})
            # Revert to natural rhythm after a short delay
            asyncio.create_task(self.delayed_vitals_update(session_id, {"rhythmType": state["natural_rhythm"]}, 0.5))
            return

        # 2. PACING PHYSICS (Captured state)
        # ONLY apply if Pacing is ON and Intensity is high, and the event was pacer-related
        pacer_events = ["toggle_pacing", "set_pacer_frequency", "set_pacer_intensity", "set_display_mode"]
        if last_event in pacer_events and device.get("isPacing") and device.get("pacerIntensity", 0) >= 90:
            pacer_bpm = device.get("pacerFrequency", 70)
            await self.apply_vitals_update(session_id, {"rhythmType": "electroEntrainement", "heartRate": pacer_bpm})

    async def update_patient_state(self, session_id: str, updates: Dict[str, Any]):
        """
        Modifies the physiological patient vitals state, records rhythm 
        baselines, and checks scenario step advancement.
        
        Args:
            session_id (str): Active session ID.
            updates (Dict[str, Any]): Physiological vital updates dictionary.
        """
        state = self.get_session_state(session_id)
        state["patient_state"].update(updates)

        # Track natural rhythm (non-transient)
        if "rhythmType" in updates and updates["rhythmType"] != "choc":
            state["natural_rhythm"] = updates["rhythmType"]

        await self.check_step_advancement(session_id)

    def is_step_met(self, validation: Dict[str, Any], session_id: str) -> bool:
        """
        Evaluates step validation rules containing comparison matrices (all_of, any_of) 
        or single condition items.
        
        Args:
            validation (Dict[str, Any]): Scenario config validation rule tree.
            session_id (str): Active session ID.
            
        Returns:
            bool: True if step criteria are met, False otherwise.
        """
        if "all_of" in validation: return all(self.check_condition(c, session_id) for c in validation["all_of"])
        if "any_of" in validation: return any(self.check_condition(c, session_id) for c in validation["any_of"])
        return self.check_condition(validation, session_id)

    def check_condition(self, condition: Dict[str, Any], session_id: str) -> bool:
        """
        Evaluates a single condition dictionary (stateChange or event triggers).
        
        Args:
            condition (Dict[str, Any]): Single rule configuration block.
            session_id (str): Active session ID.
            
        Returns:
            bool: True if the condition is met, False otherwise.
        """
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
                    if operator == ">=": return act_num >= exp_num
                    if operator == "<=": return act_num <= exp_num
                    if operator == ">": return act_num > exp_num
                    if operator == "<": return act_num < exp_num
                except (ValueError, TypeError):
                    return False
            
            # Default / Equality checking
            if isinstance(actual, bool) or isinstance(expected, bool):
                def to_bool(v):
                    if isinstance(v, bool): return v
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
        """
        Validates if the condition requirements for the active scenario step 
        have been successfully met. If so, advances the scenario index, schedules 
        onComplete step updates, and broadcasts the status.
        
        Args:
            session_id (str): Active session ID.
        """
        state = self.get_session_state(session_id)
        if not state["scenario_id"] or state["is_complete"]: return
        scenario = self.scenarios.get(state["scenario_id"])
        steps = scenario.get("steps", [])
        curr_idx = state["current_step"]
        if curr_idx >= len(steps): return
        step = steps[curr_idx]
        if self.is_step_met(step["validation"], session_id):
            state["current_step"] += 1
            if step.get("onComplete"): asyncio.create_task(self.run_on_complete_actions(session_id, step["onComplete"]))
            if state["current_step"] >= len(steps):
                state["is_complete"] = True
                await self.manager.broadcast({"type": "scenario", "action": "complete", "scenario_id": scenario["id"]}, session_id)
            else:
                next_step = steps[state["current_step"]]
                await self.manager.broadcast({
                    "type": "scenario",
                    "action": "advance",
                    "step": state["current_step"],
                    "step_description": next_step.get("description", ""),
                    "scenario_id": scenario["id"]
                }, session_id)

    async def run_on_complete_actions(self, session_id: str, actions: Optional[List[Dict[str, Any]]]):
        """
        Runs the actions mapped in step.onComplete (such as delayed state updates) 
        sequentially.
        
        Args:
            session_id (str): Active session ID.
            actions (Optional[List[Dict[str, Any]]]): List of actions configuration.
        """
        if not actions:
            return
        for action in actions:
            if action["action"] == "updateState":
                delay = action.get("delay", 0) / 1000.0
                if delay > 0: await asyncio.sleep(delay)
                await self.apply_vitals_update(session_id, action["payload"])

    async def delayed_vitals_update(self, session_id: str, payload: Dict[str, Any], delay: float):
        """
        Schedules a delayed vital update.
        
        Args:
            session_id (str): Active session ID.
            payload (Dict[str, Any]): Vitals updates.
            delay (float): Delay in seconds.
        """
        await asyncio.sleep(delay)
        await self.apply_vitals_update(session_id, payload)

    async def apply_vitals_update(self, session_id: str, payload: Dict[str, Any]):
        """
        Updates patient physiological vitals state, triggers vital-specific updates, 
        and broadcasts a single unified "sync_state" state-sync message.
        
        Args:
            session_id (str): Active session ID.
            payload (Dict[str, Any]): Vitals updates map.
        """
        state = self.get_session_state(session_id)
        state["patient_state"].update(payload)
        for key, val in payload.items():
            if key == "rhythmType": await self.manager.broadcast({"type": "rhythm", "rhythm": val}, session_id)
            elif key == "heartRate":
                await self.manager.broadcast({
                    "type": "ecg",
                    "heartRate": val,
                    "bpm": val,
                    "pulse": val
                }, session_id)
            elif key == "spo2": await self.manager.broadcast({"type": "ecg", "spo2": val}, session_id)
            elif key == "co2": await self.manager.broadcast({"type": "co2", "co2": val}, session_id)
            elif key == "bloodPressure": await self.manager.broadcast({"type": "pressure", "systolic": val.get("systolic"), "diastolic": val.get("diastolic")}, session_id)
            elif key == "respiratoryRate": await self.manager.broadcast({"type": "respiration", "respirationRate": val}, session_id)

        # Broadcast a unified sync_state message to prevent clients from dropping concurrent updates due to React event batching
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
                "show_hints": state.get("show_hints", False)
            }

        import time
        await self.manager.broadcast({
            "type": "sync_state",
            "global_time": time.time(),
            "patient": state["patient_state"],
            "scenario": scenario_data
        }, session_id)

    async def send_current_state(self, websocket: WebSocket, session_id: str, device_id: str):
        """
        Sends the complete current patient, device, and active scenario state
        directly to a newly connected client socket.
        
        Args:
            websocket (WebSocket): Target client websocket connection.
            session_id (str): Active session ID.
            device_id (str): Connection ID of the connecting device.
        """
        state = self.get_session_state(session_id)
        patient = state["patient_state"]
        device = self.get_device_state(session_id, device_id)
        
        scenario_id = state.get("scenario_id")
        scenario = self.scenarios.get(scenario_id) if scenario_id else None
        steps = scenario.get("steps", []) if scenario else []
        curr_step_idx = state.get("current_step", 0)
        curr_step = steps[curr_step_idx] if curr_step_idx < len(steps) else None

        import time
        await websocket.send_json({
            "type": "sync_state",
            "global_time": time.time(),
            "patient": patient,
            "device": device,
            "scenario": {
                "scenario_id": scenario_id,
                "title": scenario.get("title") if scenario else None,
                "current_step": curr_step_idx,
                "step_description": curr_step.get("description") if curr_step else None,
                "total_steps": len(steps),
                "is_complete": state.get("is_complete", False),
                "show_hints": state.get("show_hints", False)
            } if scenario_id else None
        })

class ConnectionManager:
    """
    Manages active WebSocket connections grouped by session and device, 
    and handles message broadcasting.
    """
    def __init__(self): 
        """
        Initializes ConnectionManager.
        """
        self.active_connections: dict[str, dict[str, list[WebSocket]]] = {}

    async def broadcast_device_list(self, session_id: str):
        """
        Broadcasts the current list of active connection IDs connected to this session.
        
        Args:
            session_id (str): Target session ID.
        """
        if session_id in self.active_connections:
            # Get all the unique device IDs currently connected to this session
            device_ids = list(self.active_connections[session_id].keys())
            await self.broadcast({
                "type": "device_list_update",
                "devices": device_ids
            }, session_id=session_id)

    async def connect(self, websocket: WebSocket, session_id: str, device_id: str):
        """
        Accepts a WebSocket connection, closes any stale remote instances,
        registers the socket, and broadcasts the updated device list.
        
        Args:
            websocket (WebSocket): Connecting socket.
            session_id (str): Associated session identifier.
            device_id (str): Unique identifier of the device.
        """
        await websocket.accept()
        if session_id not in self.active_connections: self.active_connections[session_id] = {}
        if device_id == "remote" and "remote" in self.active_connections[session_id]:
            for old_ws in self.active_connections[session_id]["remote"]:
                try: await old_ws.close(code=1000)
                except: pass
            self.active_connections[session_id]["remote"] = []
        if device_id not in self.active_connections[session_id]: self.active_connections[session_id][device_id] = []
        self.active_connections[session_id][device_id].append(websocket)

        # Tell everyone a new device joined
        await self.broadcast_device_list(session_id)

    async def disconnect(self, websocket: WebSocket, session_id: str, device_id: str):
        """
        Unregisters a disconnected WebSocket connection and broadcasts the 
        updated device list.
        
        Args:
            websocket (WebSocket): Disconnected socket.
            session_id (str): Associated session ID.
            device_id (str): Disconnected device ID.
        """
        if session_id in self.active_connections:
            if device_id in self.active_connections[session_id]:
                if websocket in self.active_connections[session_id][device_id]:
                    self.active_connections[session_id][device_id].remove(websocket)
                    if not self.active_connections[session_id][device_id]: del self.active_connections[session_id][device_id]
            if not self.active_connections[session_id]: del self.active_connections[session_id]

            # Tell everyone a device left
            await self.broadcast_device_list(session_id)

    async def broadcast(self, message: dict, session_id: str = None, target_device: str = None):
        """
        Broadcasts a JSON message. Can target a specific session or specific targeted 
        device type within the session. If no session is specified, broadcasts globally.
        
        Args:
            message (dict): JSON-serializable dictionary to broadcast.
            session_id (Optional[str]): Target session ID.
            target_device (Optional[str]): Targeted device type/ID prefix (direct prefix matched).
        """
        final_target = target_device or message.get("target_device")
        if session_id and session_id in self.active_connections:
            if final_target:
                # Direct prefix matching under the definitive naming scheme
                for dev_id, connections in self.active_connections[session_id].items():
                    if dev_id == final_target or dev_id.startswith(final_target + "_"):
                        for conn in connections:
                            try: await conn.send_json(message)
                            except: pass
            else:
                for device_list in self.active_connections[session_id].values():
                    for conn in device_list:
                        try: await conn.send_json(message)
                        except: pass
        elif not session_id:
            for s_id in list(self.active_connections.keys()):
                for device_list in self.active_connections[s_id].values():
                    for conn in device_list:
                        try: await conn.send_json(message)
                        except: pass

manager = ConnectionManager()
scenario_engine = ScenarioManager(manager)

async def time_sync_loop():
    """
    Asynchronous background loop that periodically broadcasts the current server time.
    
    Runs continuously throughout the lifetime of the application, broadcasting 
    a "time_sync" event with the current unix epoch timestamp every 1.0 second 
    to all active sessions. This allows clients (scopes, defibrillators, and remotes) 
    to coordinate animations and timeline events using a unified server clock.
    """
    import time
    while True:
        try:
            await asyncio.sleep(1.0)
            sessions = list(manager.active_connections.keys())
            if sessions:
                current_time = time.time()
                for session_id in sessions:
                    await manager.broadcast({
                        "type": "time_sync",
                        "global_time": current_time
                    }, session_id)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Error in time sync loop: {e}")
            await asyncio.sleep(1.0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager handling startup and shutdown events.
    
    Initiates the background time synchronization loop task upon application startup, 
    and handles clean cancellation and cleanup of the task upon application shutdown.
    
    Args:
        app (FastAPI): The running FastAPI application instance.
    """
    sync_task = asyncio.create_task(time_sync_loop())
    try:
        yield
    finally:
        sync_task.cancel()
        try:
            await sync_task
        except asyncio.CancelledError:
            pass

app = FastAPI(title="Système médical avec télécommande", lifespan=lifespan)

@app.websocket("/sessionId")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint handling all active simulator connections.
    
    Accepts WebSocket connections on `/sessionId`, mapping each socket to a specific
    `username` (session/doctor identifier) and `deviceId`. Upon connection, it:
    1. Registers the connection with the global connection manager.
    2. Sends the current authoritative session state (patient vitals, device configuration, 
       and scenario timeline) to the connecting device.
    3. Runs an infinite loop to receive, decode, and route JSON messages from the client.
    
    Validates scenario step criteria and processes physiological rules (shock delivery, 
    pacer capture, vital sign edits) as client actions occur. Properly handles 
    disconnections by unregistering the socket.
    
    Args:
        websocket (WebSocket): The client WebSocket connection instance.
    """
    query_params = websocket.query_params
    session_id, device_id = query_params.get("username", "anonymous"), query_params.get("deviceId", "unknown")
    await manager.connect(websocket, session_id, device_id)
    # Sync newly connected device with the current authoritative session state
    await scenario_engine.send_current_state(websocket, session_id, device_id)
    try:
        while True:
            client_data = await websocket.receive_text()
            try:
                data = json.loads(client_data)
                data["session_id"], data["source_device"] = session_id, device_id
                msg_type, action, target = data.get("type"), data.get("action"), data.get("target_device")
                
                if msg_type == "request_sync":
                    await scenario_engine.send_current_state(websocket, session_id, device_id)
                    continue

                if msg_type == "scenario":
                    if action == "start": await scenario_engine.start_scenario(session_id, data.get("scenario_id"))
                    elif action == "stop": await scenario_engine.stop_scenario(session_id)
                    elif action == "toggle_hints": await scenario_engine.toggle_hints(session_id, data.get("show_hints", False))
                    elif action == "step_validated":
                        await scenario_engine.update_device_state(session_id, device_id, {"lastEvent": "stepValidated"})
                        await manager.broadcast(data, session_id)

                
                if msg_type == "defibrillator_action":
                    normalized_event = "shockDelivered" if action == "shock_delivered" else action
                    updates = {"lastEvent": normalized_event}
                    is_remote = device_id.startswith("control") or device_id == "remote"
                    target_id = "defibrillator" if is_remote else device_id
                    if action == "shock_delivered":
                        dev_state = scenario_engine.get_device_state(session_id, target_id)
                        current_shocks = dev_state.get("shockCount", 0)
                        updates["shockCount"] = current_shocks + 1
                    
                    if action == "set_energy": updates["manualEnergy"] = data.get("energy")
                    if action == "set_display_mode": updates["displayMode"] = data.get("display_mode")
                    if action == "toggle_pacing": updates["isPacing"] = data.get("is_pacing")
                    if action == "set_pacer_frequency": updates["pacerFrequency"] = data.get("frequency")
                    if action == "set_pacer_intensity": updates["pacerIntensity"] = data.get("intensity")
                    if action == "toggle_synchro": updates["isSynchro"] = data.get("is_synchro_mode")
                    if action == "toggle_fc": updates["hrDotted"] = not data.get("show_fc", False)
                    if action == "toggle_vitals":
                        show_vitals = data.get("show_vitals", False)
                        updates["pressureDotted"] = not show_vitals
                        updates["co2Dotted"] = not show_vitals
                    
                    if action == "start_pni": asyncio.create_task(scenario_engine.run_pni_cycle(session_id))
                    await scenario_engine.update_device_state(session_id, target_id, updates)

                if target: await manager.broadcast(data, session_id, target_device=target)
                elif msg_type in ["ecg", "co2", "pressure", "respiration", "rhythm", "HRscope", "Prscope", "COscope", "defibrillator_action", "visibility_state", "display_mode", "live_hardware"] or action in ["shock_delivered"]:
                    if msg_type == "ecg": await scenario_engine.update_patient_state(session_id, {"heartRate": data.get("bpm"), "spo2": data.get("spo2")})
                    elif msg_type == "rhythm": await scenario_engine.update_patient_state(session_id, {"rhythmType": data.get("rhythm")})
                    elif msg_type == "co2": await scenario_engine.update_patient_state(session_id, {"co2": data.get("co2")})
                    elif msg_type == "pressure": await scenario_engine.update_patient_state(session_id, {"bloodPressure": {"systolic": data.get("systolic"), "diastolic": data.get("diastolic")}})
                    elif msg_type == "respiration": await scenario_engine.update_patient_state(session_id, {"respiratoryRate": data.get("respirationRate")})
                    elif msg_type == "HRscope": 
                        target_dev = "defibrillator" if data.get("dataType") == "defib" else "scope"
                        target_id = target_dev if (device_id.startswith("control") or device_id == "remote") else device_id
                        updates = {"defibHrDotted": data.get("isDefibHRDotted")} if data.get("dataType") == "defib" else {"hrDotted": data.get("isHRDotted")}
                        await scenario_engine.update_device_state(session_id, target_id, updates)
                    elif msg_type == "Prscope": 
                        target_dev = "defibrillator" if data.get("dataType") == "defib" else "scope"
                        target_id = target_dev if (device_id.startswith("control") or device_id == "remote") else device_id
                        updates = {"defibPressureDotted": data.get("isDefibPressureDotted")} if data.get("dataType") == "defib" else {"pressureDotted": data.get("isPressureDotted")}
                        await scenario_engine.update_device_state(session_id, target_id, updates)
                    elif msg_type == "COscope": 
                        target_dev = "defibrillator" if data.get("dataType") == "defib" else "scope"
                        target_id = target_dev if (device_id.startswith("control") or device_id == "remote") else device_id
                        updates = {"defibCo2Dotted": data.get("isDefibCO2Dotted")} if data.get("dataType") == "defib" else {"co2Dotted": data.get("isCO2Dotted")}
                        await scenario_engine.update_device_state(session_id, target_id, updates)
                    elif msg_type == "display_mode":
                        target_dev = "defibrillator" if data.get("dataType") == "defib" else "scope"
                        target_id = target_dev if (device_id.startswith("control") or device_id == "remote") else device_id
                        updates = {"isDefibRemoteControl": data.get("isRemoteControl")} if data.get("dataType") == "defib" else {"isRemoteControl": data.get("isRemoteControl")}
                        await scenario_engine.update_device_state(session_id, target_id, updates)
                    await manager.broadcast(data, session_id)
                elif msg_type == "demandlog":
                    await manager.broadcast(data, session_id)
                elif msg_type == "simu_start":
                    await manager.broadcast(data, session_id)
                else:
                    await websocket.send_json(data)
                    # Broadcast to any connected control/remote panels
                    if not device_id.startswith("control"):
                        await manager.broadcast(data, session_id, target_device="control")
                    # Broadcast to any connected dashboards
                    if not device_id.startswith("dashboard"):
                        await manager.broadcast(data, session_id, target_device="dashboard")
            except json.JSONDecodeError: pass
    except WebSocketDisconnect:  await manager.disconnect(websocket, session_id, device_id)
