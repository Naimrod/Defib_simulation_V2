let vitalSignsData = {};

let SINUS_MOTIFS, PACING_MOTIFS, BAV1_MOTIFS, BAV3_MOTIFS, CHOC_MOTIFS;
let ECG_RHYTHMS_STATIC;

fetch("../../static/vitalSignsData.json")
  .then(r => r.json())
  .then(data => {
    vitalSignsData = data;

    SINUS_MOTIFS  = [data.motifs.sinusMotif1, data.motifs.sinusMotif2];
    PACING_MOTIFS = [data.motifs.pacingMotif1];
    BAV1_MOTIFS   = [data.motifs.bav1Motifs];
    BAV3_MOTIFS   = [data.motifs.bav3Motifs];
    CHOC_MOTIFS   = [data.motifs.chocMotifs];

    ECG_RHYTHMS_STATIC = {
      sinusRhythm:               { data: data.staticRhythms.sinusRhythm.data },
      fibrillationVentriculaire: { data: data.staticRhythms.fibrillationVentriculaire.data },
      tachycardieVentriculaire:  { data: data.staticRhythms.tachycardieVentriculaire.data },
      asystole:                  { data: data.staticRhythms.asystole.data },
      fibrillationAtriale:       { data: data.staticRhythms.fibrillationAtriale.data },
      bav1:                      { data: data.staticRhythms.bav1.data },
      bav3:                      { data: data.staticRhythms.bav3.data },
    };

    ReactDOM.createRoot(document.getElementById('ecg-container')).render(<App />);
    ReactDOM.createRoot(document.getElementById('pleth-container')).render(<App2 />);
    ReactDOM.createRoot(document.getElementById('co2-container')).render(<App3 />);
    ReactDOM.createRoot(document.getElementById('big_alerts')).render(<AlarmBanner />);
  });




const { useRef, useEffect, useState } = React;

// ── Stub audio (remplace AudioContext React) ──────────────────────────────
// Utilise l'API WebAudio du navigateur directement
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function useAudio() {
    const beepIntervalRef = useRef(null);
    const alarmIntervalRef = useRef(null);

    function playBeep(frequency = 880, duration = 80, volume = 0.3) {
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = frequency;
            gain.gain.setValueAtTime(volume, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration / 1000);
            osc.start();
            osc.stop(audioCtx.currentTime + duration / 1000);
        } catch(e) {}
    }

    return {
        playFCBeep: () => playBeep(880, 80, 0.2),
        stopFCBeepSequence: () => {
            if (beepIntervalRef.current) { clearInterval(beepIntervalRef.current); beepIntervalRef.current = null; }
        },
        startFCBeepSequenceForHR: (hr) => {
            if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
            const ms = Math.max(350, Math.min(3000, 60000 / hr));
            playBeep(880, 80, 0.2);
            beepIntervalRef.current = setInterval(() => playBeep(880, 80, 0.2), ms);
        },
        startFVAlarmSequence: () => {
            if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
            const alarm = () => { playBeep(440, 200, 0.4); setTimeout(() => playBeep(550, 200, 0.4), 250); };
            alarm();
            alarmIntervalRef.current = setInterval(alarm, 1500);
        },
        stopFVAlarmSequence: () => {
            if (alarmIntervalRef.current) { clearInterval(alarmIntervalRef.current); alarmIntervalRef.current = null; }
        },
    };
}

// Determine if we should use ws:// or wss:// (secure)
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

// Get the current hostname (e.g., 'localhost' or '192.168.8.4')
const hostName = window.location.hostname;

