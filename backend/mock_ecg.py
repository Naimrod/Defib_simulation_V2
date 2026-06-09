import asyncio
import websockets

async def async_input(prompt_text: str):
    return await asyncio.to_thread(input, prompt_text)
# ECG Sensor Simulation

async def run_ECG():
    sensor_id = "ecg_sensor"
    # Note the 'ws://' instead of 'http://'
    uri = f"ws://127.0.0.1:8000/ws/sensor/{sensor_id}"
    
    print(f"Connecting to {uri}...")
    
    async with websockets.connect(uri) as websocket:
        print("Connected! Sending initial data...")
        
        # Send a message to the backend
        await websocket.send("BPM : " + await async_input("Enter heart rate reading (e.g., 72): ") + ", SpO2: " + await async_input("Enter SpO2 reading (e.g., 98%): "))
        
        # Stay connected and listen for any commands from the backend
        while True:
            response = await websocket.recv()
            print(f"\n[FROM SERVER]: {response}")



#Pressure Sensor Simulation

async def run_pressure():
    sensor_id = "pressure_sensor"
    uri = f"ws://127.0.0.1:8000/ws/sensor/{sensor_id}"

    print(f"Connecting to {uri}...")

    async with websockets.connect(uri) as websocket:
        print("Connected! Sending initial data...")

        # Send a message to the backend
        await websocket.send("BP : " + await async_input("Enter blood pressure reading (e.g., 120/80): "))

        # Stay connected and listen for any commands from the backend
        while True:
            response = await websocket.recv()
            print(f"\n[FROM SERVER]: {response}")

async def main():
    print("Starting all medical sensors...")
    # asyncio.gather fires off both functions at the exact same time
    await asyncio.gather(
        run_ECG(),
        run_pressure()
    )

# Run the master async function
if __name__ == "__main__":
    asyncio.run(main())