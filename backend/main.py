import json
import asyncio
from typing import List
from pydantic import BaseModel
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse  

scenario_clients: List[WebSocket] = []
dashboard_clients: List[WebSocket] = []

# Background task reference
sensor_task = None
class SessionData(BaseModel):
    username: str
#-------CONNECTION MANAGER-------------------------

class ConnectionManager:
    def __init__(self):
        # session_id -> { device_id -> list[WebSocket] }
        self.active_connections: dict[str, dict[str, list[WebSocket]]] = {}

    async def connect(self, websocket: WebSocket, session_id: str, device_id: str):
        await websocket.accept()
        
        if session_id not in self.active_connections:
            self.active_connections[session_id] = {}
            
        # Enforce single remote: if this is a remote, disconnect any existing ones in this session
        if device_id == "remote":
            if "remote" in self.active_connections[session_id]:
                print(f"Session '{session_id}': Disconnecting existing remote for new connection.")
                for old_ws in self.active_connections[session_id]["remote"]:
                    try:
                        await old_ws.close(code=1000, reason="Another remote connected")
                    except:
                        pass
                self.active_connections[session_id]["remote"] = []
        
        if device_id not in self.active_connections[session_id]:
            self.active_connections[session_id][device_id] = []
            
        self.active_connections[session_id][device_id].append(websocket)
        print(f"Session '{session_id}', Device '{device_id}' connected. Total devices: {len(self.active_connections[session_id])}")

    def disconnect(self, websocket: WebSocket, session_id: str, device_id: str):
        if session_id in self.active_connections:
            if device_id in self.active_connections[session_id]:
                if websocket in self.active_connections[session_id][device_id]:
                    self.active_connections[session_id][device_id].remove(websocket)
                    print(f"Session '{session_id}', Device '{device_id}' disconnected.")
                    
                    if not self.active_connections[session_id][device_id]:
                        del self.active_connections[session_id][device_id]
            
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast(self, message: dict, session_id: str = None, target_device: str = None):
        """Sends a JSON envelope. If session_id is specified, only send to that session. If target_device is specified, only send to that device type."""
        
        # Check if the message itself specifies a target
        final_target = target_device or message.get("target_device")

        if session_id:
            if session_id in self.active_connections:
                if final_target:
                    # Send ONLY to the specific target device(s) in this session
                    if final_target in self.active_connections[session_id]:
                        for connection in self.active_connections[session_id][final_target]:
                            try:
                                await connection.send_json(message)
                            except:
                                pass
                else:
                    # Send to ALL devices in session
                    for device_list in self.active_connections[session_id].values():
                        for connection in device_list:
                            try:
                                await connection.send_json(message)
                            except:
                                pass
        else:
            # Broadcast to everyone globally
            for s_id in list(self.active_connections.keys()):
                for device_list in self.active_connections[s_id].values():
                    for connection in device_list:
                        try:
                            await connection.send_json(message)
                        except:
                            pass

manager = ConnectionManager()

#-------DATA AGGREGATOR----------------------------------
async def aggregate_sensor_data():
    """
    Aggregates data from multiple sensors and sends it to the dashboard.
    """
    while True:
        # Example aggregation placeholder — replace with real sensor aggregation
        

        aggregated_data = {
            "dataType": data_type,
            "simuType": action_type,
            "value": data_value,
            "source": triggering_sensor,
        }

        await manager.broadcast(aggregated_data)
        await asyncio.sleep(1)  # Avoid busy waiting

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown"""
    global sensor_task
    # Startup
    sensor_task = asyncio.create_task(aggregate_sensor_data())
    yield
    # Shutdown
    if sensor_task:
        sensor_task.cancel()
        try:
            await sensor_task
        except asyncio.CancelledError:
            pass

app = FastAPI(title="Système médical avec télécommande", lifespan=lifespan)

# ---------------------------------------------------------
# ROUTES (Serving the external HTML files)
# ---------------------------------------------------------
@app.get("/")
async def get_root():
    """Reads 'index.html' from your folder and serves it."""
    return FileResponse("index.html")

@app.get("/loggedin")
async def get_loggedin():
    """Reads 'loggedin.html' from your folder and serves it."""
    return FileResponse("loggedin.html")

@app.get("/dashboard")
async def get_dashboard():
    """Reads 'dashboard.html' from your folder and serves it."""
    return FileResponse("dashboard.html")

@app.get("/control")
async def get_control_panel():
    """Reads 'control.html' from your folder and serves it."""
    return FileResponse("control.html")

@app.get("/scope")
async def get_scope():
    """Reads 'scope.html' from your folder and serves it."""
    return FileResponse("scope.html")

@app.post("/api/prepare_session")
async def prepare_session(data: SessionData):
    """Prepares the session for the defibrillator simulator."""
    print(f"Preparing session for user: {data.username}")
    return {"status": "success", "message": "Ready to launch"}

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/scenarioBuilder")
async def get_scenario():
    """Reads 'scenarioBuilder.html' from your folder and serves it."""
    return FileResponse("scenarioBuilder.html")
# ---------------------------------------------------------
# WEBSOCKETS
# ---------------------------------------------------------

# --- SIGNAL TRIAGE CONFIG ---
GLOBAL_PATIENT_TYPES = ["ecg", "co2", "pressure", "respiration", "rhythm", "scenario"]
GLOBAL_ACTIONS = ["shock_delivered", "rhythm_changed"]

@app.websocket("/sessionId")
async def websocket_endpoint(websocket: WebSocket):
    query_params = websocket.query_params
    session_id = query_params.get("username", "anonymous")
    device_id = query_params.get("deviceId", "unknown")

    await manager.connect(websocket, session_id, device_id)
    try:
        while True:
            client_data = await websocket.receive_text()
            try:
                data = json.loads(client_data)

                # 1. Metadata & Logging
                data["session_id"] = session_id
                data["source_device"] = device_id
                data["timestamp"] = data.get("timestamp") or asyncio.get_event_loop().time()

                print(f"[{session_id}] {device_id} -> {data.get('type')}: {data.get('action') or ''}")

                # 2. Determine Routing Logic
                msg_type = data.get("type")
                action = data.get("action")
                target = data.get("target_device")

                # ROUTE A: Targeted message (Remote -> Specific Device)
                if target:
                    await manager.broadcast(data, session_id, target_device=target)

                # ROUTE B: Global Patient Change (Sim -> Everyone / Remote -> Everyone)
                elif msg_type in GLOBAL_PATIENT_TYPES or action in GLOBAL_ACTIONS:
                    await manager.broadcast(data, session_id)

                # ROUTE C: Local Device State (Sim -> Remote/Dashboard/Self)
                else:
                    # Send back to source
                    await websocket.send_json(data)

                    # Mirror to "Observers" (Remote and Dashboard) so they can track student UI state
                    if device_id != "remote":
                        await manager.broadcast(data, session_id, target_device="remote")
                    if device_id != "dashboard":
                        await manager.broadcast(data, session_id, target_device="dashboard")

            except json.JSONDecodeError as e:
                print(f"Failed to decode JSON from {session_id}/{device_id}: {e}")

    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id, device_id)