// Build the dynamic URL, assuming the backend is always on port 8000
const wsUrl = `${wsProtocol}//${hostName}:8000/device_channel?username=${encodeURIComponent(username)}`;

    // ── helpers shared with ECGRhythms logic ──────────────────────────────

    function generateRampedNoise(length, amplitude, startValue, endValue) {
        const out = [];
        if (length <= 0) return out;
        if (length === 1) { out.push(startValue * amplitude); return out; }
        for (let i = 0; i < length; i++) {
            const ramp = i / (length - 1);
            out.push(startValue + (endValue - startValue) * ramp * amplitude);
        }
        return out;
    }

    function genrerateArret(nSamples) {
        return Array(nSamples).fill(0)
    }

    function createSeamlessLoop(buffer, blendDurationMs, sr) {
        const blendSamples = Math.floor((blendDurationMs / 1000) * sr);
        if (buffer.length <= blendSamples) return buffer;
        const gap = buffer[0] - buffer[buffer.length - 1];
        for (let i = 0; i < blendSamples; i++) {
            const ramp = i / (blendSamples - 1);
            buffer[buffer.length - blendSamples + i] += gap * ramp;
        }
        return buffer;
    }

    function generateDynamicECG(heartRate, durationSec, sr, rhythmType) {
        const totalSamples = durationSec * sr;
        const buffer = new Array(totalSamples).fill(0);
        // Retourner une ligne plate si heartRate invalide ou arrêt cardiaque
        if (!heartRate || heartRate <= 0 || rhythmType === 'arret') return buffer;
        let MOTIFS;
        switch (rhythmType) {
            case 'sinus':          MOTIFS = SINUS_MOTIFS; break;
            case 'bav1':           MOTIFS = BAV1_MOTIFS; break;
            case 'bav3':           MOTIFS = BAV3_MOTIFS; break;
            case 'electroEntrainement': MOTIFS = PACING_MOTIFS; break;
            case 'choc' :          MOTIFS = CHOC_MOTIFS; break
            default:               MOTIFS = SINUS_MOTIFS; break;
        }
        let lastEnd = MOTIFS[0][MOTIFS[0].length - 1];
        let currentIndex = 0;
        while (currentIndex < totalSamples) {            
            const rrSamples = Math.round((60 / heartRate) * (1 + (Math.random() - 0.5) * 0.1) * sr);
            const motif = MOTIFS[Math.floor(Math.random() * MOTIFS.length)];
            const paddingLen = rhythmType === "choc" ? 0 : rrSamples - motif.length;
            if (paddingLen > 0) {
                const pad = generateRampedNoise(paddingLen, 0.03, lastEnd, motif[0]);
                for (let i = 0; i < paddingLen && currentIndex + i < totalSamples; i++)
                    buffer[currentIndex + i] = pad[i];
            }
            const start = currentIndex + paddingLen;
            for (let i = 0; i < motif.length && start + i < totalSamples; i++)
                buffer[start + i] = motif[i];
            lastEnd = motif[motif.length - 1];
            currentIndex += rrSamples;
        }
        return buffer;
    }
    function getRhythmData(rhythmType, heartRate) {
        const dur = 10, sr = 250;
        const n = dur * sr;
        if (rhythmType === 'arret' || !heartRate || heartRate <= 0) {
            return new Array(n).fill(0);
        }
        switch (rhythmType) {
            case 'sinus':
                return createSeamlessLoop(generateDynamicECG(heartRate, dur, sr, 'sinus'), 100, sr);
            case 'tachycardieVentriculaire':
                return createSeamlessLoop( ECG_RHYTHMS_STATIC.tachycardieVentriculaire.data, 200, sr);
            case 'fibrillationVentriculaire':
                return createSeamlessLoop(ECG_RHYTHMS_STATIC.fibrillationVentriculaire.data, 200, sr);
            case 'asystole':
                return createSeamlessLoop(ECG_RHYTHMS_STATIC.asystole.data, 200, sr);
            case 'fibrillationAtriale':
                return createSeamlessLoop(ECG_RHYTHMS_STATIC.fibrillationAtriale.data, 200, sr);
            case 'bav1':
                return createSeamlessLoop(generateDynamicECG(heartRate, dur, sr, 'bav1'), 200, sr);
            case 'bav3':
                return createSeamlessLoop(generateDynamicECG(heartRate, dur, sr, 'bav3'), 200, sr);
            case 'electroEntrainement':
                return createSeamlessLoop(generateDynamicECG(heartRate, dur, sr, 'electroEntrainement'), 100, sr);
            case 'choc':
                return createSeamlessLoop(generateDynamicECG(200,dur, sr,rhythmType ), 100, sr);
            default:
                return createSeamlessLoop(generateDynamicECG(heartRate, dur, sr, 'sinus'), 100, sr);
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // ECGDisplay  (ported from ECGDisplay.tsx)
    // ──────────────────────────────────────────────────────────────────────

    function ECGDisplay({
        width = 800,
        height = 65,
        rhythmType = "sinus",
        showSynchroArrows = false,
        heartRate = 70,
        durationSeconds = 10,
        isDottedAsystole = false,
        isPacing = false,
        isFlatLine = false,
        pacerFrequency = 70,
        pacerIntensity = 30,
    }) {
        const canvasRef = useRef(null);
        const animationRef = useRef(0);
        const isFlatLineRef = useRef(isFlatLine);
        isFlatLineRef.current = isFlatLine;

        const dataRef = useRef([]);
        const peakCandidateIndicesRef = useRef(new Set());
        const pacingSpikeIndicesRef = useRef(new Set());
        const normalizationRef = useRef({ min: 0, max: 1 });
        const scanAccumulatorRef = useRef(0);
        const lastFrameTimeRef = useRef(0);
        const lastYRef = useRef(null);

        const propsRef = useRef({ showSynchroArrows, durationSeconds, rhythmType, heartRate, isDottedAsystole, isPacing, pacerFrequency, pacerIntensity });
        useEffect(() => {
            propsRef.current = { showSynchroArrows, durationSeconds, rhythmType, heartRate, isDottedAsystole, isPacing, pacerFrequency, pacerIntensity };
        });

         // Effect for Data Loading and Peak/Spike Pre-computation.
        useEffect(() => {
        const { rhythmType, heartRate, isPacing, pacerFrequency, pacerIntensity } = propsRef.current;

        const SAMPLING_RATE = 250;
        const CAPTURE_THRESHOLD = 90;

        let newBuffer;
        const newPeakCandidates = new Set();
        const newPacingSpikes = new Set();

        if (isPacing) {
            if (pacerIntensity >= CAPTURE_THRESHOLD) {
                newBuffer = getRhythmData('electroEntrainement', pacerFrequency);
                for (let i = 1; i < newBuffer.length; i++) {
                    if (newBuffer[i] - newBuffer[i - 1] >= 0.4) {
                        newPacingSpikes.add(i);
                    }
                }
        } else {
        newBuffer = getRhythmData('bav3', heartRate);

        const spikeIntervalSamples = (60 / pacerFrequency) * SAMPLING_RATE;
        const totalSamples = newBuffer.length;
        const numSpikes = Math.floor(totalSamples / spikeIntervalSamples);

        for (let n = 1; n <= numSpikes; n++) {
            const spikeIndex = Math.floor(n * spikeIntervalSamples);
            if (spikeIndex < totalSamples) {
                newPacingSpikes.add(spikeIndex);
            }
        }
    }
            } else {
                newBuffer = getRhythmData(rhythmType, heartRate);

                const excludedRhythms = ['fibrillationVentriculaire', 'asystole'];
                if (!excludedRhythms.includes(rhythmType)) {
                    const refractoryPeriodSamples = 38;
                    const derivativeThreshold = 0.1;

                    for (let i = 1; i < newBuffer.length; i++) {
                        const diff = newBuffer[i] - newBuffer[i - 1];
                        if (Math.abs(diff) > derivativeThreshold) {
                            let peakIndex = i;
                            let peakValue = newBuffer[i];
                            const searchWindow = 15;
                            for (let j = 1; j < searchWindow && (i + j) < newBuffer.length; j++) {
                                if (newBuffer[i + j] > peakValue) {
                                    peakValue = newBuffer[i + j];
                                    peakIndex = i + j;
                                }
                            }
                            newPeakCandidates.add(peakIndex);
                            i = peakIndex + refractoryPeriodSamples;
                        }
                    }
            }
        }

    dataRef.current = newBuffer;
    peakCandidateIndicesRef.current = newPeakCandidates;
    pacingSpikeIndicesRef.current = newPacingSpikes;
    normalizationRef.current = {
      min: Math.min(...newBuffer),
      max: Math.max(...newBuffer),
    };


    }, [rhythmType, heartRate, isPacing, pacerFrequency, pacerIntensity]);


        // Effect for Animation and Drawing.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        scanAccumulatorRef.current = 0;
        lastFrameTimeRef.current = 0;
        lastYRef.current = null;

        const getNormalizedY = (value) => {
        const { min, max } = normalizationRef.current;
        const range = max - min;
        const topMargin = height * 0.3;
        const bottomMargin = height * 0.1;
        const traceHeight = height - topMargin - bottomMargin;
        const normalizedValue = range === 0 ? 0.5 : (value - min) / range;
        const canvasCenter = topMargin + traceHeight / 2;
        const { rhythmType, isPacing } = propsRef.current;
            if (rhythmType === 'electroEntrainement' || rhythmType === 'choc' || isPacing) {
                const gain = 40;
                return (canvasCenter - (value * gain)) / 0.6;
            } else {
                return topMargin + (1 - normalizedValue) * traceHeight;
            }
        };

        const drawGridColumn = (x) => {
            const pixelsPerSecond = width / propsRef.current.durationSeconds;
            ctx.strokeStyle = "#002200";
            ctx.lineWidth = 0.5;
            const timeStep = pixelsPerSecond / 5;
            if (x > 0 && Math.round(x) % Math.round(timeStep) === 0) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (let y = 0; y < height; y += 10) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + 1, y);
                ctx.stroke();
            }
        };

        const drawArrow = (x) => {
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 10);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, 15);
            ctx.lineTo(x - 4, 10);
            ctx.lineTo(x + 4, 10);
            ctx.closePath();
            ctx.fill();
        };

        const drawPacingSpike = (x) => {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        };

            // Initial fill
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
        for (let x = 0; x < width; x++) {
            drawGridColumn(x);
        }
        const drawFrame = (currentTime) => {
            if (!lastFrameTimeRef.current) lastFrameTimeRef.current = currentTime;
                const deltaTime = currentTime - lastFrameTimeRef.current;
                lastFrameTimeRef.current = currentTime;

                const data = dataRef.current;
                if (data.length === 0) {
                    animationRef.current = requestAnimationFrame(drawFrame);
                    return;
                }

                const { durationSeconds, showSynchroArrows } = propsRef.current;
                const samplingRate = 250;
                const pixelsPerSecond = width / durationSeconds;
                const pixelsToAdvance = (deltaTime / 1000) * pixelsPerSecond;

                const oldAccumulator = scanAccumulatorRef.current;
                scanAccumulatorRef.current += pixelsToAdvance;

                const samplesPerPixel = (durationSeconds * samplingRate) / width;

                const oldScanX = Math.floor(oldAccumulator);
                const newScanX = Math.floor(scanAccumulatorRef.current);

                for (let currentX = oldScanX; currentX < newScanX; currentX++) {
                    const x = currentX % width;
                    const sampleIndex = Math.floor(currentX * samplesPerPixel) % data.length;

                    const barX = (x + 2) % width;
                    ctx.fillStyle = 'black';
                    ctx.fillRect(barX, 0, 3, height);
                    drawGridColumn(barX);

                    const { isDottedAsystole } = propsRef.current;

                    if (isDottedAsystole) {
                        const centerY = height / 2;
                        if (x % 4 === 0) {
                            ctx.fillStyle = "#00ff00";
                            ctx.fillRect(x, centerY - 1, 2, 2);
                        }
                        lastYRef.current = centerY;

                    } else if  (isFlatLineRef.current) {
                    const centerY = height-12;
                    ctx.strokeStyle = "#00ff00";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    if (lastYRef.current !== null && x > 0) {
                        ctx.moveTo(x - 1, centerY);
                        ctx.lineTo(x, centerY);
                    } else {
                        ctx.moveTo(x, centerY);
                        ctx.lineTo(x, centerY);
                    }
                    ctx.stroke();
                    lastYRef.current = centerY;

                    }  else {
                        const value = data[sampleIndex];
                        const currentY = getNormalizedY(value);
                        ctx.strokeStyle = "#00ff00";
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        if (lastYRef.current !== null && x > 0 && x - 1 === ((currentX - 1) % width)) {
                            ctx.moveTo(x - 1, lastYRef.current);
                            ctx.lineTo(x, currentY);
                        } else {
                            ctx.moveTo(x, currentY);
                            ctx.lineTo(x, currentY);
                        }
                        ctx.stroke();
                        lastYRef.current = currentY;
                    }

                const checkWindow = Math.ceil(samplesPerPixel);

                 // Check for synchro arrows in the window
                if (showSynchroArrows) {
                    let arrowFound = false;
                    for (let i = 0; i < checkWindow; i++) {
                        if (peakCandidateIndicesRef.current.has((sampleIndex + i) % data.length)) {
                            arrowFound = true;
                            break;
                        }
                    }
                    if (arrowFound) {
                        drawArrow(x);
                    }
                }

        // Check for pacing spikes in the window
                let spikeFound = false;
                for (let i = 0; i < checkWindow; i++) {
                    if (pacingSpikeIndicesRef.current.has((sampleIndex + i) % data.length)) {
                        spikeFound = true;
                        break;
                    }
                }
                if (spikeFound) {
                    drawPacingSpike(x);
                }
            }

            animationRef.current = requestAnimationFrame(drawFrame);
        };

        animationRef.current = requestAnimationFrame(drawFrame);
        return () => cancelAnimationFrame(animationRef.current);
    }, [width, height]);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', background: 'black', width: '100%' }}>
            <canvas 
                ref={canvasRef} 
                width={width} 
                height={height}
                style={{ width: '100%', height: `${height}px`, imageRendering: 'pixelated', display: 'block' }} 
            />
        </div>
        );
    };

    // CO2 WAVEFORM
    
    const co2Waveform = [
      0.05, 0.11, 0.11, 0.09, 0.15, 0.15, 0.09, 0.12, 0.12, 0.05,
      0.03, 0.03, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.07, 0.07,
      0.06, 0.06, 0.06, 0.01, 0.01, 0.12, 0.5, 2.01, 5.87, 11.89,
      18.52, 25.04, 30.55, 33.63, 34.63, 34.85, 34.95, 35.0, 35.15, 35.23,
      35.38, 35.49, 35.5, 35.52, 35.57, 35.69, 35.79, 35.86, 35.97, 36.05,
      36.06, 36.14, 36.33, 36.43, 36.49, 36.58, 36.64, 36.72, 36.73, 36.84,
      36.88, 36.89, 36.96, 37.11, 37.19, 37.35, 37.49, 37.51, 37.54, 37.68,
      37.71, 37.84, 37.83, 37.92, 37.88, 37.76, 37.1, 34.95, 30.0, 23.26,
      16.08, 9.13, 3.8, 1.12, 0.32, 0.07, 0.05, 0.07, 0.07, 0.08,
      0.06, 0.06, 0.04, 0.04, 0.01, 0.02, 0.02, 0.02, 0.02, 0.01,
      0.0, 0.0, 0.0, 0.02, 0.09, 0.1, 0.11, 0.11, 0.09, 0.02,
      0.01, 0.1, 0.1, 0.11, 0.11, 0.11, 0.06, 0.09, 0.11, 0.11,
      0.16, 0.12, 0.11, 0.18, 0.18, 0.3, 1.11, 3.67, 8.6, 15.06,
      21.71, 27.89, 32.27, 34.32, 34.84, 35.04, 35.14, 35.2, 35.23, 35.38,
      35.41, 35.46, 35.59, 35.69, 35.66, 35.75, 35.84, 35.92, 35.97, 36.11,
      36.21, 36.27, 36.35, 36.39, 36.52, 36.64, 36.66, 36.75, 36.82, 36.85,
      36.95, 37.04, 37.13, 37.26, 37.34, 37.44, 37.54, 37.55, 37.57, 37.58,
      37.58, 37.68, 37.79, 37.91, 37.92, 37.7, 36.48, 33.07, 27.03, 19.88,
      12.58, 6.24, 2.05, 0.5, 0.14, 0.09, 0.05, 0.05, 0.02, 0.03,
      0.04, 0.04, 0.05, 0.07, 0.03, 0.03, 0.03, 0.02, 0.01, 0.01
    ]
    
    
    const Co2Display = ({
      width = 800,
      height = 80,
      respirationRate = 30,
      isDotted = false,
      isFlatLine = false,
      durationSeconds = 10,
      animationState,
    }) => {
      const canvasRef = useRef(null);
      const animationRef = useRef(0);
      const lastTimeRef = useRef(performance.now());
    
      const isDottedRef = useRef(isDotted);
      isDottedRef.current = isDotted;
    
      const isFlatLineRef = useRef(isFlatLine);
      isFlatLineRef.current = isFlatLine;
    
      // Effect to clear the canvas only when its dimensions change.
      // This prevents wiping the trace when other props change.
      useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !animationState) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        
        const minValue = Math.min(...co2Waveform);
        const maxValue = Math.max(...co2Waveform);
        const range = maxValue - minValue || 1;
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);
      }, [width, height]);
    
    
      useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !animationState) return;
    
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
    
        const minValue = Math.min(...co2Waveform);
        const maxValue = Math.max(...co2Waveform);
        const range = maxValue - minValue || 1;
    
        let SAMPLING_RATE = (respirationRate/60)* 450; // adjusts reading speed
        if (SAMPLING_RATE <= 0) SAMPLING_RATE = 1; 
    
        const totalSamplesInView = durationSeconds * SAMPLING_RATE;
        const safeWidth = width > 0 ? width : 800;
        const pixelsPerSecond = safeWidth / durationSeconds;
        const stepX = safeWidth / totalSamplesInView;
    
        const drawGridColumn = (x) => {
          ctx.strokeStyle = "#001122";
          ctx.lineWidth = 0.3;
    
          if (Math.floor(x) % 50 < Math.floor(stepX * 2)) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
    
          if (Math.floor(x) % 10 < Math.floor(stepX * 2)) {
            for (let y = 0; y < height; y += 10) {
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x + 0.5, y);
              ctx.stroke();
            }
          }
        };
    
        const drawFrame = (currentTime) => {
          if (!animationState) return;
    
          const deltaTime = currentTime - lastTimeRef.current;
          const pixelsToAdvance = (deltaTime / 1000) * pixelsPerSecond;
          const samplesToAdvance = (deltaTime / 1000) * SAMPLING_RATE;

          if (pixelsToAdvance < 0.1) {
            animationRef.current = requestAnimationFrame(drawFrame);
            return;
          }
    
          const startSampleIndex = animationState.getSampleIndex();
          let lastY = animationState.getLastY();
    
          for (let i = 0; i < Math.floor(samplesToAdvance); i++) {
            const currentSampleIndex = startSampleIndex + i;
            const scanX = (currentSampleIndex % totalSamplesInView) * stepX;
    
            ctx.fillStyle = "black";
            ctx.fillRect(scanX, 0, stepX * 4, height);
            drawGridColumn(scanX);
    
            if (isFlatLineRef.current) {
              const centerY = height / 2;
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(scanX, centerY);
              ctx.lineTo(scanX + stepX, centerY);
              ctx.stroke();
              lastY = centerY;
            } else if (isDottedRef.current) {
              const centerY = height / 2;
              const dotSize = 2;
              if (currentSampleIndex % 8 === 0) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(scanX, centerY - dotSize / 2, dotSize, dotSize);
              }
              lastY = null;
            } else {
              const value = co2Waveform[currentSampleIndex % co2Waveform.length];
              const normalized = (value - minValue) / range;
              const topMargin = 5;
              const bottomMargin = 2;
              const traceHeight = height - topMargin - bottomMargin;
              const currentY = topMargin + (1 - normalized) * traceHeight;
    
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 2;
              ctx.beginPath();
    
              if (lastY !== null) {
                const prevScanX = ((currentSampleIndex - 1 + totalSamplesInView) % totalSamplesInView) * stepX;
                if (scanX > prevScanX) {
                  ctx.moveTo(prevScanX, lastY);
                  ctx.lineTo(scanX, currentY);
                  ctx.stroke();
                }
              }
              lastY = currentY;
            }
          }
    
          animationState.setLastY(lastY);
          animationState.setSampleIndex(startSampleIndex + Math.floor(samplesToAdvance));
          lastTimeRef.current = currentTime;
          animationRef.current = requestAnimationFrame(drawFrame);
        };
    
        animationRef.current = requestAnimationFrame(drawFrame);
    
        return () => {
          cancelAnimationFrame(animationRef.current);
        };
      }, [width, height, durationSeconds, animationState]);
    
     return (
        <div className="flex flex-col bg-black rounded w-full">
          <div>
            <canvas
             ref={canvasRef}
              width={width > 0 ? width : 800} // Force a minimum canvas width
              height={height}
              style={{ 
                  width: '100%', 
                  height: `${height}px`, 
                  imageRendering: 'pixelated', 
                  display: 'block' // Match ECG exactly
              }}
            />
          </div>
          <div className="text-xs font-bold text-cyan-400 text-right">
            <span>CO2</span>
          </div>
        </div>
      );
    };
    

    // PLETHHHHHHH

    const plethWaveform = [-0.08288, - 0.07007, - 0.07007, - 0.07434, - 0.07007, - 0.07861, - 0.07007, - 0.07434, - 0.07007, - 0.06367, - 0.07007, - 0.0658, - 0.07007, - 0.0658, - 0.0658, - 0.05726, - 0.06794, - 0.04445, - 0.06794, - 0.05726, - 0.04872, - 0.05726, - 0.05299, - 0.05726, - 0.05726, - 0.06153, - 0.0658, - 0.07648, - 0.07007, - 0.06153, - 0.07648, - 0.08288, - 0.08715, - 0.09569, - 0.1085, - 0.10423, - 0.11277, - 0.11704, - 0.13839, - 0.1512, - 0.14693, - 0.15975, - 0.16188, - 0.1811, - 0.16829, - 0.17256, - 0.17683, - 0.17683, - 0.19177, - 0.18537, - 0.20031, - 0.20672, - 0.20672, - 0.20885, - 0.21099, - 0.21312, - 0.21739, - 0.21526, - 0.21953, - 0.21953, - 0.21953, - 0.17256, - 0.17256, - 0.20672, - 0.14053, - 0.16829, - 0.12131, - 0.12772, - 0.04872, - 0.09142, - 0.06794, - 0.03377, - 0.08929, 0.0132, - 0.07861, - 0.0295, 0.00252, - 0.05086, 0.05803, 0.0132, 0.07512, 0.03668, 0.07725, 0.11355, 0.0922, 0.12209, 0.1349, 0.15189, 0.15188, 0.15188, 0.15187, 0.14344, 0.13703, 0.14557, 0.08793, 0.06017, 0.05803, 0.03668, 0.02387, 0.01533, - 0.00602, - 0.02096, - 0.03377, - 0.05086, - 0.03377, - 0.06153, - 0.06367, - 0.07861, - 0.10423, - 0.07648, - 0.12558, - 0.12558, - 0.12985, - 0.12985, - 0.11918, - 0.12985, - 0.12131, - 0.12131, - 0.12131, - 0.12558, - 0.12558, - 0.12131, - 0.11277, - 0.12558, - 0.12131, - 0.12772, - 0.13412, - 0.13839, - 0.14693, - 0.1512, - 0.15975, - 0.16829, - 0.18537, - 0.18964, - 0.20672, - 0.21099, - 0.20672, - 0.2238, - 0.21739, - 0.21526, - 0.23234, - 0.22807, - 0.22807, - 0.23234, - 0.24088, - 0.24515, - 0.23874, - 0.24515, - 0.25369, - 0.24942, - 0.24942, - 0.23874, - 0.22807, - 0.21312, - 0.12131, - 0.15547, - 0.08715, - 0.07007, - 0.04018, - 0.06153, - 0.01565, - 0.00585, 0.01376, 0.04309, - 0.02737, - 0.00586, 0.08579, 0.05376, 0.06871, 0.11141, 0.11995, 0.14771, 0.17333, 0.18614, 0.19255, 0.19041, 0.19468, 0.19041, 0.19041, 0.18187, 0.18187, 0.18187, 0.1349, 0.1349, 0.09647, 0.08579, 0.04949, 0.04949, - 0.0231, - 0.04872, - 0.06367, - 0.07434, - 0.08715, - 0.08715, - 0.08715, - 0.08288, - 0.08288, - 0.07861, - 0.07648, - 0.07434, - 0.07007, - 0.07861, - 0.09142, - 0.09142, - 0.09996, - 0.10423, - 0.11491, - 0.11064, - 0.13412, - 0.14266, - 0.14266, - 0.1512, - 0.17469, - 0.18537, - 0.18537, - 0.19391, - 0.19818, - 0.20885, - 0.21312, - 0.21526, - 0.21953, - 0.21953, - 0.18537, - 0.14693, - 0.11064, - 0.07434, - 0.09142, - 0.01456, - 0.05513, - 0.09356, - 0.12131, 0.04736, - 0.04658, - 0.00815, 0.10074, 0.03668, 0.00679, 0.09006, 0.12209, 0.13063, 0.15838, 0.19255, 0.20749, 0.21603, 0.21603, 0.19895, 0.20536, 0.16479, 0.15411, 0.11782, 0.10714, 0.06658, 0.04309, 0.05376, 0.02601, - 0.00175, - 0.01242, - 0.04018, - 0.03377, - 0.04658, - 0.05299, - 0.05726, - 0.06367, - 0.05726, - 0.0658, - 0.0658, - 0.06153, - 0.0594, - 0.0658, - 0.05299, - 0.04872, - 0.04445, - 0.05299, - 0.05299, - 0.0658, - 0.07434, - 0.08715, - 0.09142, - 0.10637, - 0.11491, - 0.11277, - 0.12558, - 0.13412, - 0.13412, - 0.1512, - 0.15975, - 0.17683, - 0.17896, - 0.17256, - 0.1811, - 0.20245, - 0.19391, - 0.21526, - 0.21953, - 0.23234, - 0.23661, - 0.23661, - 0.22807, - 0.1875, - 0.13412, - 0.16829, - 0.09996, - 0.10637, - 0.08715, - 0.10423, - 0.08929, - 0.01029, - 0.05726, 0.00893, 0.03668, 0.07085, 0.07085, 0.10714, 0.08152, 0.1349, 0.1776, 0.19895, 0.19468, 0.19468, 0.19682, 0.19895, 0.18187, 0.16052, 0.16052, 0.1349, 0.11141, 0.10714, 0.08366, 0.06871, 0.04522, 0.01747, 0.01106, 0.01533, 0.00252, 0.00252, - 0.0374, - 0.03741, - 0.0178, - 0.06683, - 0.06683, - 0.04723, - 0.05705, - 0.07666, - 0.07666, - 0.07861, - 0.0865, - 0.08715, - 0.08929, - 0.09569, - 0.08715, - 0.08715, - 0.08502, - 0.08715, - 0.08715, - 0.08502, - 0.08715, - 0.09142, - 0.08715, - 0.09569, - 0.10423, - 0.09569, - 0.11277, - 0.1085, - 0.13573, - 0.13839, - 0.14693, - 0.1554, - 0.16521, - 0.16522, - 0.17896, - 0.19391, - 0.19604, - 0.19818, - 0.21099, - 0.20885, - 0.21953, - 0.21526, - 0.23234, - 0.23234, - 0.22807, - 0.23403, - 0.24515, - 0.24728, - 0.24728, - 0.24389, - 0.24389, - 0.24515, - 0.22807, - 0.22166, - 0.24515, - 0.18964, - 0.13412, - 0.15547, - 0.11918, - 0.09996, - 0.04872, - 0.07007, - 0.07221, - 0.0295, - 0.06367, - 0.02737, 0.01533, 0.02814, 0.05993, 0.06972, 0.09913, 0.09913, 0.12849, 0.1349, 0.13917, 0.1776, 0.19468, 0.19895, 0.21176, 0.22457, 0.22457, 0.2203, 0.21603, 0.19703, 0.20684, 0.20684, 0.20684, 0.20683, 0.20683, 0.1776, 0.1774, 0.15198, 0.13815, 0.10928, 0.09647, 0.06658, 0.04007, 0.04006, 0.04006, 0.04986, 0.04005, 0.01063, - 0.00899, - 0.0231, - 0.00899, - 0.02861, - 0.03842, - 0.04824, - 0.04824, - 0.05513, - 0.04825, - 0.05726, - 0.07434, - 0.07007, - 0.07007, - 0.0658, - 0.0658, - 0.0658, - 0.07221, - 0.04832, - 0.04833, - 0.06153, - 0.0658, - 0.0658, - 0.07007, - 0.07007, - 0.07007, - 0.07784, - 0.07784, - 0.09356, - 0.10423, - 0.12345, - 0.13412, - 0.13412, - 0.1448, - 0.1512, - 0.16829, - 0.1662, - 0.18537, - 0.18964, - 0.19604, - 0.20245, - 0.19818, - 0.21526, - 0.21526, - 0.2238, - 0.2238, - 0.22166, - 0.22807, - 0.22807, - 0.24088, - 0.24088, - 0.24515, - 0.24515, - 0.25369, - 0.26223, - 0.26223, - 0.26009, - 0.25796, - 0.25155, - 0.22807, - 0.20031, - 0.17683, - 0.17042, - 0.14689, - 0.09783, - 0.12772, - 0.07827, - 0.03164, - 0.05726, - 0.02737, 0.01533, 0.07512, 0.04095, 0.0986, 0.15697, 0.15697, 0.11775, 0.14716, 0.16676, 0.16676, 0.18635, 0.20749, 0.22553, 0.22457, 0.20109, 0.19255, 0.16479, 0.15625, 0.14344, 0.12738, 0.11756, 0.08793, 0.07085, 0.0489, 0.02601, 0.00966, 0.00966, 0.01946, - 0.02737, - 0.0231, - 0.03591, - 0.05513, - 0.04445, - 0.04872, - 0.04872, - 0.04445, - 0.04658, - 0.04445, - 0.03804, - 0.04445, - 0.04445, - 0.04445, - 0.04445, - 0.04018, - 0.05726, - 0.05299, - 0.05726, - 0.06794, - 0.07434, - 0.08862, - 0.08864, - 0.10826, - 0.11704, - 0.12985, - 0.14053, - 0.1512, - 0.15761, - 0.1875, - 0.18964, - 0.19391, - 0.21624, - 0.21624, - 0.21526, - 0.22608, - 0.2163, - 0.23593, - 0.24575, - 0.25369, - 0.25796, - 0.26223, - 0.26223, - 0.2665, - 0.27077, - 0.2665, - 0.24088, - 0.2238, - 0.13626, - 0.17683, - 0.20666, - 0.10423, - 0.14266, - 0.02737, - 0.09783, - 0.05726, - 0.02737, - 0.02737, - 0.01883, - 0.01883, 0.0196, 0.01747, 0.05376, 0.07939, 0.08366, 0.12209, 0.17333, 0.19518, 0.20497, 0.19514, 0.18187, 0.19512, 0.17549, 0.15587, 0.12209, 0.0986, 0.07085, 0.03241, 0.04095, 0.00873, - 0.0305, 0.00872, - 0.05726, - 0.06976, - 0.08715, - 0.09921, - 0.09356, - 0.09142, - 0.09569, - 0.09996, - 0.09569, - 0.09996, - 0.09996, - 0.10423, - 0.09996, - 0.11277, - 0.15334, - 0.15547, - 0.16829, - 0.1811, - 0.1875, - 0.2073, - 0.20732, - 0.2238, - 0.2238, - 0.23661, - 0.24664, - 0.25369, - 0.25582, - 0.25796, - 0.26223, - 0.2665, - 0.2665, - 0.27077, - 0.27931, - 0.28785, - 0.28572, - 0.2468, - 0.22722, - 0.16839, - 0.19781, - 0.14881, - 0.13412, - 0.10423, - 0.13412, - 0.06794, - 0.01456, - 0.00602, - 0.04231, - 0.01029, 0.03028, 0.07939, 0.03668, 0.09623, 0.12849, 0.15411, 0.17333, 0.19468, 0.20749, 0.23311, 0.23952, 0.21817, 0.21371, 0.17447, 0.13525, 0.10581, 0.05676, 0.08617, 0.03455, 0.01533, - 0.01456, - 0.03154, - 0.04231, - 0.04445, - 0.04018, - 0.05726, - 0.04231, - 0.04872, - 0.04445, - 0.05086, - 0.05726, - 0.07648, - 0.07434, - 0.08288, - 0.08929, - 0.09569, - 0.1085, - 0.12558, - 0.12131, - 0.11918, - 0.12558, - 0.13412, - 0.15547, - 0.16829, - 0.16829, - 0.17683, - 0.17256, - 0.19604, - 0.20245, - 0.19391, - 0.19818, - 0.21099, - 0.21526, - 0.2238, - 0.2302, - 0.23447, - 0.23661, - 0.24088, - 0.24088, - 0.25155, - 0.24942, - 0.25369, - 0.26223, - 0.27077, - 0.27077, - 0.27504, - 0.26864, - 0.26009, - 0.23661, - 0.22166, - 0.18323, - 0.20672, - 0.12985, - 0.16188, - 0.09996, - 0.12558, - 0.10423, - 0.03804, - 0.06157, - 0.02523, 0.0132, 0.03241, 0.09647, 0.07085, 0.04522, 0.10928, 0.10501, 0.07939, 0.10501, 0.13444, 0.16052, 0.19324, 0.21603, 0.25019, 0.25873, 0.263, 0.263, 0.25873, 0.25873, 0.23738, 0.22457, 0.22884, 0.2029, 0.19309, 0.17347, 0.14344, 0.1413, 0.10074, 0.07085, 0.04949, 0.0196, 0.01106, 0.0132, - 0.01029, - 0.0231, - 0.01029, - 0.01456, - 0.01883, - 0.01456, - 0.01456, - 0.0231, - 0.02523, - 0.00602, - 0.00602, - 0.00602, - 0.01456, - 0.01883, - 0.01456, - 0.03377, - 0.04445, - 0.05726, - 0.06794, - 0.06794, - 0.09156, - 0.1085, - 0.12985, - 0.12558, - 0.1448, - 0.14693, - 0.14907, - 0.14693, - 0.15975, - 0.15547, - 0.17042, - 0.18537, - 0.20245, - 0.20245, - 0.20245, - 0.20672, - 0.21953, - 0.22166, - 0.22807, - 0.2238, - 0.23234, - 0.24088, - 0.24088, - 0.24088, - 0.24515, - 0.24728, - 0.25155, - 0.24942, - 0.24728, - 0.24515, - 0.25369, - 0.26223, - 0.26436, - 0.2665, - 0.26009, - 0.25369, - 0.25582, - 0.22807, - 0.22807, - 0.20458, - 0.19391, - 0.19391, - 0.16057, - 0.11277, - 0.14266, - 0.1085, - 0.07007, - 0.09996, - 0.11704, - 0.06153, - 0.07648, - 0.0231, - 0.01456, - 0.00388, - 0.05299, - 0.01029, - 0.00175, 0.02814, 0.04949, 0.06486, 0.08446, 0.10714, 0.11995, 0.11995, 0.15198, 0.16479, 0.19041, 0.14771, 0.18614, 0.19255, 0.21186, 0.23738, 0.23525, 0.24165, 0.24165, 0.24165, 0.24165, 0.24165, 0.23098, 0.22457, 0.21176, 0.19895, 0.17974, 0.15198, 0.16906, 0.13917, 0.13917, 0.11365, 0.09404, 0.06658, 0.04095, 0.04949, 0.02814, 0.00466, - 0.01029, - 0.00815, - 0.00175, - 0.02366, - 0.03804, - 0.04445, - 0.05299, - 0.04018, - 0.06153, - 0.05726, - 0.05513, - 0.07007, - 0.05299, - 0.06367, - 0.0658, - 0.0658, - 0.05513, - 0.05726, - 0.05726, - 0.06153, - 0.06367, - 0.06367, - 0.07007, - 0.05726, - 0.07007, - 0.06367, - 0.06794, - 0.08075, - 0.08288, - 0.07434, - 0.08715, - 0.09569, - 0.09569];
    
    function PlethDisplay({
    width = 800,
    height = 80,
    heartRate = 70,
    isDotted = false,
    isFlatLine = false,
    durationSeconds = 10,
}) {
    const canvasRef = useRef(null);
    const animationRef = useRef(0);
    const lastTimeRef = useRef(0);
    const scanAccumulatorRef = useRef(0);
    
    const lastYRef = useRef(null);


    
    const propsRef = useRef({ heartRate, isDotted, isFlatLine, durationSeconds });
    
    
    useEffect(() => {
        propsRef.current = { heartRate, isDotted, isFlatLine, durationSeconds };
    }, [heartRate, isDotted, isFlatLine, durationSeconds]);

    // Clear canvas ONLY when dimensions change
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);
    }, [width, height]);

    // Main animation loop
    useEffect(() => {
        const canvas = canvasRef.current;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const minValue = Math.min(...plethWaveform);
        const maxValue = Math.max(...plethWaveform);
        const range = maxValue - minValue || 1;

    
        scanAccumulatorRef.current = 0;
        lastTimeRef.current = 0;
        lastYRef.current = null;


        const drawGridColumn = (x) => {
            ctx.strokeStyle = "#001122";
            ctx.lineWidth = 0.3;
            if (Math.round(x) % 50 === 0) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            if (Math.round(x) % 10 === 0) {
                for (let y = 0; y < height; y += 10) {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + 0.5, y);
                    ctx.stroke();
                }
            }
        };

        const drawFrame = (currentTime) => {
            if (!lastTimeRef.current) lastTimeRef.current = currentTime;
            const deltaTime = currentTime - lastTimeRef.current;
            lastTimeRef.current = currentTime;

            const currentProps = propsRef.current;

            const pixelsPerSecond = width / currentProps.durationSeconds;
            const pixelsToAdvance = (deltaTime / 1000) * pixelsPerSecond;

            const oldAccumulator = scanAccumulatorRef.current;
            scanAccumulatorRef.current += pixelsToAdvance;

            const oldScanX = Math.floor(oldAccumulator);
            const newScanX = Math.floor(scanAccumulatorRef.current);

            // Calculate dynamic speed using heart rate
            const samplesPerBeat = plethWaveform.length / 10;
            const dynamicSamplingRate = samplesPerBeat * (currentProps.heartRate / 60);
            const samplesPerPixel = (currentProps.durationSeconds * dynamicSamplingRate) / width;

            let lastY = lastYRef.current;


            for (let currentX = oldScanX; currentX < newScanX; currentX++) {
                const x = currentX % width;
                const sampleIndex = Math.floor(currentX * samplesPerPixel) % plethWaveform.length;

                const barX = (x + 2) % width;
                ctx.fillStyle = 'black';
                ctx.fillRect(barX, 0, 3, height);
                drawGridColumn(barX);

                if (currentProps.isFlatLine) {
                    const centerY = height / 2;
                    ctx.strokeStyle = "#ffff00";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    if (lastY !== null && x > 0 && x - 1 === ((currentX - 1) % width)) {
                        ctx.moveTo(x - 1, lastY);
                        ctx.lineTo(x, centerY);
                    } else {
                        ctx.moveTo(x, centerY);
                        ctx.lineTo(x, centerY);
                    }
                    ctx.stroke();
                    lastY = centerY;

                } else if (currentProps.isDotted) {
                    const centerY = height / 2;
                    if (x % 4 === 0) {
                        ctx.fillStyle = "#ffff00";
                        ctx.fillRect(x, centerY - 1, 2, 2);
                    }
                    lastY = centerY;

                } else {
                    const value = plethWaveform[sampleIndex];
                    const normalized = (value - minValue) / range;
                    const topMargin = 5;
                    const bottomMargin = 2;
                    const traceHeight = height - topMargin - bottomMargin;
                    const currentY = topMargin + (1 - normalized) * traceHeight;

                    ctx.strokeStyle = "#ffff00";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    
                    if (lastY !== null && x > 0 && x - 1 === ((currentX - 1) % width)) {
                        ctx.moveTo(x - 1, lastY);
                        ctx.lineTo(x, currentY);
                    } else {
                        ctx.moveTo(x, currentY);
                        ctx.lineTo(x, currentY);
                    }
                    ctx.stroke();
                    lastY = currentY;
                }
            }

            lastYRef.current = lastY;
            animationRef.current = requestAnimationFrame(drawFrame);
        };

        animationRef.current = requestAnimationFrame(drawFrame);

        return () => cancelAnimationFrame(animationRef.current);
        
    }, [width, height]); 

    return (
        <div className="flex flex-col bg-black rounded w-full">
            <div>
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    className="w-full"
                    style={{
                        imageRendering: "pixelated",
                        display: "block",
                        height: `${height}px`,
                    }}
                />
            </div>
            <div className="text-xs font-bold text-yellow-400 text-right">
                <span>Pleth</span>
            </div>
        </div>
    );
}

    // ──────────────────────────────────────────────────────────────────────
    // ECGWrapper: measures container width, passes it to component
    // ──────────────────────────────────────────────────────────────────────

    function ECGWrapper({ heartRate, rhythmType }) {
        const containerRef = useRef(null);
        const [canvasWidth, setCanvasWidth] = useState(800);

        useEffect(() => {
            if (!containerRef.current) return;
            const ro = new ResizeObserver(entries => {
                for (const e of entries) setCanvasWidth(Math.floor(e.contentRect.width));
            });
            ro.observe(containerRef.current);
            setCanvasWidth(containerRef.current.offsetWidth);
            return () => ro.disconnect();
        }, []);
        const isFlatLine = heartRate === 0 || rhythmType === 'arret';
        return (
            <div ref={containerRef} style={{ width: '100%' }}>
                <ECGDisplay
                width={canvasWidth}
                height={65}
                rhythmType={rhythmType}
                heartRate={heartRate}
                isFlatLine = {isFlatLine}
                durationSeconds={10}
            />
        </div>
        );
    };


    function PlethWrapper({ spo2, heartRate }) {
    const containerRef = useRef(null);
    const [canvasWidth, setCanvasWidth] = useState(800);

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(entries => {
            for (const e of entries) setCanvasWidth(Math.floor(e.contentRect.width));
        });
        ro.observe(containerRef.current);
        setCanvasWidth(containerRef.current.offsetWidth);
        return () => ro.disconnect();
    }, []);

    const isFlatLine = spo2 !== null && spo2 < 70;
    const isDotted   = spo2 === null;

    return (
        <div ref={containerRef} style={{ width: '100%' }}>
            <PlethDisplay
                width={canvasWidth}
                height={65}
                heartRate={heartRate}
                isDotted={isDotted}
                isFlatLine={isFlatLine}
                durationSeconds={10}
            />
        </div>
    );
}

    function Co2Wrapper({ co2, respirationRate }) {
        const containerRef = useRef(null);
        const [canvasWidth, setCanvasWidth] = useState(800);

        const scanXRef       = useRef(0);
        const sampleIndexRef = useRef(0);
        const lastYRef       = useRef(null);

        const animationState = {
            getScanX:       () => scanXRef.current,
            setScanX:       (v) => { scanXRef.current = v; },
            getSampleIndex: () => sampleIndexRef.current,
            setSampleIndex: (v) => { sampleIndexRef.current = v; },
            getLastY:       () => lastYRef.current,
            setLastY:       (v) => { lastYRef.current = v; },
        };

        useEffect(() => {
                if (!containerRef.current) return;
                const ro = new ResizeObserver(entries => {
                for (const e of entries) setCanvasWidth(Math.floor(e.contentRect.width));
            });
            ro.observe(containerRef.current);
            setCanvasWidth(containerRef.current.offsetWidth);
            return () => ro.disconnect();
        }, []);

        const isFlatLine = co2 !== null && co2 < 2;
        const isDotted   = co2 === null;

        return (
            <div ref={containerRef} style={{ width: '100%' }}>
                <Co2Display
                    width={canvasWidth}
                    height={65}
                    isDotted={isDotted}
                    isFlatLine={isFlatLine}
                    durationSeconds={10}
                    respirationRate={respirationRate}
                    animationState={animationState}
                />
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────────────────
    // Root – listens to WebSocket vitals and drives ECG props
    // ──────────────────────────────────────────────────────────────────────

    // Mapping des clés de control.html → clés de getRhythmData
    const RHYTHM_MAP = {
        // Sinusaux & supraventriculaires → sinus
        'sinusal':    'sinus',
        'tachy_a':    'sinus',
        'tsv':        'sinus',
        'jonctionnel':'sinus',
        'flutt_a':    'sinus',
        'rs_hvg':     'sinus',
        'rs_hd':      'sinus',
        'rs_hvd':     'sinus',
        // Fibrillation atriale
        'fib_a':      'fibrillationAtriale',
        // BAV
        '1_bav':      'bav1',
        '2_bav_I':    'bav1',
        '2_bav_II':   'bav1',
        '3_bav':      'bav3',
        // Ventriculaires
        'fv':         'fibrillationVentriculaire',
        'FV':         'fibrillationVentriculaire',
        'tv_1':       'tachycardieVentriculaire',
        'tv_2':       'tachycardieVentriculaire',
        'tors':       'tachycardieVentriculaire',
        'idiov':      'tachycardieVentriculaire',
        // Stimulateurs
        'stim':       'electroEntrainement',
        'seq':        'electroEntrainement',
        'p_cap':      'electroEntrainement',
        // Arrêt cardiaque
        'arret':      'arret',
        'asysto':     'arret',
        'choc':       'choc',
    };
    function mapRhythm(raw) {
        return RHYTHM_MAP[raw] ?? 'sinus';
    }

    function App() {
        const [heartRate,  setHeartRate]  = useState(80);
        const [rhythmType, setRhythmType] = useState('sinus');


        // 1. Establish WebSocket connection to device_channel
        useEffect(() => {
            // subscribe to the same device_channel as the rest of scope.html
            const ws = new WebSocket(wsUrl);
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.bpm    != null) setHeartRate(data.bpm);
                    if (data.rhythm != null) setRhythmType(mapRhythm(data.rhythm));
                } catch (e) { /* ignore */ }
            };
            return () => ws.close();
        }, []);

        return <ECGWrapper heartRate={heartRate} rhythmType={rhythmType} />;
    }

    function App2() {
        const [spo2, setSpo2] = useState(98);
        const [heartRate,  setHeartRate]  = useState(80);

        useEffect(() => {
            const ws = new WebSocket(wsUrl);
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.bpm != null) setHeartRate(data.bpm);
                    if (data.spo2 != null) setSpo2(data.spo2);
                } catch (e) { /* ignore */ }
            };
            return () => ws.close();
        }, []);

        return <PlethWrapper spo2={spo2} heartRate={heartRate} />;
    }

    function App3() {
    const [co2, setCo2] = useState(40);
    const [respirationRate, setRespiration] = useState(30);

    useEffect(() => {
        const ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.co2 != null) setCo2(data.co2);
                if (data.respirationRate != null) setRespiration(data.respirationRate);
            } catch (e) { /* ignore */ }
        };
        return () => ws.close();
    }, []);

    return <Co2Wrapper co2={co2} respirationRate ={respirationRate}/>;
}

