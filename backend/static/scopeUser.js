
////////////////////////////////////////////////////////
// ----- WEBSOCKET AND USER MANAGEMENT CODE BELOW -----
////////////////////////////////////////////////////////
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
    
    // WebSocket connection to receive data from backend via device_channel
    const device_channel = new WebSocket(`ws://127.0.0.1:8000/device_channel?username=${encodeURIComponent(username)}`);
    
    // Store for parsed vital signs
    const vitals = {
        bpm: 80,
        spo2: 98,
        co2: 40,
        systolic: 120,
        diastolic: 80,
        resp: 30,
        pouls : 80
    };
    
    device_channel.onopen = function() {
        console.log("Scope connected to device_channel");
    };
    
    device_channel.onmessage = function(event) {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch (e) {
            console.error("Failed to parse message:", event.data);
            return;
        }
        
        console.log("Received data:", data);
        
        // Handle ECG data (BPM and SpO2)
        if (data.type === "ecg" || (data.dataType === "sensor" && (data.bpm !== undefined || data.spo2 !== undefined))) {
            if (data.bpm !== undefined && data.bpm !== null) {
                vitals.bpm = data.bpm;
                updateDisplay('heartrate_value', vitals.bpm);
                updateDisplay('pouls_value', vitals.bpm);
            }
            if (data.spo2 !== undefined && data.spo2 !== null) {
                vitals.spo2 = data.spo2;
                updateDisplay('spo2_value', vitals.spo2 + '%');
            }
        }
        
        // Handle CO2 data
        if (data.type === "co2" || (data.dataType === "sensor" && data.co2 !== undefined)) {
            if (data.co2 !== undefined && data.co2 !== null) {
                vitals.co2 = data.co2;
                updateDisplay('co2_value', vitals.co2);
            }
        }

        // Handle Pressure data
        if (data.type === "pressure" || (data.dataType === "sensor" && (data.systolic !== undefined || data.diastolic !== undefined))) {
            if (data.systolic !== undefined && data.systolic !== null) {
                vitals.systolic = data.systolic;
            }
            if (data.diastolic !== undefined && data.diastolic !== null) {
                vitals.diastolic = data.diastolic;
            }
            updateDisplay('pressure_value', vitals.systolic + '/' + vitals.diastolic);
        }
        
        // Handle Respiration data
        if (data.type === "respiration" || (data.dataType === "sensor" && data.respirationRate !== undefined)) {
            if (data.respirationRate !== undefined && data.respirationRate !== null) {
                vitals.resp = data.respirationRate;
                updateDisplay('resp_value', vitals.resp);
            }
        }
        
        // Handle Rhythm data (if applicable)
        if (data.type === "rhythm" || (data.dataType === "sensor" && data.rhythm !== undefined)) {
            console.log("Rhythm update:", data.rhythmLabel || data.rhythm);
            if (data.rhythm === 'arret' || (data.rhythm === 'asysto')){
                vitals.bpm = 0
                updateDisplay('heartrate_value', vitals.bpm)
                updateDisplay('pouls_value', vitals.bpm)
            } else if (data.rhythm === 'fv' || (data.rhythm === 'fib_a')){
                updateDisplay('pouls_value', 0)
            }
        }
    };  
    
    device_channel.onerror = function(error) {
        console.error("WebSocket error:", error);
    };
    
    device_channel.onclose = function() {
        console.log("Disconnected from device_channel");
    };
    
    function updateDisplay(elementId, value) {
        const element = document.getElementById(elementId);
        if (element && element.dataset.hidden === 'false') {
            element.textContent = value;
            // Update stored original value for toggle functionality
            element.dataset.originalValue = value;
        }
    }
    
    document.addEventListener('DOMContentLoaded', function() {
        // Store original values for each graph_value and value
        const graphValues = document.querySelectorAll('.graph_value, .value');
        graphValues.forEach(element => {
            element.dataset.originalValue = element.textContent;
            element.dataset.hidden = 'false';
            element.addEventListener('click', function(e) {
                e.stopPropagation();
                if (this.dataset.hidden === 'false') {
                    this.textContent = '--';
                    this.dataset.hidden = 'true';
                } else {
                    this.textContent = this.dataset.originalValue;
                    this.dataset.hidden = 'false';
                }
            });
        });
    });
    
    function check() {
        console.log("Clicked on heart rate graph!");
    }