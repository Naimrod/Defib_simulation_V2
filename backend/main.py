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
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Sends a JSON envelope to the frontend"""
        for connection in self.active_connections:
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
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Receive JSON data from frontend
            client_data = await websocket.receive_text()
            print(f"Received from frontend: {client_data}")
            
            try:
                # Parse the incoming JSON message
                data = json.loads(client_data)
                
                # Log the message type and content
                message_type = data.get("type", "unknown")
                print(f"Message type: {message_type}")
                
                # Process different message types
                if message_type == "ecg":
                    bpm = data.get("bpm")
                    spo2 = data.get("spo2")
                    print(f"ECG Data - BPM: {bpm}, SpO2: {spo2}")
                    # Broadcast to all connected clients
                    await manager.broadcast(data)

                elif message_type == "co2":
                    co2_level = data.get("co2")
                    print(f"CO2 Data - Level: {co2_level} mmHg")
                    await manager.broadcast(data)
                    
                elif message_type == "pressure":
                    systolic = data.get("systolic")
                    diastolic = data.get("diastolic")
                    print(f"Pressure Data - Systolic: {systolic}, Diastolic: {diastolic}")
                    await manager.broadcast(data)
                    
                elif message_type == "respiration":
                    resp_rate = data.get("respirationRate")
                    print(f"Respiration Data - Rate: {resp_rate}")
                    await manager.broadcast(data)
                    
                elif message_type == "rhythm":
                    rhythm = data.get("rhythm")
                    rhythm_label = data.get("rhythmLabel")
                    print(f"Rhythm Data - {rhythm_label} ({rhythm})")
                    await manager.broadcast(data)
                    
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
                    "message": "Invalid JSON format"
                }
                await websocket.send_json(error_response)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Frontend disconnected. The single connection dropped.")
