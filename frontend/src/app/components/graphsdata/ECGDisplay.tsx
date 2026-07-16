import React, { useRef, useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  type Plugin,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, annotationPlugin);

import { getRhythmData, type RhythmType } from "./ECGRhythms";
import { useWebSocket } from "../../context/WebSocketContext";

interface ECGDisplayProps {
  width?: number;
  height?: number;
  rhythmType?: RhythmType;
  showSynchroArrows?: boolean;
  heartRate?: number;
  durationSeconds?: number;
  isDottedAsystole?: boolean;
  isPacing?: boolean;
  pacerFrequency?: number;
  pacerIntensity?: number;
}

const ECGDisplay: React.FC<ECGDisplayProps> = ({
  width = 800,
  height = 150,
  rhythmType = "sinus",
  showSynchroArrows = false,
  heartRate = 70,
  durationSeconds = 7,
  isDottedAsystole = false,
  isPacing = false,
  pacerFrequency = 70,
  pacerIntensity = 30,
}) => {
  // subscribeHardwareData pour le flux ECG binaire dédié (live hardware)
  const { getInterpolatedTime, subscribeHardwareData } = useWebSocket();
  const chartRef = useRef<ChartJS<"line">>(null);
  const displayDataRef = useRef<(number | null)[]>(new Array(width*2).fill(null));

  const chartHeight = Math.max(20, height - 15);

  // Constante choc Live
  const chocStartTimeRef = useRef<number>(0);
  const wasChocPlayingRef = useRef<boolean>(false);

  // Constantes pour les Arrows
  const rollingBufferRef = useRef<number[]>([]);
  const ROLLING_WINDOW = 180; // ~3s à 60Hz
  const isAbovePeakRef = useRef<boolean>(false);
  const peakCandidateValueRef = useRef<number>(-Infinity);
  const peakCandidateIndexRef = useRef<number>(0);
  const peakCandidatePixelYRef = useRef<number>(0);
  const peakCandidateLiveIndexRef = useRef<number>(0);
  const peakFiredRef = useRef<boolean>(false);

  // Références d'animation et de buffers de données
  const animationRef = useRef<number>(0);
  const dataRef = useRef<number[]>([]);
  const peakCandidateIndicesRef = useRef<Set<number>>(new Set());
  const pacingSpikeIndicesRef = useRef<Set<number>>(new Set());
  const normalizationRef = useRef({ min: 0, max: 1 });

  // Objet annotations gardé STABLE en référence
  const annotationsRef = useRef<Record<string, any>>({});
  
  // Position (en p cumulé) de la dernière flèche affichée, pour le cooldown
  const lastArrowPRef = useRef<number>(0);
  // Valeur normalisée précédente pour détecter un front montant en live hardware
  const prevNormalizedValueRef = useRef<number>(0);

  // Index
  const lastScanXRef = useRef<number>(0); // Curseur temporel pour la simulation
  const liveIndexRef = useRef<number>(0); // Index d'écriture séquentielle pour le Live Hardware

  // Etat d'activation du flux matériel réel
  const isLiveHardwareRef = useRef<boolean>(false);
  const [isLive, setIsLive] = useState(false);
  const liveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const parseFramesRef = useRef<(() => void) | null>(null);

  // Constantes du protocole matériel (Raspberry Pi Pico à 60Hz)
  const MESSAGE_LENGTH = 5;
  const START_BYTE = 0xC0;
  const LEAD_STATUS_OFF = 0x01;
  const byteBuffer = useRef<number[]>([]);

  // Gérer les props synchronisées pour la boucle de rendu sans déclencher de re-renders
  const propsRef = useRef({ showSynchroArrows, durationSeconds, rhythmType, heartRate, isDottedAsystole, isPacing, pacerFrequency, pacerIntensity });
  useEffect(() => {
    propsRef.current = { showSynchroArrows, durationSeconds, rhythmType, heartRate, isDottedAsystole, isPacing, pacerFrequency, pacerIntensity };
  });

  // --- FONCTION DE NORMALISATION GLOBALE ---
  const getNormalizedY = (value: number): number => {
    const { min, max } = normalizationRef.current;
    const topMargin = chartHeight * 0.25;
    const bottomMargin = chartHeight * 0.15;
    const traceHeight = chartHeight - topMargin - bottomMargin;
    const canvasCenter = topMargin + traceHeight / 2;
    const { rhythmType: currentRhythm, isPacing } = propsRef.current;

    if (currentRhythm === 'electroEntrainement' || currentRhythm === 'choc' || isPacing) {
      const gain = 40;
      return canvasCenter - value * gain;
    } else {
      const maxDeviation = Math.max(Math.abs(min), Math.abs(max));
      const gain = maxDeviation === 0 ? 1 : (traceHeight * 0.45) / maxDeviation;
      return canvasCenter - value * gain;
    }
  };

  // --- CHARGEMENT DES DONNEES DE SIMULATION (JSON) ---
  const loadJsonData = React.useCallback(() => {
    const { rhythmType, heartRate, isPacing, pacerFrequency, pacerIntensity } = propsRef.current;
    const SAMPLING_RATE = 250; // La simulation tourne nativement ) 250Hz
    const CAPTURE_THRESHOLD = 90;

    let newBuffer: number[];
    let newPeaks: number[] = [];
    const newPeakCandidates = new Set<number>();
    const newPacingSpikes = new Set<number>();

    if (isPacing) {
      if (pacerIntensity >= CAPTURE_THRESHOLD) {
        const rhythm = getRhythmData('electroEntrainement', pacerFrequency);
        newBuffer = rhythm.data;
        newPeaks = rhythm.peaks;
        for (let i = 1; i < newBuffer.length; i++) {
          if (newBuffer[i] - newBuffer[i - 1] >= 0.4) newPacingSpikes.add(i);
        }
      } else {
        const rhythm = getRhythmData('bav3', heartRate);
        newBuffer = rhythm.data;
        newPeaks = rhythm.peaks;

        const spikeIntervalSamples = (60 / pacerFrequency) * SAMPLING_RATE;
        const totalSamples = newBuffer.length;
        const numSpikes = Math.floor(totalSamples / spikeIntervalSamples);

        for (let n = 1; n <= numSpikes; n++) {
          const spikeIndex = Math.floor(n * spikeIntervalSamples);
          if (spikeIndex < totalSamples) newPacingSpikes.add(spikeIndex);
        }
      }
    } else {
      const rhythm = getRhythmData(rhythmType, heartRate);
      newBuffer = rhythm.data;
      newPeaks = rhythm.peaks;
    }

    newPeaks.forEach(p => newPeakCandidates.add(p));

    dataRef.current = newBuffer;
    peakCandidateIndicesRef.current = newPeakCandidates;
    pacingSpikeIndicesRef.current = newPacingSpikes;
    normalizationRef.current = {
      min: Math.min(...newBuffer),
      max: Math.max(...newBuffer),
    };
  }, []);

  // --- DATA LOADING (JSON) ---
  useEffect(() => {
    loadJsonData();
  }, [rhythmType, heartRate, isPacing, pacerFrequency, pacerIntensity, loadJsonData]);

  // --- TRAITEMENT ET PARSING DU FLUX LIVE HARDWARE (60Hz) ---
  useEffect(() => {
    // Normalisation identique au plotter
    const normalize = (ecg: number) => (ecg - 33000) * 1.5 / 32760 + 0.5 ;

    const parseFrames = () => {
      const buffer = byteBuffer.current;
      const chart = chartRef.current;
      if (!chart) return;

      const displayData = chart.data.datasets[0].data as (number | null)[];
      const annotations = annotationsRef.current;

      while (buffer.length >= MESSAGE_LENGTH) {
        if (buffer[0] !== START_BYTE) {
          buffer.shift(); // désynchronisé, on saute un octet
          continue;
        }

        // Validation par lookahead : s'assurer que l'octet du paquet suivant est également START_BYTE
        // (sécurité anti-bruit)
        if (buffer.length >= MESSAGE_LENGTH + 1 ) {
          if (buffer[MESSAGE_LENGTH] !== START_BYTE) {
            buffer.shift(); // Fausse alerte, on saute un octet actuel
            continue;
          }
        } else {
          break; // Plus assez de données pour valider le lookahead, on attend le prochain batch
        }

        const statusByte = buffer[1];
        const ecgHigh = buffer[2];
        const ecgLow = buffer[3];
        buffer.splice(0, MESSAGE_LENGTH);

        const isLeadOn = (statusByte !== LEAD_STATUS_OFF);
        const ecgRaw = isLeadOn ? (ecgHigh << 8) | ecgLow : 33000;
        const normalizedValue = normalize(ecgRaw);

        // Position de dessin actuelle (balayage horizontal)
        if (liveIndexRef.current >= width * 2) liveIndexRef.current -= width * 2;
        const currentIndex = liveIndexRef.current % (width*2);

        // Effacement progressif
        for (let j = 1; j <= 8; j++) {
          const clearIndex = (currentIndex + j) % (width*2);
          displayData[clearIndex] = null;
          delete annotations[`peak_${clearIndex}`];
        }

        if (propsRef.current.isDottedAsystole) { // Injection de la ligne d'asystolie
          const DASH_PERIOD = 10; // espacement total (point + trou)
          const DASH_LENGTH = 3; // épaisseur du point
          displayData[currentIndex] = (currentIndex % DASH_PERIOD) < DASH_LENGTH ? chartHeight / 2 : null;
        } else if (propsRef.current.rhythmType === 'choc') {
          // --- INJECTION DU CHOC EN MODE LIVE MATERIEL ---
          if (!wasChocPlayingRef.current) {
            chocStartTimeRef.current = performance.now();
            wasChocPlayingRef.current = true;
          }
          const elapsedSeconds = (performance.now() - chocStartTimeRef.current) / 1000;
          const shockData = dataRef.current;

          if (shockData && shockData.length > 0) {
            // Mapping temporel à 250Hz sur les données de choc
            const sampleIndex = Math.floor(elapsedSeconds * 250) % shockData.length;
            displayData[currentIndex] = getNormalizedY(shockData[sampleIndex]);
          } else {
            displayData[currentIndex] = chartHeight / 2;
          }
        } else { // Injection de la donnée
          wasChocPlayingRef.current = false;

          let pixelY = 0;
          if (isLeadOn) {
            const ecgRaw = (ecgHigh << 8) | ecgLow;
            const normalizedValue = normalize(ecgRaw);
            const topMargin = chartHeight * 0.2;
            const traceheight = chartHeight * 0.65;
            const normalizedScale = (normalizedValue - (-0.5)) / 2.0;
            pixelY = topMargin + (1 - normalizedScale) * traceheight;
          } else {
            const data = dataRef.current;
            if (data && data.length > 0) {
              const sampleIndex = liveIndexRef.current % data.length;
              pixelY = getNormalizedY(data[sampleIndex]);
            } else {
              pixelY = chartHeight / 2;
            }
          }
          displayData[currentIndex] = pixelY;

          // Gestion des flèches de synchro (si activées)
          if (propsRef.current.showSynchroArrows) {
            const ARROW_COOLDOWN_SAMPLES = 10;
            const MIN_AMPLITUDE = 1;
            const THRESHOLD_RATIO = 0.55;

            const rollingBuffer = rollingBufferRef.current;
            rollingBuffer.push(normalizedValue);
            if (rollingBuffer.length > ROLLING_WINDOW) rollingBuffer.shift();

            const sorted = [...rollingBuffer].sort((a, b) => a - b);
            const p10 = sorted[Math.floor(sorted.length * 0.1)];
            const p95 = sorted[Math.floor(sorted.length * 0.95)];
            const amplitude = p95 - p10;

            if (amplitude >= MIN_AMPLITUDE) {
              const dynamicThreshold = p10 + amplitude * THRESHOLD_RATIO;

              const fireArrow = () => {
                if (peakCandidateLiveIndexRef.current - lastArrowPRef.current >= ARROW_COOLDOWN_SAMPLES) {
                  annotations[`peak_${peakCandidateIndexRef.current}`] = {
                    type: 'line',
                    xMin: peakCandidateIndexRef.current,
                    xMax: peakCandidateIndexRef.current,
                    yMin: -10,
                    yMax: peakCandidatePixelYRef.current - 5,
                    borderColor: 'white',
                    borderWidth: 2,
                    arrowHeads: { end: { display: true, length: 5, width: 3 } },
                  };
                  lastArrowPRef.current = peakCandidateLiveIndexRef.current;
                }
              };

              if (normalizedValue >= dynamicThreshold) {
                // Excursion au-dessus du seuil en cours
                if (!isAbovePeakRef.current || normalizedValue > peakCandidateValueRef.current) {
                  isAbovePeakRef.current = true;
                  peakFiredRef.current = false;
                  peakCandidateValueRef.current = normalizedValue;
                  peakCandidateIndexRef.current = currentIndex;
                  peakCandidatePixelYRef.current = pixelY;
                  peakCandidateLiveIndexRef.current = liveIndexRef.current;
                } else if (!peakFiredRef.current && normalizedValue < prevNormalizedValueRef.current) {
                  fireArrow();
                  peakFiredRef.current = true;
                }
              } else if (isAbovePeakRef.current) {
                if (!peakFiredRef.current) fireArrow();
                isAbovePeakRef.current = false;
                peakFiredRef.current = false;
              }
            }
          }
        }
        // Mémorise la valeur constante pour la détection de front montant au prochain échantillon
        prevNormalizedValueRef.current = normalizedValue;

        liveIndexRef.current++;
      }

      // Demande de mise à jour graphique sans calculs lourds de mise en page
      chart.update('none');
    }

    parseFramesRef.current = parseFrames;

    const handleHardwareBytes = (bytes: Uint8Array) => {
      if (!isLiveHardwareRef.current) {
        isLiveHardwareRef.current = true;
        setIsLive(true);
      }

      byteBuffer.current.push(...bytes);

      // Dead Man's Switch (Signal Loss Timeout)
      if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
      liveTimeoutRef.current = setTimeout(() => {
        isLiveHardwareRef.current = false;
        setIsLive(false);
        byteBuffer.current = [];
        loadJsonData();
      }, 1000); // 1 seconde sans signal = retour en mode simulation
    };

    const unsubscribe = subscribeHardwareData(handleHardwareBytes);
    return () => {
      unsubscribe();
      if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
    }
  }, [subscribeHardwareData, width, chartHeight, loadJsonData]);

  // --- BOUCLE D'ANIMATION DE BALAYAGE POUR LE MODE SIMULATION ---
  useEffect(() => {
    const drawFrame = () => {
      const chart = chartRef.current;
      if (!chart) { animationRef.current = requestAnimationFrame(drawFrame); return; }

      // Si le matériel réel émet, on exécute l'analyse et le dessin à chaque frame d'affichage
      if (isLiveHardwareRef.current) {
        parseFramesRef.current?.();
        animationRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      const serverTime = getInterpolatedTime();
      const data = dataRef.current;
      if (data.length == 0 || serverTime === 0) {
        animationRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      const { durationSeconds, isDottedAsystole, showSynchroArrows } = propsRef.current;
      const pixelsPerSecond = width / durationSeconds;
      const samplesPerPixel = (durationSeconds * 250) / width;
      const totalPixelsPassed = serverTime * pixelsPerSecond;

      let startX = lastScanXRef.current;
      let endX = totalPixelsPassed;
      if (endX - startX > width) startX = endX - width;

      // Mutation directe du tableau interne de Chart.js (pas de re-render React)
      const displayData = chart.data.datasets[0].data as (number | null)[];
      const annotations = annotationsRef.current;

      for (let p = Math.floor(startX); p < Math.floor(endX); p++) {
        const x = p % width;
        const sampleIndex = Math.floor(p * samplesPerPixel) % data.length;

        // Zone de clearing (3px devant le curseur)
        const barX = (x + 2) % width;
        for (let i = 0; i < 3; i++) { 
          const clearX = (barX + i) % width;
          displayData[clearX] = null; 
          delete annotations[`peak_${clearX}`]; // Supprime la flèche quand le curseur passe dessus
        }

        if (isDottedAsystole) {
          const DASH_PERIOD = 10; // espacement total (point + trou)
          const DASH_LENGTH = 3; // épaisseur du point
          displayData[x] = (x % DASH_PERIOD) < DASH_LENGTH ? chartHeight / 2 : null;
        } else {
          const value = data[sampleIndex];
          const pixelY = getNormalizedY(value);
          displayData[x] = pixelY;

          // Gestion des flèches de synchro (si activées)
          if (showSynchroArrows) {
            const ARROW_COOLDOWN_PX = 8; // distance minimum (en pixels) entre 2 flèches
            const checkWindow = Math.ceil(samplesPerPixel);
            for (let i = 0; i < checkWindow; i++) {
              if (peakCandidateIndicesRef.current.has((sampleIndex + i) % data.length)) {
                if (p - lastArrowPRef.current >= ARROW_COOLDOWN_PX) {
                  annotations[`peak_${x}`] = {
                    type: 'line',
                    xMin: x,
                    xMax: x,
                    yMin: 0, // Sommet du chart
                    yMax: pixelY - 7.5, // Position du peak
                    borderColor: 'white',
                    borderWidth: 2,
                    arrowHeads: {
                      end: { display: true, length: 10, width: 6 }
                    }
                  };
                  lastArrowPRef.current = p;
                }
                break;
              }
            }
          }
        }
      }
      
      lastScanXRef.current = totalPixelsPassed;
      chart.update('none'); // Redesine sans animation ni recalcul de layout
      animationRef.current = requestAnimationFrame(drawFrame);
    };
    
    animationRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(animationRef.current);
  }, [width, chartHeight, getInterpolatedTime]);

  // --- PLUGIN GRILLE ECG & PACER SPIKES ---
  const ecgPluginRef = useRef<Plugin<"line">>({
    id: "ecgGrid",
    beforeDraw(chart) { // Dessine la grille ECG avant le tracé des données (remplace anciennement drawGridColumn)
      const { ctx, width: w, height: h } = chart;
      ctx.save();
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, w, h);

      const { durationSeconds } = propsRef.current;
      const pixelsPerSecond = w / durationSeconds;
      const timeStep = pixelsPerSecond / 5;

      for (let x = 0; x < w; x++) {
        if (Math.round(x) % Math.round(timeStep) === 0) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
      }
      for (let y = 0; y < h; y += 10) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();
    },
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const data = dataRef.current;
      if (!data.length) return;

      const { durationSeconds } = propsRef.current;
      const samplesPerPixel = (durationSeconds * 250) / chart.width;
      const displayData = chart.data.datasets[0].data as (number | null)[];

      ctx.save();
      for (let xi = 0; xi < chart.width; xi++) {
        if (displayData[xi] === null) continue;
        const sampleIndex = Math.floor(xi * samplesPerPixel) % data.length;

        if (pacingSpikeIndicesRef.current.has(sampleIndex)) {
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(xi, chartArea.top);
          ctx.lineTo(xi, chartArea.bottom);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  });

  // Labels : indices 0..width-1 (une entrée = une colonne de pixels)
  const labels = useMemo(() => Array.from({ length: isLive ? width*2 : width }, (_, i) => i), [isLive, width]);

  const chartOptions: ChartOptions<"line"> = {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    events: [], // Desactive le tracking des survoles/clics (gain de performance majeur)
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      annotation: { annotations: annotationsRef.current },
    },
    scales: {
      x: {
        type: "category",
        display: false,
        grid: { display: false },
        border: { display: false },
      },
      y: {
        type: 'linear',
        display: false,
        min: -10,
        max: chartHeight,
        reverse: true, // Inversé manuellement lors de la projection Y pour être plus clair
        grid: { display: false },
        border: { display: false },
      },
    },
    layout: { padding: 0 },
  };

  return (
    <div 
      className="flex flex-col bg-black rounded w-full"
      style={{ height: `${height}px` }}
    >
      <div
        style = {{
          width: '100%',
          height: `${chartHeight}px`,
          position: 'relative'
        }}
      >      
        <Line
          ref={chartRef}
          data={{
            labels,
            datasets: [{
              data: displayDataRef.current, // géré dynamiquement via displayData
              borderColor: "#00ff00",
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0,
              spanGaps: false,
            }],
          }}
          options={chartOptions}
          plugins={[ecgPluginRef.current]}
        />
      </div>
      <div 
        className="text-xs font-bold text-[#00ff00] text-right pr-2"
        style={{ height: '15px', lineHeight: '15px' }}
      >
        <span>II</span>
      </div>
    </div>
  );
};

export default ECGDisplay;