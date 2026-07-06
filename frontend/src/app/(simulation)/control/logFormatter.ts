

type AnyMsg = Record<string, any>;

// Types de messages purement techniques : jamais utiles dans le log de séance
const NOISE_TYPES = new Set(["time_sync", "device_list_update"]);

const RHYTHM_LABELS: Record<string, string> = {
  sinusRhythm: "Sinusal",
  sinus: "Sinusal",
  sinusal: "Sinusal",
  fibrillationVentriculaire: "Fibrillation Ventriculaire",
  fv: "Fibrillation Ventriculaire",
  tachycardieVentriculaire: "Tachycardie Ventriculaire",
  tv_1: "Tachycardie Ventriculaire",
  tv_2: "Tachycardie Ventriculaire",
  asystole: "Asystolie",
  asysto: "Asystolie",
  arret: "Asystolie",
  fibrillationAtriale: "Fibrillation Atriale",
  fib_a: "Fibrillation Atriale",
  bav1: "BAV I",
  "1_bav": "BAV I",
  bav3: "BAV III",
  "3_bav": "BAV III",
  electroEntrainement: "Entrainement",
  stim: "Entrainement",
  choc: "Choc électrique",
};

function rhythmLabel(code?: string): string {
  if (!code) return "inconnu";
  return RHYTHM_LABELS[code] ?? code;
}

// Corrige le mojibake classique : du texte UTF-8 ("é" = 0xC3 0xA9) mal
// interprété comme du Latin-1/Windows-1252 donne "Ã©". On refait le chemin
// inverse : chaque code point (< 256) est traité comme un octet brut, puis
// redécodé en UTF-8. Si la chaîne est déjà correcte, l'opération est sans
// danger (elle échoue silencieusement et on garde l'original).
export function fixEncoding(str?: string): string {
  if (!str) return "";
  try {
    const bytes = Uint8Array.from([...str].map((c) => c.charCodeAt(0) & 0xff));
    const fixed = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return fixed;
  } catch {
    return str;
  }
}

function fmtVitals(p: AnyMsg): string {
  const parts: string[] = [];
  if (p.heartRate !== undefined) parts.push(`FC ${p.heartRate} bpm`);
  if (p.spo2 !== undefined) parts.push(`SpO2 ${p.spo2}%`);
  if (p.co2 !== undefined) parts.push(`EtCO2 ${p.co2} mmHg`);
  if (p.bloodPressure?.systolic !== undefined) {
    parts.push(`TA ${p.bloodPressure.systolic}/${p.bloodPressure.diastolic} mmHg`);
  }
  if (p.respiratoryRate !== undefined) parts.push(`FR ${p.respiratoryRate}/min`);
  return parts.join(", ");
}

// État conservé entre deux appels pour filtrer le bruit (molette d'énergie,
// répétitions de sync_state pendant une rampe de récupération, etc.)
export interface LogFormatterState {
  lastEnergy?: number;
  lastRhythm?: string;
  lastVitalsLoggedAt?: number;
}

export function createLogFormatterState(): LogFormatterState {
  return {};
}

const VITALS_THROTTLE_MS = 5000;

/**
 * Renvoie une ligne de log lisible pour ce message, ou null si le message
 * ne doit pas apparaître dans le log (bruit technique, ou doublon filtré).
 */
export function describeMessage(msg: AnyMsg, state: LogFormatterState): string | null {
  if (!msg || typeof msg.type !== "string") return null;
  if (NOISE_TYPES.has(msg.type)) return null;

  switch (msg.type) {
    case "scenario": {
      if (msg.action === "start") {
        // Le simulateur envoie deux messages "start" : un avec le titre
        // (venant du poste de contrôle), un simple accusé sans titre
        // (venant du défibrillateur). On ne garde que le premier.
        if (!msg.title) return null;
        return `▶ Scénario démarré : « ${fixEncoding(msg.title)} »`;
      }
      if (msg.action === "advance") {
        return `→ Étape ${msg.step} : ${fixEncoding(msg.step_description)}`;
      }
      if (msg.action === "complete") {
        return `✔ Scénario terminé`;
      }
      if (msg.action === "stop" || msg.action === "fail") {
        return `✖ Scénario interrompu`;
      }
      if (msg.action === "toggle_hints") {
        return `Indices ${msg.show_hints ? "activés" : "désactivés"}`;
      }
      return null;
    }

    case "defibrillator_action": {
      switch (msg.action) {
        case "boot_start":
          return `Défibrillateur : passage en mode « ${msg.target_mode} »`;
        case "set_energy":
          // On mémorise la valeur mais on ne journalise pas chaque cran de
          // molette : seule l'énergie effectivement chargée/délivrée compte.
          state.lastEnergy = msg.energy;
          return null;
        case "set_display_mode":
          return null; // redondant avec boot_start
        case "start_charge":
          return `Défibrillateur : mise en charge (${state.lastEnergy ?? "?"} J)`;
        case "chargeCompleted":
          return `Défibrillateur : charge complète (${state.lastEnergy ?? "?"} J) — prêt à choquer`;
        case "shock_delivered":
        case "deliver_shock":
          return `⚡ Choc délivré (${state.lastEnergy ?? "?"} J)`;
        default:
          return `Défibrillateur : ${msg.action}`;
      }
    }

    case "rhythm": {
      if (msg.rhythm === "choc") return `⚡ Choc électrique délivré`;
      return `Rythme réglé sur : ${rhythmLabel(msg.rhythm)}`;
    }

    case "sync_state": {
      const p = msg.patient;
      if (!p || !p.rhythmType) return null;

      const currentRhythm = rhythmLabel(p.rhythmType);
      const rhythmChanged = state.lastRhythm !== undefined && state.lastRhythm !== currentRhythm;
      const firstEntry = state.lastRhythm === undefined;
      const now = Date.now();
      const timeElapsed = !state.lastVitalsLoggedAt || now - state.lastVitalsLoggedAt >= VITALS_THROTTLE_MS;

      // On journalise systématiquement le premier point et tout changement
      // de rythme ; sinon on limite à un point vitaux toutes les 5 secondes
      // pour ne pas noyer le log pendant les rampes de récupération simulées.
      if (!firstEntry && !rhythmChanged && !timeElapsed) {
        return null;
      }

      state.lastRhythm = currentRhythm;
      state.lastVitalsLoggedAt = now;
      return `Patient : ${currentRhythm} — ${fmtVitals(p)}`;
    }

    // ecg / co2 / pressure / respiration / *scope / display_mode : ce sont
    // des mises à jour de capteur individuelles déjà résumées par sync_state.
    default:
      return null;
  }
}
