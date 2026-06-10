import json
import asyncio
from typing import List
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse  

scenario_clients: List[WebSocket] = []
dashboard_clients: List[WebSocket] = []

# Background task reference
sensor_task = None

#-------CONNECTION MANAGER-------------------------

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}  # username -> list of websockets

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        if username not in self.active_connections:
            self.active_connections[username] = []
        self.active_connections[username].append(websocket)
        print(f"User '{username}' connected. Total sessions for {username}: {len(self.active_connections[username])}")

    def disconnect(self, websocket: WebSocket, username: str):
        if username in self.active_connections:
            if websocket in self.active_connections[username]:
                self.active_connections[username].remove(websocket)
                print(f"User '{username}' disconnected. Remaining sessions: {len(self.active_connections[username])}")
                # Clean up empty username entries
                if not self.active_connections[username]:
                    del self.active_connections[username]

    async def broadcast(self, message: dict, username: str = None):
        """Sends a JSON envelope to the frontend. If username is specified, only send to that user's sessions."""
        if username:
            # Send only to specific user's sessions
            if username in self.active_connections:
                for connection in self.active_connections[username]:
                    try:
                        await connection.send_json(message)
                    except Exception as e:
                        print(f"Error sending data to user '{username}': {e}")
        else:
            # Broadcast to all users
            for username_key, connections in self.active_connections.items():
                for connection in connections:
                    try:
                        await connection.send_json(message)
                    except Exception as e:
                        print(f"Error sending data: {e}")

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

app = FastAPI(title="Système médical avec télécommadne", lifespan=lifespan)

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

# ---------------------------------------------------------
# WEBSOCKETS
# ---------------------------------------------------------

@app.websocket("/device_channel")
async def websocket_endpoint(websocket: WebSocket, username: str = None):
    # Get username from query parameters
    query_params = websocket.query_params
    username = query_params.get("username", "anonymous")
    
    await manager.connect(websocket, username)
    try:
        while True:
            # Receive JSON data from frontend
            client_data = await websocket.receive_text()
            print(f"Received from {username}: {client_data}")
            
            try:
                # Parse the incoming JSON message
                data = json.loads(client_data)
                
                # Add username to the data for session filtering
                data["username"] = username
                
                # Log the message type and content
                message_type = data.get("type", "unknown")
                print(f"Message type: {message_type}")
                
                # Process different message types
                if message_type == "ecg":
                    bpm = data.get("bpm")
                    spo2 = data.get("spo2")
                    print(f"ECG Data from {username} - BPM: {bpm}, SpO2: {spo2}")
                    # Broadcast only to this user's sessions
                    await manager.broadcast(data, username)

                elif message_type == "co2":
                    co2_level = data.get("co2")
                    print(f"CO2 Data from {username} - Level: {co2_level} mmHg")
                    await manager.broadcast(data, username)
                    
                elif message_type == "pressure":
                    systolic = data.get("systolic")
                    diastolic = data.get("diastolic")
                    print(f"Pressure Data from {username} - Systolic: {systolic}, Diastolic: {diastolic}")
                    await manager.broadcast(data, username)
                    
                elif message_type == "respiration":
                    resp_rate = data.get("respirationRate")
                    print(f"Respiration Data from {username} - Rate: {resp_rate}")
                    await manager.broadcast(data, username)
                    
                elif message_type == "rhythm":
                    rhythm = data.get("rhythm")
                    rhythm_label = data.get("rhythmLabel")
                    print(f"Rhythm Data from {username} - {rhythm_label} ({rhythm})")
                    await manager.broadcast(data, username)
                    
                elif message_type == "scenario":
                    scenario = data.get("scenario")
                    print(f"Scenario Selected: {scenario}")
                    await manager.broadcast(data)
                    
                else:
                    print(f"Unknown message type: {message_type}")
                    
            except json.JSONDecodeError as e:
                print(f"Failed to decode JSON: {e}")
                # Send error response
                error_response = {
                    "type": "error",
                    "message": "Invalid JSON format",
                    "username": username
                }
                await websocket.send_json(error_response)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, username)
        print(f"User '{username}' disconnected.")