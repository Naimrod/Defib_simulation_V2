import vitalSignsData from "../../data/vitalSignsData.json";

export type RhythmType =
  | "sinus"
  | "tachycardieVentriculaire"
  | "fibrillationVentriculaire"
  | "asystole"
  | "fibrillationAtriale"
  | "bav1"
  | "bav3"
  | "electroEntrainement"
  | "choc"
  | "pacingMotif1"
  | "BAVMotif1"
  | "BAV3Motif1";

export interface ECGRhythm {
  name: string;
  data: number[];
  description: string;
}
// Pool for normal sinus beats
const sinusMotif1 = vitalSignsData.motifs.sinusMotif1;
const sinusMotif2 = vitalSignsData.motifs.sinusMotif2;
const SINUS_MOTIFS = [sinusMotif1, sinusMotif2];
//pool for pacing motifs
const pacingMotif1 = vitalSignsData.motifs.pacingMotif1;
const PACING_MOTIFS = [pacingMotif1];
//pool for BAV1 motifs
const BAV1Motif1 = vitalSignsData.motifs.bav1Motifs;
const BAV1_MOTIFS = [BAV1Motif1];
//pool for BAV3 motifs
const BAV3Motif1 = vitalSignsData.motifs.bav3Motifs;
const BAV3_MOTIFS = [BAV3Motif1];
const chocMotif1 = vitalSignsData.motifs.chocMotifs;
const CHOC_MOTIFS = [chocMotif1];

class LCG {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  // Returns pseudo-random float [0, 1)
  next(): number {
    this.seed = (1103515245 * this.seed + 12345) % 2147483648;
    return this.seed / 2147483648;
  }
}

export interface ECGData {
  data: number[];
  peaks: number[];
}

// ramped noise generator to create padding between motifs
const generateRampedNoise = (
  length: number,
  amplitude: number,
  startValue: number,
  endValue: number,
  lcg: LCG,
): number[] => {
  const baseline = [];
  if (length <= 1) {
    // Handle edge cases to avoid division by zero
    if (length === 1)
      baseline.push(startValue + (lcg.next() - 0.5) * amplitude);
    return baseline;
  }
  for (let i = 0; i < length; i++) {
    const ramp = i / (length - 1);
    const baselineValue = startValue + (endValue - startValue) * ramp;
    const noise = (lcg.next() - 0.5) * amplitude;
    baseline.push(baselineValue + noise);
  }
  return baseline;
};

// utility function that receives a buffer containing ECG data and blends the tail to create a seamless loop
const createSeamlessLoop = (
  buffer: number[],
  blendDurationMs: number,
  samplingRate: number,
): number[] => {
  const blendSamples = Math.floor((blendDurationMs / 1000) * samplingRate);
  if (buffer.length <= blendSamples) {
    return buffer; // Not enough data to blend
  }

  const startValue = buffer[0];
  const endValue = buffer[buffer.length - 1];
  const gap = startValue - endValue;

  for (let i = 0; i < blendSamples; i++) {
    const ramp = i / (blendSamples - 1); // A ramp from 0.0 to 1.0
    const index = buffer.length - blendSamples + i;
    buffer[index] += gap * ramp;
  }

  return buffer;
};

//function that creates the dynamic data buffer to display on the monitor for the sinus rhythm
//TODO: expand the logic for all configurable rhythms (TV, BAV1, BAV3)
const generateDynamicECG = (
  heartRate: number,
  durationSeconds: number,
  samplingRate: number,
  rhythmType: RhythmType,
  lcg: LCG,
): number[] => {
  const totalSamples = durationSeconds * samplingRate;
  const buffer = new Array(totalSamples).fill(0);
  
  if (heartRate <= 0) {
      return buffer; // Return flat line for zero or negative heart rate
  }

  let currentIndex = 0;
  let MOTIFS = [];
  switch (rhythmType) {
    case "sinus":
      MOTIFS = SINUS_MOTIFS;
      break;
    case "bav1":
      MOTIFS = BAV1_MOTIFS;
      break;
    case "bav3":
      MOTIFS = BAV3_MOTIFS;
      break;
    case "electroEntrainement":
      MOTIFS = PACING_MOTIFS;
      break;
    case "choc":
      MOTIFS = CHOC_MOTIFS;
      break;
    default:
      MOTIFS = SINUS_MOTIFS;
      break;
  }
  // This is the value we assume exists "before" the buffer starts, for seamless looping.
  // We'll use the end value of a typical motif.
  const finalMotif = MOTIFS[MOTIFS.length - 1];
  let lastMotifEndValue = finalMotif[finalMotif.length - 1];

  // The main loop now generates a [PADDING][MOTIF] block on each iteration.
  while (currentIndex < totalSamples) {
    const rrIntervalSeconds = 60 / heartRate;
    const variation = (lcg.next() - 0.5) * 0.1;
    const rrSamples = Math.round(
      rrIntervalSeconds * (1 + variation) * samplingRate,
    );
    
    // Safety check: if rrSamples is somehow invalid or too small, move forward by 1 sample
    if (!isFinite(rrSamples) || rrSamples <= 0) {
        currentIndex++;
        continue;
    }

    const motif = MOTIFS[Math.floor(lcg.next() * MOTIFS.length)];
    const nextMotifStartValue = motif[0];

    const paddingLength = rhythmType === "choc" ? 0 : rrSamples - motif.length;

    // 1. Generate and place PADDING first.
    if (paddingLength > 0) {
      const padding = generateRampedNoise(
        paddingLength,
        0.03,
        lastMotifEndValue,
        nextMotifStartValue,
        lcg,
      );
      for (let i = 0; i < paddingLength; i++) {
        const bufferIndex = currentIndex + i;
        if (bufferIndex < totalSamples) {
          buffer[bufferIndex] = padding[i];
        }
      }
    }

    // 2. Then place the MOTIF.
    const motifStartIndex = currentIndex + Math.max(0, paddingLength);
    for (let i = 0; i < motif.length; i++) {
      if (motifStartIndex + i < totalSamples) {
        buffer[motifStartIndex + i] = motif[i];
      }
    }

    // 3. Update state for the next iteration.
    lastMotifEndValue = motif[motif.length - 1];
    currentIndex += rrSamples;
  }

  return buffer;
};

