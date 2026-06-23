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
    username: str

#-------SCENARIO MANAGER-------------------------
class ScenarioManager:
    PROPERTY_MAPPING = {
        "isSynchroMode": "isSynchro",
        "pulse": "heartRate",
        "heart_rate": "heartRate"
    }

    def __init__(self, manager: 'ConnectionManager'):
        self.manager = manager
        self.scenarios: Dict[str, Any] = {}
        self.session_states: Dict[str, Dict[str, Any]] = {} # session_id -> state
        self.load_scenarios()

    def load_scenarios(self):
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
        return state["device_states"][device_id]

    def get_state_value(self, session_id: str, property_name: str, device_id: Optional[str] = None):
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
        if val is not None: return val
        
        # 4. Fallback to scanning any device
        for dev_state in state.get("device_states", {}).values():
            if mapped_prop in dev_state:
                return dev_state[mapped_prop]
        return None

    async def start_scenario(self, session_id: str, scenario_id: str):
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
        if session_id in self.session_states:
            self.session_states[session_id]["scenario_id"] = None
            self.session_states[session_id]["show_hints"] = False
        await self.manager.broadcast({"type": "scenario", "action": "stop"}, session_id)

    async def toggle_hints(self, session_id: str, show_hints: bool):
        state = self.get_session_state(session_id)
        state["show_hints"] = show_hints
        await self.manager.broadcast({
            "type": "scenario",
            "action": "toggle_hints",
            "show_hints": show_hints
        }, session_id)
        # Trigger vitals update to broadcast full sync_state
        await self.apply_vitals_update(session_id, {})


    async def update_device_state(self, session_id: str, device_id: str, updates: Dict[str, Any]):
        state = self.get_session_state(session_id)
        
        # 1. Update the isolated device state
        dev_state = self.get_device_state(session_id, device_id)
        dev_state.update(updates)
        
        # 2. Track last updated device
        state["last_updated_device"] = device_id
        
        await self.check_physiology_rules(session_id, device_id, updates.get("lastEvent"))
        await self.check_step_advancement(session_id)

    async def run_pni_cycle(self, session_id: str):
        await self.manager.broadcast({"type": "defibrillator_action", "action": "pni_start", "is_pni_measuring": True}, session_id)
        for val in [160, 140, 120, 100, 80, 60, 40, 20]:
            await asyncio.sleep(0.5)
            await self.manager.broadcast({"type": "defibrillator_action", "action": "pni_step", "value": val}, session_id)
        await self.manager.broadcast({"type": "defibrillator_action", "action": "pni_done", "is_pni_measuring": False, "show_pni": True}, session_id)

    async def check_physiology_rules(self, session_id: str, device_id: str, last_event: Optional[str]):
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
        state = self.get_session_state(session_id)
        state["patient_state"].update(updates)

        # Track natural rhythm (non-transient)
        if "rhythmType" in updates and updates["rhythmType"] != "choc":
            state["natural_rhythm"] = updates["rhythmType"]

        await self.check_step_advancement(session_id)

    def is_step_met(self, validation: Dict[str, Any], session_id: str) -> bool:
        if "all_of" in validation: return all(self.check_condition(c, session_id) for c in validation["all_of"])
        if "any_of" in validation: return any(self.check_condition(c, session_id) for c in validation["any_of"])
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
        if not actions:
            return
        for action in actions:
            if action["action"] == "updateState":
                delay = action.get("delay", 0) / 1000.0
                if delay > 0: await asyncio.sleep(delay)
                await self.apply_vitals_update(session_id, action["payload"])

    async def delayed_vitals_update(self, session_id: str, payload: Dict[str, Any], delay: float):
        await asyncio.sleep(delay)
        await self.apply_vitals_update(session_id, payload)

    async def apply_vitals_update(self, session_id: str, payload: Dict[str, Any]):
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
    def __init__(self): self.active_connections: dict[str, dict[str, list[WebSocket]]] = {}
    async def connect(self, websocket: WebSocket, session_id: str, device_id: str):
        await websocket.accept()
        if session_id not in self.active_connections: self.active_connections[session_id] = {}
        if device_id == "remote" and "remote" in self.active_connections[session_id]:
            for old_ws in self.active_connections[session_id]["remote"]:
                try: await old_ws.close(code=1000)
                except: pass
            self.active_connections[session_id]["remote"] = []
        if device_id not in self.active_connections[session_id]: self.active_connections[session_id][device_id] = []
        self.active_connections[session_id][device_id].append(websocket)
    def disconnect(self, websocket: WebSocket, session_id: str, device_id: str):
        if session_id in self.active_connections:
            if device_id in self.active_connections[session_id]:
                if websocket in self.active_connections[session_id][device_id]:
                    self.active_connections[session_id][device_id].remove(websocket)
                    if not self.active_connections[session_id][device_id]: del self.active_connections[session_id][device_id]
            if not self.active_connections[session_id]: del self.active_connections[session_id]
    async def broadcast(self, message: dict, session_id: str = None, target_device: str = None):
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
                    if action == "shock_delivered":
                        dev_state = scenario_engine.get_device_state(session_id, device_id)
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
                    await scenario_engine.update_device_state(session_id, device_id, updates)

                if target: await manager.broadcast(data, session_id, target_device=target)
                elif msg_type in ["ecg", "co2", "pressure", "respiration", "rhythm", "HRscope", "Prscope", "COscope", "defibrillator_action", "visibility_state", "display_mode"] or action in ["shock_delivered"]:
                    if msg_type == "ecg": await scenario_engine.update_patient_state(session_id, {"heartRate": data.get("bpm"), "spo2": data.get("spo2")})
                    elif msg_type == "rhythm": await scenario_engine.update_patient_state(session_id, {"rhythmType": data.get("rhythm")})
                    elif msg_type == "co2": await scenario_engine.update_patient_state(session_id, {"co2": data.get("co2")})
                    elif msg_type == "pressure": await scenario_engine.update_patient_state(session_id, {"bloodPressure": {"systolic": data.get("systolic"), "diastolic": data.get("diastolic")}})
                    elif msg_type == "respiration": await scenario_engine.update_patient_state(session_id, {"respiratoryRate": data.get("respirationRate")})
                    elif msg_type == "HRscope": 
                        if data.get("dataType") == "defib": await scenario_engine.update_device_state(session_id, device_id, {"defibHrDotted": data.get("isDefibHRDotted")})
                        else: await scenario_engine.update_device_state(session_id, device_id, {"hrDotted": data.get("isHRDotted")})
                    elif msg_type == "Prscope": 
                        if data.get("dataType") == "defib": await scenario_engine.update_device_state(session_id, device_id, {"defibPressureDotted": data.get("isDefibPressureDotted")})
                        else: await scenario_engine.update_device_state(session_id, device_id, {"pressureDotted": data.get("isPressureDotted")})
                    elif msg_type == "COscope": 
                        if data.get("dataType") == "defib": await scenario_engine.update_device_state(session_id, device_id, {"defibCo2Dotted": data.get("isDefibCO2Dotted")})
                        else: await scenario_engine.update_device_state(session_id, device_id, {"co2Dotted": data.get("isCO2Dotted")})
                    elif msg_type == "display_mode":
                        if data.get("dataType") == "defib": await scenario_engine.update_device_state(session_id, device_id, {"isDefibRemoteControl": data.get("isRemoteControl")})
                        else: await scenario_engine.update_device_state(session_id, device_id, {"isRemoteControl": data.get("isRemoteControl")})
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
    except WebSocketDisconnect: manager.disconnect(websocket, session_id, device_id)
