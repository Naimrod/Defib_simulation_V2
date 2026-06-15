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

            function selectRythm(value, label) {
                document.getElementById('rythm_select').value = value;
                document.getElementById('rythm_label').textContent = label;
                document.getElementById('rythm_modal').close();
            }

            // Keep track of the step count globally
            let stepCount = 1;

            function addStep() {
            stepCount++; // Increase the counter
            const container = document.getElementById('stepsContainer');

            // Build the HTML for the new step using template literals (backticks ` `)
            const newStepHTML = `
                <div class="step-block" style="margin-top: 20px; border-top: 1px dashed #7f8c8d; padding-top: 15px;">
                    <h2>Étape ${stepCount}</h2>
                    <label>Description :</label>
                    <input type="text" class="stepDescription" name="stepDescription[]">
            
                    <label>Condition de validation :</label>
                    <select class="conditionSelection" name="conditionSelection[]">
                        <option value="">Choisissez une option</option>
                        <option value="Moniteur">Passage au mode Moniteur</option>
                        <option value="Manuel">Passage au mode Manuel</option>
                        <option value="DAE">Passage au mode DAE</option>
                    </select>
                </div>
            `;

            // Append the new step to the end of the container
            container.insertAdjacentHTML('beforeend', newStepHTML);
        }