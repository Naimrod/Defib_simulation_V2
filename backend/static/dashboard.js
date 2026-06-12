 // Get username from URL query parameters or sessionStorage
            const urlParams = new URLSearchParams(window.location.search);
            let username = urlParams.get('username');
            
            if (!username) {
                username = sessionStorage.getItem('username');
            }
            
            if (!username) {
                username = 'anonymous';
            }
            
            // Store and display username
            sessionStorage.setItem('username', username);
            document.getElementById('current-username').textContent = username;
            
            function logout() {
                sessionStorage.removeItem('username');
                window.location.href = '/';
            }
            // Connect to device_channel to receive real-time sensor data with username parameter
            const device_channel = new WebSocket(`ws://192.168.8.4:8000/device_channel?username=${encodeURIComponent(username)}`);
            
            device_channel.onopen = function(event) {
                console.log("Dashboard connected to device_channel");
            };

            device_channel.onmessage = function(event) {
                let data;
                try {
                    data = JSON.parse(event.data);
                } catch (e) {
                    console.error("Failed to parse message:", event.data);
                    return;
                }
                
                // Filter messages by username (only process if it matches current user)
                if (data.username && data.username !== username) {
                    console.log("Ignoring message from different user:", data.username);
                    return;
                }
                console.log("Received data:", data);
                const dashboard = document.getElementById("dashboard");
                
                // Determine card ID based on data type
                let card_id, display_label, display_value;
                
                if (data.type === "ecg" || data.dataType === "sensor" && (data.bpm || data.spo2)) {
                    card_id = "card-ecg";
                    display_label = "ECG Sensor";
                    display_value = `BPM: ${data.bpm ?? "N/A"} | Spo2: ${data.spo2 ?? "N/A"}%`;
                }
                else if (data.type === "defibrillator_action") {
                    card_id = "card-defib-action";
                    display_label = "Defibrillator Action";
                    display_value = `Mode: ${data.newMode ?? data.newEnergy ?? data.targetEnergy ?? data.energy ?? "N/A"} | Action: ${data.action ?? "N/A"}`;
                } 
                else if (data.type === "pressure" || data.dataType === "sensor" && (data.systolic || data.diastolic)) {
                    card_id = "card-pressure";
                    display_label = "Blood Pressure";
                    display_value = `${data.systolic ?? "N/A"}/${data.diastolic ?? "N/A"} mmHg`;
                } else if (data.type === "co2" || data.dataType === "sensor" && data.co2) {
                    card_id = "card-co2";
                    display_label = "CO2 Level";
                    display_value = `${data.co2 ?? "N/A"} mmHg`;
                } else if (data.type === "respiration" || data.dataType === "sensor" && data.respirationRate) {
                    card_id = "card-respiration";
                    display_label = "Respiration";
                    display_value = `${data.respirationRate ?? "N/A"} breaths/min`;
                } else if (data.type === "rhythm" || data.dataType === "sensor" && data.rhythm) {
                    card_id = "card-rhythm";
                    display_label = "Cardiac Rhythm";
                    display_value = `${data.rhythmLabel ?? data.rhythm ?? "N/A"}`;
                } else if (data.type === "scenario" || data.dataType === "command" && data.scenario) {
                    card_id = "card-scenario";
                    display_label = "Active Scenario";
                    display_value = `${data.scenario ?? "N/A"}`;
                } else {
                    card_id = "card-" + (data.type ?? "unknown");
                    display_label = data.type ?? "Data";
                    display_value = JSON.stringify(data);
                }
                
                let card = document.getElementById(card_id);
                
                if (!card) {
                    card = document.createElement("div");
                    card.id = card_id;
                    card.className = "sensor-card";
                    
                    const title = document.createElement("h2");
                    title.innerText = display_label;
                    
                    const content = document.createElement("div");
                    content.id = "data-" + card_id;
                    content.className = "data";
                    
                    const status = document.createElement("div");
                    status.className = "status";
                    status.innerText = "● Live";
                    
                    card.appendChild(title);
                    card.appendChild(content);
                    card.appendChild(status);
                    dashboard.appendChild(card);
                }
                
                document.getElementById("data-" + card_id).innerText = display_value;
            };

            device_channel.onerror = function(error) {
                console.error("WebSocket error:", error);
            };

            device_channel.onclose = function(event) {
                console.log("Dashboard disconnected from device_channel");
            };