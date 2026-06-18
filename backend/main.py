import json
import asyncio
import os
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse  

#-------MODELS-------------------------
class SessionData(BaseModel):
    username: str

#-------SCENARIO MANAGER-------------------------
class ScenarioManager:
    def __init__(self, manager: 'ConnectionManager'):
        self.manager = manager
        self.scenarios: Dict[str, Any] = {}
        self.session_states: Dict[str, Dict[str, Any]] = {} # session_id -> state
        self.load_scenarios()

    def load_scenarios(self):
        base_path = "frontend/src/app/data/scenarios"
        if not os.path.exists(base_path):
            print(f"Warning: Scenario path {base_path} not found.")
            return

        for filename in os.listdir(base_path):
            if filename.endswith(".json"):
                try:
                    with open(os.path.join(base_path, filename), "r") as f:
                        scenario = json.load(f)
                        self.scenarios[scenario["id"]] = scenario
                except Exception as e:
                    print(f"Failed to load scenario {filename}: {e}")
        print(f"Loaded {len(self.scenarios)} scenarios.")

    def get_session_state(self, session_id: str) -> Dict[str, Any]:
        if session_id not in self.session_states:
            self.session_states[session_id] = {
                "scenario_id": None,
                "current_step": 0,
                "natural_rhythm": "sinus",
                "device_state": {
                    "displayMode": "ARRET",
                    "manualEnergy": 0,
                    "lastEvent": None,
                    "isPacing": False,
                    "pacerFrequency": 70,
                    "pacerIntensity": 30,
                    "isSynchro": False,
                    "hrDotted": True,
                    "pressureDotted": True,
                    "co2Dotted": True
                },
                "patient_state": {
                    "heartRate": 70,
                    "rhythmType": "sinus",
                    "spo2": 98,
                    "co2": 40,
                    "bloodPressure": {"systolic": 120, "diastolic": 80},
                    "respiratoryRate": 15
                },
                "is_complete": False
            }
        return self.session_states[session_id]

    def get_state_value(self, session_id: str, property_name: str):
        state = self.get_session_state(session_id)
        val = state.get("device_state", {}).get(property_name)
        if val is not None: return val
        val = state.get("patient_state", {}).get(property_name)
        if val is not None: return val
        return None

    async def start_scenario(self, session_id: str, scenario_id: str):
        if scenario_id not in self.scenarios: return
        scenario = self.scenarios[scenario_id]
        state = self.get_session_state(session_id)
        state.update({
            "scenario_id": scenario_id,
            "current_step": 0,
            "is_complete": False
        })
        state["patient_state"] = scenario.get("initialState", {}).copy()
        await self.manager.broadcast({
            "type": "scenario",
            "action": "start",
            "scenario_id": scenario_id,
            "title": scenario["title"]
        }, session_id)
        await self.apply_vitals_update(session_id, state["patient_state"])

    async def stop_scenario(self, session_id: str):
        if session_id in self.session_states:
            self.session_states[session_id]["scenario_id"] = None
        await self.manager.broadcast({"type": "scenario", "action": "stop"}, session_id)

    async def update_device_state(self, session_id: str, updates: Dict[str, Any]):
        state = self.get_session_state(session_id)
        state["device_state"].update(updates)
        await self.check_physiology_rules(session_id, updates.get("lastEvent"))
        await self.check_step_advancement(session_id)

    async def run_pni_cycle(self, session_id: str):
        await self.manager.broadcast({"type": "defibrillator_action", "action": "pni_start", "is_pni_measuring": True}, session_id)
        for val in [160, 140, 120, 100, 80, 60, 40, 20]:
            await asyncio.sleep(0.5)
            await self.manager.broadcast({"type": "defibrillator_action", "action": "pni_step", "value": val}, session_id)
        await self.manager.broadcast({"type": "defibrillator_action", "action": "pni_done", "is_pni_measuring": False, "show_pni": True}, session_id)

    async def check_physiology_rules(self, session_id: str, last_event: Optional[str]):
        state = self.get_session_state(session_id)
        device = state["device_state"]
        
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
        c_type, prop, expected = condition.get("type"), condition.get("property"), condition.get("value")
        if c_type == "stateChange": return str(self.get_state_value(session_id, prop)) == str(expected)
        if c_type == "event": return self.get_session_state(session_id)["device_state"].get("lastEvent") == condition.get("eventName")
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
            if "onComplete" in step: asyncio.create_task(self.run_on_complete_actions(session_id, step["onComplete"]))
            if state["current_step"] >= len(steps):
                state["is_complete"] = True
                await self.manager.broadcast({"type": "scenario", "action": "complete", "scenario_id": scenario["id"]}, session_id)
            else:
                await self.manager.broadcast({"type": "scenario", "action": "advance", "step": state["current_step"], "scenario_id": scenario["id"]}, session_id)

    async def run_on_complete_actions(self, session_id: str, actions: List[Dict[str, Any]]):
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
            elif key == "heartRate": await self.manager.broadcast({"type": "ecg", "bpm": val}, session_id)
            elif key == "spo2": await self.manager.broadcast({"type": "ecg", "spo2": val}, session_id)
            elif key == "co2": await self.manager.broadcast({"type": "co2", "co2": val}, session_id)
            elif key == "bloodPressure": await self.manager.broadcast({"type": "pressure", "systolic": val.get("systolic"), "diastolic": val.get("diastolic")}, session_id)
            elif key == "respiratoryRate": await self.manager.broadcast({"type": "respiration", "respirationRate": val}, session_id)

    async def send_current_state(self, websocket: WebSocket, session_id: str):
        state = self.get_session_state(session_id)
        patient = state["patient_state"]
        device = state["device_state"]
        
        # Send current patient vitals
        await websocket.send_json({"type": "rhythm", "rhythm": patient["rhythmType"]})
        await websocket.send_json({"type": "ecg", "bpm": patient["heartRate"], "spo2": patient["spo2"]})
        await websocket.send_json({"type": "co2", "co2": patient["co2"]})
        await websocket.send_json({
            "type": "pressure", 
            "systolic": patient["bloodPressure"]["systolic"], 
            "diastolic": patient["bloodPressure"]["diastolic"]
        })
        await websocket.send_json({"type": "respiration", "respirationRate": patient["respiratoryRate"]})
        
        # Send current scope visibility / dotted state
        await websocket.send_json({
            "type": "visibility_state",
            "hrDotted": device.get("hrDotted", True),
            "pressureDotted": device.get("pressureDotted", True),
            "co2Dotted": device.get("co2Dotted", True)
        })
        
        # Send current defibrillator display mode / device state
        await websocket.send_json({
            "type": "defibrillator_action",
            "action": "set_display_mode",
            "display_mode": device["displayMode"]
        })
        await websocket.send_json({
            "type": "defibrillator_action",
            "action": "set_energy",
            "energy": device["manualEnergy"]
        })
        await websocket.send_json({
            "type": "defibrillator_action",
            "action": "toggle_pacing",
            "is_pacing": device["isPacing"]
        })
        await websocket.send_json({
            "type": "defibrillator_action",
            "action": "set_pacer_frequency",
            "frequency": device["pacerFrequency"]
        })
        await websocket.send_json({
            "type": "defibrillator_action",
            "action": "set_pacer_intensity",
            "intensity": device["pacerIntensity"]
        })
        await websocket.send_json({
            "type": "defibrillator_action",
            "action": "toggle_synchro",
            "is_synchro_mode": device["isSynchro"]
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
                if final_target in self.active_connections[session_id]:
                    for conn in self.active_connections[session_id][final_target]:
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

@asynccontextmanager
async def lifespan(app: FastAPI): yield
app = FastAPI(title="Système médical avec télécommande", lifespan=lifespan)

@app.websocket("/sessionId")
async def websocket_endpoint(websocket: WebSocket):
    query_params = websocket.query_params
    session_id, device_id = query_params.get("username", "anonymous"), query_params.get("deviceId", "unknown")
    await manager.connect(websocket, session_id, device_id)
    # Sync newly connected device with the current authoritative session state
    await scenario_engine.send_current_state(websocket, session_id)
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
                
                if msg_type == "defibrillator_action":
                    normalized_event = "shockDelivered" if action == "shock_delivered" else action
                    updates = {"lastEvent": normalized_event}
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
                    await scenario_engine.update_device_state(session_id, updates)

                if target: await manager.broadcast(data, session_id, target_device=target)
                elif msg_type in ["ecg", "co2", "pressure", "respiration", "rhythm", "HRscope", "Prscope", "COscope", "defibrillator_action", "visibility_state"] or action in ["shock_delivered"]:
                    if msg_type == "ecg": await scenario_engine.update_patient_state(session_id, {"heartRate": data.get("bpm"), "spo2": data.get("spo2")})
                    elif msg_type == "rhythm": await scenario_engine.update_patient_state(session_id, {"rhythmType": data.get("rhythm")})
                    elif msg_type == "co2": await scenario_engine.update_patient_state(session_id, {"co2": data.get("co2")})
                    elif msg_type == "pressure": await scenario_engine.update_patient_state(session_id, {"bloodPressure": {"systolic": data.get("systolic"), "diastolic": data.get("diastolic")}})
                    elif msg_type == "respiration": await scenario_engine.update_patient_state(session_id, {"respiratoryRate": data.get("respirationRate")})
                    elif msg_type == "HRscope": await scenario_engine.update_device_state(session_id, {"hrDotted": data.get("isHRDotted")})
                    elif msg_type == "Prscope": await scenario_engine.update_device_state(session_id, {"pressureDotted": data.get("isPressureDotted")})
                    elif msg_type == "COscope": await scenario_engine.update_device_state(session_id, {"co2Dotted": data.get("isCO2Dotted")})
                    await manager.broadcast(data, session_id)
                else:
                    await websocket.send_json(data)
                    if device_id != "remote": await manager.broadcast(data, session_id, target_device="remote")
                    if device_id != "dashboard": await manager.broadcast(data, session_id, target_device="dashboard")
            except json.JSONDecodeError: pass
    except WebSocketDisconnect: manager.disconnect(websocket, session_id, device_id)
