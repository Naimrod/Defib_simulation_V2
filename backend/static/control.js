// Get username from URL or sessionStorage
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

            var slider = document.getElementById("bpm_input");
        var output = document.getElementById("bpm_value");
            output.innerHTML = slider.value; // Display the default slider value

        // Update the current slider value (each time you drag the slider handle)
        slider.oninput = function() {
            output.innerHTML = this.value;
        }
        var co2_slider = document.getElementById("co2_input");
        var co2_output = document.getElementById("co2_value");
        co2_output.innerHTML = co2_slider.value; // Display the default slider value

        // Update the current slider value (each time you drag the slider handle)
        co2_slider.oninput = function() {
            co2_output.innerHTML = this.value;
        }

        var spo2_slider = document.getElementById("spo2_input");
        var spo2_output = document.getElementById("spo2_value");
        spo2_output.innerHTML = spo2_slider.value; // Display the default slider value

        // Update the current slider value (each time you drag the slider handle)
        spo2_slider.oninput = function() {
            spo2_output.innerHTML = this.value;
        }

        var systolic_slider = document.getElementById("systolic_input");
        var systolic_output = document.getElementById("systolic_value");
        systolic_output.innerHTML = systolic_slider.value; // Display the default slider value

        // Update the current slider value (each time you drag the slider handle)
        systolic_slider.oninput = function() {
            systolic_output.innerHTML = this.value;
        }

        var diastolic_slider = document.getElementById("diastolic_input");
        var diastolic_output = document.getElementById("diastolic_value");
        diastolic_output.innerHTML = diastolic_slider.value; // Display the default slider value

        // Update the current slider value (each time you drag the slider handle)
        diastolic_slider.oninput = function() {
            diastolic_output.innerHTML = this.value;
            // If diastolic is greater than systolic, update systolic to match diastolic
            if (parseInt(this.value) > parseInt(systolic_slider.value)) {
                systolic_slider.value = this.value;
                systolic_output.innerHTML = this.value;
            }
        }

        var resp_slider = document.getElementById("resp_input");
        var resp_output = document.getElementById("resp_value");
        resp_output.innerHTML = resp_slider.value; // Display the default slider value

        // Update the current slider value (each time you drag the slider handle)
        resp_slider.oninput = function() {
            resp_output.innerHTML = this.value;
        }
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

// Get the current hostname (e.g., 'localhost' or '192.168.8.4')
const hostName = window.location.hostname;

// Build the dynamic URL, assuming the backend is always on port 8000
const wsUrl = `${wsProtocol}//${hostName}:8000/device_channel?username=${encodeURIComponent(username)}`;
       
