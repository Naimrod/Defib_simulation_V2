import json
import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse 
from scenario_manager import ScenarioManager


class ConnectionManager:
    def __init__(self): self.active_connections: dict[str, dict[str, list[WebSocket]]] = {}

    # Helper function to annouche who is in the room
    async def broadcast_device_list(self, session_id: str):
        if session_id in self.active_connections:
            # Get all the unique device IDs currently connected to this session
            device_ids = list(self.active_connections[session_id].keys())
            await self.broadcast({
                "type": "device_list_update",
                "devices": device_ids
            }, session_id=session_id)

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

        # Tell everyone a new device joined
        await self.broadcast_device_list(session_id)

    # Made this async so we can broadcast inside it
    async def disconnect(self, websocket: WebSocket, session_id: str, device_id: str):
        if session_id in self.active_connections:
            if device_id in self.active_connections[session_id]:
                if websocket in self.active_connections[session_id][device_id]:
                    self.active_connections[session_id][device_id].remove(websocket)
                    if not self.active_connections[session_id][device_id]: del self.active_connections[session_id][device_id]
            if not self.active_connections[session_id]: del self.active_connections[session_id]

            # Tell everyone a device left
            await self.broadcast_device_list(session_id)

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
                    normalized_event = action
                    if action == "shock_delivered": normalized_event = "shockDelivered"
                    elif action == "start_charge": normalized_event = "chargeStarted"
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
                    if action == "set_pacer_mode":
                        mode = data.get("mode")
                        updates["pacerMode"] = mode
                        updates["isSynchro"] = (mode == "Sentinelle")
                    if action == "toggle_synchro": updates["isSynchro"] = data.get("is_synchro_mode")
                    if action == "toggle_fc": updates["hrDotted"] = not data.get("show_fc", False)
                    if action == "toggle_vitals":
                        show_vitals = data.get("show_vitals", False)
                        updates["pressureDotted"] = not show_vitals
                        updates["co2Dotted"] = not show_vitals
                    
                    if action == "start_pni": asyncio.create_task(scenario_engine.run_pni_cycle(session_id))
                    await scenario_engine.update_device_state(session_id, device_id, updates)

                if target: await manager.broadcast(data, session_id, target_device=target)
                elif msg_type in ["ecg", "co2", "pressure", "respiration", "rhythm", "HRscope", "Prscope", "COscope", "defibrillator_action", "visibility_state", "display_mode", "live_hardware"] or action in ["shock_delivered"]:
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
                    
                    if msg_type not in ["ecg", "co2", "pressure", "respiration", "rhythm"]:
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

# --- Static Files Mounting ---
# Locate the frontend/out directory relative to this main.py file
static_dir = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "out"
)

if os.path.exists(static_dir):
    # Dynamic catch-all to route extensionless pages (e.g. /defibrillator -> defibrillator.html)
    # and serve assets (e.g. /_next/static/chunks/main.js -> frontend/out/_next/static/chunks/main.js)
    # NOTE: Any custom REST API routes (e.g. @app.get("/api/something")) should be defined ABOVE this catch-all.
    @app.get("/{path:path}")
    async def serve_static_or_page(path: str):
        # Normalize path
        path = path.strip("/")

        # 1. Root route: serve index.html
        if not path:
            return FileResponse(os.path.join(static_dir, "index.html"))

        # 2. Check if clean route matches an HTML file: e.g. /defibrillator -> defibrillator.html
        html_file = os.path.join(static_dir, f"{path}.html")
        if os.path.exists(html_file) and os.path.isfile(html_file):
            return FileResponse(html_file)

        # 3. Check if path matches an index.html in a subdirectory: e.g. /admin -> admin/index.html
        sub_dir_index = os.path.join(static_dir, path, "index.html")
        if os.path.exists(sub_dir_index) and os.path.isfile(sub_dir_index):
            return FileResponse(sub_dir_index)

        # 4. Check if exact asset exists: e.g. /favicon.ico -> favicon.ico
        exact_file = os.path.join(static_dir, path)
        if os.path.exists(exact_file) and os.path.isfile(exact_file):
            return FileResponse(exact_file)

        # 5. Fallback to 404.html if it exists
        error_404 = os.path.join(static_dir, "404.html")
        if os.path.exists(error_404):
            return FileResponse(error_404, status_code=404)

        return HTMLResponse(content="Page not found", status_code=404)
else:
    print(
        f"Warning: Static export directory '{static_dir}' was not found. Please build the frontend first."
    )
