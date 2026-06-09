import json
from typing import List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse  # <-- Changed this import

app = FastAPI(title="Medical System with Control Panel")

dashboard_clients: List[WebSocket] = []
scenario_clients: List[WebSocket] = []

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

@app.websocket("/ws/dashboard")
async def dashboard_endpoint(websocket: WebSocket):
    await websocket.accept()
    dashboard_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        dashboard_clients.remove(websocket)

@app.websocket("/ws/sensor/{sensor_id}")
async def sensor_endpoint(websocket: WebSocket, sensor_id: str):
    await websocket.accept()
    print(f"[{sensor_id}] Connected!")
    try:
        while True:
            data = await websocket.receive_text()
            print(f"[{sensor_id}] Received: {data}")
            
            # Broadcast to dashboard
            payload = json.dumps({"sensor_id": sensor_id, "message": data})
            for client in dashboard_clients:
                await client.send_text(payload)
                
    except WebSocketDisconnect:
        print(f"[{sensor_id}] Disconnected.")

@app.websocket("/ws/scenario")
async def scenario_endpoint(websocket: WebSocket):
    await websocket.accept()
    scenario_clients.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Broadcast scenario reset to all connected dashboards
            payload = json.dumps({"type": "scenario_reset", "scenario": data})
            for client in dashboard_clients:
                await client.send_text(payload)
    except WebSocketDisconnect:
        scenario_clients.remove(websocket)