const device_channel = new WebSocket(wsUrl);

        device_channel.onopen = function(event) {
            console.log("Connected to device_channel");
        };

        device_channel.onmessage = function(event) {
            const data = JSON.parse(event.data);
            console.log("Received from server:", data);
            // Handle incoming messages from the server
            if (data.type === "status") {
                console.log("Status:", data.message);
            }
        };

        device_channel.onerror = function(error) {
            console.error("WebSocket error:", error);
        };

        device_channel.onclose = function(event) {
            console.log("Disconnected from device_channel");
        };

        // 2. Function to grab ECG inputs and send them
        function sendECG() {
            const bpm = document.getElementById("bpm_input").value;
            const spo2 = document.getElementById("spo2_input").value;
            
            if (bpm && spo2) {
                const message = {
                    type: "ecg",
                    simuType: "control_panel",
                    dataType: "sensor",
                    bpm: parseInt(bpm),
                    spo2: parseInt(spo2),
                    timestamp: new Date().toISOString()
                };
                if (device_channel.readyState === WebSocket.OPEN) {
                    device_channel.send(JSON.stringify(message));
                    console.log("ECG data sent:", message);
                } else {
                    alert("Connection to device_channel is not ready.");
                }
            } else {
                alert("Please enter both BPM and SpO2 values.");
            }
        }

        // 3. Function to grab CO2 input and send it
        function sendCO2() {
            const co2 = document.getElementById("co2_input").value;

            if (co2) {
                const message = {
                    type: "co2",
                    simuType: "control_panel",
                    dataType: "sensor",
                    co2: parseInt(co2),
                    timestamp: new Date().toISOString()
                };
                if (device_channel.readyState === WebSocket.OPEN) {
                    device_channel.send(JSON.stringify(message));
                    console.log("CO2 data sent:", message);
                } else {
                    alert("Connection to device_channel is not ready.");
                }
            } else {
                alert("Please enter a CO2 value.");
            }
        }

        // 4. Function to grab Pressure input and send it
        function sendPressure() {
            const systolic = document.getElementById("systolic_input").value;
            const diastolic = document.getElementById("diastolic_input").value;

            if (systolic && diastolic) {
                const message = {
                    type: "pressure",
                    simuType: "control_panel",
                    dataType: "sensor",
                    systolic: parseInt(systolic),
                    diastolic: parseInt(diastolic),
                    timestamp: new Date().toISOString()
                };
                if (device_channel.readyState === WebSocket.OPEN) {
                    device_channel.send(JSON.stringify(message));
                    console.log("Pressure data sent:", message);
                } else {
                    alert("Connection to device_channel is not ready.");
                }
            } else {
                alert("Please enter both Systolic and Diastolic values.");
            }
        }

        // 4. Function to grab Respiration input and send it
        function sendRespiration() {
            const resp = document.getElementById("resp_input").value;

            if (resp) {
                const message = {
                    type: "respiration",
                    simuType: "control_panel",
                    dataType: "sensor",
                    respirationRate: parseInt(resp),
                    timestamp: new Date().toISOString()
                };
                if (device_channel.readyState === WebSocket.OPEN) {
                    device_channel.send(JSON.stringify(message));
                    console.log("Respiration data sent:", message);
                } else {
                    alert("Connection to device_channel is not ready.");
                }
            } else {
                alert("Please enter a Respiration value.");
            }
        }

        // 5. Function to grab selected scenario and send it
        function sendScenario() {
            const scenario = document.getElementById("scenario_value").textContent;            
            
            if (scenario) {
                const message = {
                    type: "scenario",
                    dataType: "command",
                    simuType: "control_panel",
                    scenario: scenario,
                    timestamp: new Date().toISOString()
                };
                if (device_channel.readyState === WebSocket.OPEN) {
                    device_channel.send(JSON.stringify(message));
                    console.log("Scenario sent:", message);
                } else {
                    alert("Connection to device_channel is not ready.");
                }
            }
        }

        // 6. Function to send rhythm data
        function sendRythm() {
            const rythm = document.getElementById("rythm_select").value;
            const rythm_label = document.getElementById("rythm_label").textContent;
            const message = {
                type: "rhythm",
                dataType: "sensor",
                simuType: "control_panel",
                rhythm: rythm,
                rhythmLabel: rythm_label,
                timestamp: new Date().toISOString()
            };
            if (device_channel.readyState === WebSocket.OPEN) {
                device_channel.send(JSON.stringify(message));
                console.log("Rhythm data sent:", message);
            } else {
                alert("Connection to device_channel is not ready.");
            }
        }
            function setScenario(scenario) {
            if (scenario === "Scénario 1") {                 //Selector for scenario 1
                const bpm = 180;
                const spo2 = 0;
                const rythm = "FV";

                const ecgMessage = {
                    type: "ecg",
                    dataType: "sensor",
                    simuType: "control_panel",
                    bpm: bpm,
                    spo2: spo2,
                    timestamp: new Date().toISOString()
                };
                const rhythmMessage = {
                    type: "rhythm",
                    dataType: "sensor",
                    simuType: "control_panel",
                    rhythm: rythm,
                    rhythmLabel: "Fibrillation Ventriculaire",
                    timestamp: new Date().toISOString()
                };
                if (device_channel.readyState === WebSocket.OPEN) {
                    device_channel.send(JSON.stringify(ecgMessage));
                    device_channel.send(JSON.stringify(rhythmMessage));
                }
            } else if (scenario === "Scénario 2") {          //Selector for scenario 2
                const bpm = 180;
                const spo2 = 0;
                const rythm = "FV";

                const ecgMessage = {
                    type: "ecg",
                    dataType: "sensor",
                    simuType: "control_panel",
                    bpm: bpm,
                    spo2: spo2,
                    timestamp: new Date().toISOString()
                };
                const rhythmMessage = {
                    type: "rhythm",
                    dataType: "sensor",
                    simuType: "control_panel",
                    rhythm: rythm,
                    rhythmLabel: "Fibrillation Ventriculaire",
                    timestamp: new Date().toISOString()
                };
                if (device_channel.readyState === WebSocket.OPEN) {
                    device_channel.send(JSON.stringify(ecgMessage));
                    device_channel.send(JSON.stringify(rhythmMessage));
                }
            } else if (scenario === "Scénario 3") {          //Selector for scenario 3
                const bpm = 30;
                const spo2 = 92;
                const rythm = "3_bav";
                const systolic = 110;
                const diastolic = 80;

                const ecgMessage = {
                    type: "ecg",
                    dataType: "sensor",
                    simuType: "control_panel",
                    bpm: bpm,
                    spo2: spo2,
                    timestamp: new Date().toISOString()
                };
                const rhythmMessage = {
                    type: "rhythm",
                    dataType: "sensor",
                    simuType: "control_panel",
                    rhythm: rythm,
                    rhythmLabel: "3° BAV",
                    timestamp: new Date().toISOString()
                };
                const pressureMessage = {
                    type: "pressure",
                    dataType: "sensor",
                    simuType: "control_panel",
                    systolic: systolic,
                    diastolic: diastolic,
                    timestamp: new Date().toISOString()
                };
                if (device_channel.readyState === WebSocket.OPEN) {
                    device_channel.send(JSON.stringify(ecgMessage));
                    device_channel.send(JSON.stringify(rhythmMessage));
                    device_channel.send(JSON.stringify(pressureMessage));
                }
            } else if (scenario === "Scénario 4") {          //Selector for scenario 4
                const bpm = 160;
                const spo2 = 95;
                const rythm = "fib_a";

                const ecgMessage = {
                    type: "ecg",
                    dataType: "sensor",
                    simuType: "control_panel",
                    bpm: bpm,
                    spo2: spo2,
                    timestamp: new Date().toISOString()
                };
                const rhythmMessage = {
                    type: "rhythm",
                    dataType: "sensor",
                    simuType: "control_panel",
                    rhythm: rythm,
                    rhythmLabel: "Fibrillation Auriculaire",
                    timestamp: new Date().toISOString()
                };
                if (device_channel.readyState === WebSocket.OPEN) {
                    device_channel.send(JSON.stringify(ecgMessage));
                    device_channel.send(JSON.stringify(rhythmMessage));
                }
            } else if (scenario === "Scénario 5") {           //Selector for scenario 5
                const bpm = 170;
                const spo2 = 0;
                const rythm = "FV";

                const ecgMessage = {
                    type: "ecg",
                    dataType: "sensor",
                    simuType: "control_panel",
                    bpm: bpm,
                    spo2: spo2,
                    timestamp: new Date().toISOString()
                };
                const rhythmMessage = {
                    type: "rhythm",
                    dataType: "sensor",
                    simuType: "control_panel",
                    rhythm: rythm,
                    rhythmLabel: "Fibrillation Ventriculaire",
                    timestamp: new Date().toISOString()
                };
                if (device_channel.readyState === WebSocket.OPEN) {
                    device_channel.send(JSON.stringify(ecgMessage));
                    device_channel.send(JSON.stringify(rhythmMessage));
                }
            }
        }
            function selectRythm(value, label) {
                document.getElementById('rythm_select').value = value;
                document.getElementById('rythm_label').textContent = label;
                document.getElementById('rythm_modal').close();
            }