export const detectPeaks = (buffer: number[], rhythmType: RhythmType): number[] => {
  const peaks: number[] = [];
  const excludedRhythms: RhythmType[] = ['fibrillationVentriculaire', 'asystole'];
  if (excludedRhythms.includes(rhythmType)) {
    return peaks;
  }

  const refractoryPeriodSamples = 38;
  const derivativeThreshold = 0.1;

  for (let i = 1; i < buffer.length; i++) {
    const diff = buffer[i] - buffer[i - 1];
    if (Math.abs(diff) > derivativeThreshold) {
      let peakIndex = i;
      let peakValue = buffer[i];
      const searchWindow = 15;
      for (let j = 1; j < searchWindow && (i + j) < buffer.length; j++) {
        if (buffer[i + j] > peakValue) {
          peakValue = buffer[i + j];
          peakIndex = i + j;
        }
      }
      peaks.push(peakIndex);
      i = peakIndex + refractoryPeriodSamples;
    }
  }
  return peaks;
};

//The Main getRhythmData Function --- returns the data to the Display function
export const getRhythmData = (
  rhythmType: RhythmType,
  heartRate: number,
): ECGData => {
  const durationSeconds = 10;
  const samplingRate = 250;
  const lcg = new LCG(42);

  let buffer: number[];

  switch (rhythmType) {
    case "sinus":
      buffer = createSeamlessLoop(
        generateDynamicECG(
          heartRate,
          durationSeconds,
          samplingRate,
          rhythmType,
          lcg,
        ),
        100,
        samplingRate,
      );
      break;
    case "tachycardieVentriculaire":
      buffer = createSeamlessLoop(
        [...ECG_RHYTHMS_STATIC.tachycardieVentriculaire.data],
        200,
        samplingRate,
      );
      break;

    case "fibrillationVentriculaire":
      buffer = createSeamlessLoop(
        [...ECG_RHYTHMS_STATIC.fibrillationVentriculaire.data],
        200,
        samplingRate,
      );
      break;
    case "asystole":
      buffer = createSeamlessLoop(
        [...ECG_RHYTHMS_STATIC.asystole.data],
        200,
        samplingRate,
      );
      break;
    case "fibrillationAtriale":
      buffer = createSeamlessLoop(
        [...ECG_RHYTHMS_STATIC.fibrillationAtriale.data],
        200,
        samplingRate,
      );
      break;
    case "bav1":
      buffer = createSeamlessLoop(
        generateDynamicECG(heartRate, durationSeconds, samplingRate, "bav1", lcg),
        200,
        samplingRate,
      );
      break;
    case "bav3":
      buffer = createSeamlessLoop(
        [...ECG_RHYTHMS_STATIC.bav3.data],
        200,
        samplingRate,
      );
      break;
    case "electroEntrainement":
      buffer = createSeamlessLoop(
        generateDynamicECG(
          heartRate,
          durationSeconds,
          samplingRate,
          rhythmType,
          lcg,
        ),
        100,
        samplingRate,
      );
      break;
    case "choc":
      buffer = createSeamlessLoop(
        generateDynamicECG(
          200,
          durationSeconds,
          samplingRate,
          rhythmType,
          lcg,
        ),
        100,
        samplingRate,
      );
      break;
    default:
      buffer = createSeamlessLoop(
        generateDynamicECG(heartRate, durationSeconds, samplingRate, "sinus", lcg),
        100,
        samplingRate,
      );
      break;
  }

  const peaks = detectPeaks(buffer, rhythmType);
  return { data: buffer, peaks };
};

// Main Data Store for real static ECG data
const ECG_RHYTHMS_STATIC = {
  sinusRhythm: { data: vitalSignsData.staticRhythms.sinusRhythm.data },
  fibrillationVentriculaire: {
    data: vitalSignsData.staticRhythms.fibrillationVentriculaire.data,
  },
  tachycardieVentriculaire: {
    data: vitalSignsData.staticRhythms.tachycardieVentriculaire.data,
  },
  asystole: { data: vitalSignsData.staticRhythms.asystole.data },
  fibrillationAtriale: {
    data: vitalSignsData.staticRhythms.fibrillationAtriale.data,
  },
  bav1: { data: vitalSignsData.staticRhythms.bav1.data },
  bav3: { data: vitalSignsData.staticRhythms.bav3.data },
};
