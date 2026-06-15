// --- Gestion Utilisateur ---
const urlParams = new URLSearchParams(window.location.search);
let username = urlParams.get('username') || sessionStorage.getItem('username') || 'anonymous';
sessionStorage.setItem('username', username);
document.getElementById('current-username').textContent = username;

function logout() {
    sessionStorage.removeItem('username');
    window.location.href = '/';
}

// --- Gestion des Modales de Rythme ---
let currentTargetId = ''; // Garde en mémoire quel état patient on modifie

function openRythmModal(targetId) {
    currentTargetId = targetId;
    document.getElementById('rythm_modal').showModal();
}

function selectRythm(value, label) {
    if (currentTargetId) {
        // Met à jour spécifiquement le label et l'input caché de l'étape ciblée
        document.getElementById('rythm_select_' + currentTargetId).value = value;
        document.getElementById('rythm_label_' + currentTargetId).textContent = label;
    }
    document.getElementById('rythm_modal').close();
}
let stepCount = 1;
let patientStateCount = 0;

function onComplete() {
    patientStateCount++;

    const container = document.getElementById('stepsContainer');
    const targetId = 'patient_' + patientStateCount;

    const newPatientHTML = `
    <div class="step-block" style="margin-top: 20px; border-top: 2px dashed #e74c3c; padding-top: 15px;">
        <h2 style="color: #e74c3c;">Etat du patient (Conséquence)</h2>
        <label>Rythme sélectionné :</label>
        <p><strong id="rythm_label_${targetId}" style="color: #fdfdfd;">Sinusal</strong></p>
        <button type="button" onclick="openRythmModal('${targetId}')">Sélectionner un rythme</button>
        
        <input type="hidden" id="rythm_select_${targetId}" value="sinusal">

        <label>BPM (Rythme Cardiaque)</label>
        <input type="number" min="0" max="200" class="bpmInput">
    </div>`;

    container.insertAdjacentHTML('beforeend', newPatientHTML);
}

function addStep() {
    stepCount++; 
    const container = document.getElementById('stepsContainer');

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
                <option value="10">Energie à 10</option>
                <option value="15">Energie à 15</option>
                <option value="20">Energie à 20</option>
                <option value="30">Energie à 30</option>
                <option value="50">Energie à 50</option>
                <option value="70">Energie à 70</option>
                <option value="100">Energie à 100</option>
                <option value="120">Energie à 120</option>
                <option value="150">Energie à 150</option>
                <option value="170">Energie à 170</option>
                <option value="200">Energie à 200</option>
                <option value="Charge">Début de la charge</option>
                <option value="Choc">Choc délivré</option>
                </select>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', newStepHTML);
}

function sendScenario() {
    // 1. Récupération des informations générales et de l'état initial
    const scenarioId = "scenario_" + Math.floor(Math.random() * 10000); // Génère un ID unique
    const title = document.getElementById('scenarioName').value;
    const description = document.getElementById('scenarioDescription').value;
    
    const initialRhythm = document.getElementById('rythm_select_initial').value;
    const initialBpm = parseInt(document.getElementById('bpm_input_initial').value) || 0;

    // Structure de base du JSON
    const scenarioJSON = {
        id: scenarioId,
        title: title,
        description: description,
        initialState: {
            rhythmType: initialRhythm,
            heartRate: initialBpm
        },
        steps: []
    };

    // 2. Parcours dynamique du conteneur principal (Étapes + Conséquences)
    const stepsContainer = document.getElementById('stepsContainer');
    const blocks = stepsContainer.children;
    
    let currentStepIndex = 0;
    let shockCounter = 1; // Utile pour compter les chocs successifs

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        
        // On vérifie s'il s'agit d'une "Étape" (qui possède un menu déroulant conditionSelection)
        const conditionSelect = block.querySelector('.conditionSelection');
        
        if (conditionSelect) {
            // --- C'est une Étape standard ---
            const stepDesc = block.querySelector('.stepDescription').value;
            const conditionVal = conditionSelect.value;
            
            // Création de l'objet de validation selon le choix du menu déroulant
            let validationObj = {};
            if (conditionVal === "Moniteur" || conditionVal === "Manuel" || conditionVal === "DAE") {
                validationObj = { type: "stateChange", property: "displayMode", value: conditionVal };
            } else if (conditionVal === "Charge") {
                validationObj = { type: "event", eventName: "chargeStarted" };
            } else if (conditionVal === "Choc") {
                validationObj = { type: "stateChange", property: "shockCount", value: shockCounter };
                shockCounter++; // On incrémente pour le prochain choc
            } else if (parseInt(conditionVal) > 0) {
                validationObj = { type: "stateChange", property: "manualEnergy", value: conditionVal };
            }

            // Ajout de l'étape au tableau JSON
            scenarioJSON.steps.push({
                step: currentStepIndex,
                description: stepDesc,
                validation: validationObj
            });
            
            currentStepIndex++;
        } else {
            // --- C'est une Conséquence (État du patient) ---
            // On l'attache au tableau "onComplete" de l'étape précédente
            if (scenarioJSON.steps.length > 0) {
                const lastStep = scenarioJSON.steps[scenarioJSON.steps.length - 1];
                
                // Récupération des valeurs du bloc de conséquence
                const rhythmInput = block.querySelector('input[type="hidden"]').value;
                const bpmInputStr = block.querySelector('input[type="number"]').value;
                
                const payload = { rhythmType: rhythmInput };
                if (bpmInputStr !== "") {
                    payload.heartRate = parseInt(bpmInputStr);
                }

                // Initialisation du tableau onComplete s'il n'existe pas encore
                if (!lastStep.onComplete) {
                    lastStep.onComplete = [];
                }
                
                lastStep.onComplete.push({
                    action: "updateState",
                    payload: payload,
                    delay: 500 // Délai par défaut (ajustable si besoin)
                });
            }
        }
    }

    // 3. Gestion de l'étape finale (le bloc .lastStep qui est séparé dans votre HTML)
    const lastStepBlock = document.querySelector('.lastStep');
    if (lastStepBlock) {
        const lastDesc = lastStepBlock.querySelector('.stepDescription').value;
        const lastRhythm = document.getElementById('rythm_select_final').value;
        const lastBpmStr = document.getElementById('bpm_input_final').value;
        
        const payload = { rhythmType: lastRhythm };
        if (lastBpmStr !== "") {
            payload.heartRate = parseInt(lastBpmStr);
        }

        scenarioJSON.steps.push({
            step: currentStepIndex,
            description: lastDesc,
            validation: { type: "event", eventName: "scenarioEnded" }, // Condition symbolique de fin
            onComplete: [
                { action: "updateState", payload: payload, delay: 0 }
            ]
        });
    }

    // 4. Génération et téléchargement du fichier JSON
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(scenarioJSON, null, 4));
    const downloadAnchorNode = document.createElement('a');
    
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", scenarioJSON.id + ".json"); // Ex: scenario_1234.json
    
    document.body.appendChild(downloadAnchorNode); // Requis pour la compatibilité Firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}