function useAlarms({
  rhythmType = 'sinus',
  showFCValue = false,
  clinicalHR= 0,
}) {
  const audio = useAudio();

  const [alarmState, setAlarmState] = useState({
    heartRate: clinicalHR ?? 60,
    isBlinking: false,
    showAlarmBanner: false,
  });


  const localBeepIntervalRef = useRef(null);

  
  useEffect(() => {
    const isFib = rhythmType === 'fibrillationVentriculaire' || rhythmType === 'fibrillationAtriale';
    setAlarmState(prev => ({ ...prev, isBlinking: false, showAlarmBanner: isFib }));

    if (!isFib) return;

    const blink = setInterval(() => {
      setAlarmState(prev => ({ ...prev, isBlinking: !prev.isBlinking }));
    }, 500);

    return () => clearInterval(blink);
  }, [rhythmType]);

  useEffect(() => {
    setAlarmState(prev => ({ ...prev, heartRate: Math.max(0, Math.round(clinicalHR || 0)) }));
  }, [clinicalHR]);

  // Audio : bip FC calé sur la FC clinique vs bip d’alarme
  useEffect(() => {
    if (!audio) return;

    const isAlarmableRhythm =
      rhythmType === 'fibrillationVentriculaire' ||
      rhythmType === 'fibrillationAtriale' ||
      rhythmType === 'tachycardieVentriculaire' ||
      rhythmType === 'asystole';

    const clearLocal = () => {
      if (localBeepIntervalRef.current) {
        clearInterval(localBeepIntervalRef.current);
        localBeepIntervalRef.current = null;
      }
    };

    audio.stopFCBeepSequence();
    audio.stopFVAlarmSequence();
    clearLocal();

    if (!showFCValue) {
      return () => {
        audio.stopFCBeepSequence();
        audio.stopFVAlarmSequence();
        clearLocal();
      };
    }

    if (isAlarmableRhythm) {
      audio.startFVAlarmSequence();
      return () => audio.stopFVAlarmSequence();
    }

    
    const hr = Math.max(30, Math.min(220, clinicalHR || 60));
    try { audio.playFCBeep(); } catch {}

    if (typeof audio.startFCBeepSequenceForHR === 'function') {
      audio.startFCBeepSequenceForHR(hr);
    } else {
      const intervalMs = Math.max(350, Math.min(3000, 60000 / hr)); 
      localBeepIntervalRef.current = setInterval(() => {
        try { audio.playFCBeep(); } catch {}
      }, intervalMs);
    }

    return () => {
      audio.stopFCBeepSequence();
      clearLocal();
    };
  }, [audio, rhythmType, showFCValue, clinicalHR]);

  return alarmState;

  
};

function AlarmBanner() {
    const [heartRate,  setHeartRate]  = useState(80);
    const [rhythmType, setRhythmType] = useState('sinus');
    const [showFC,     setShowFC]     = useState(true);

    useEffect(() => {
        const ws = new WebSocket(`ws://127.0.0.1:8000/device_channel?username=${encodeURIComponent(username)}`);
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.bpm    != null) setHeartRate(data.bpm);
                if (data.rhythm != null) setRhythmType(mapRhythm(data.rhythm));
            } catch(e) {}
        };
        return () => ws.close();
    }, []);

    const { isBlinking, showAlarmBanner } = useAlarms({ rhythmType, showFCValue: showFC, clinicalHR: heartRate });

    if (!showAlarmBanner) return null;

    return (
        <span style={{
            display: 'inline-block',
            padding: '2px 12px',
            backgroundColor: isBlinking ? 'red' : '#800000',
            color: '#000',
            fontWeight: 'bold',
            borderRadius: '4px',
            transition: 'background-color 0.1s',
        }}>
            ⚠ ALARME
        </span>
    );
}