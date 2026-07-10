// AudioService.ts
interface AudioSettings {
  enabled: boolean;
  volume: number;
  language: string;
}

interface ClickSoundConfig {
  src: string;
  volume: number;
}

type OperatingMode = 'ARRET' | 'DAE' | 'Moniteur' | 'Manuel' | 'Stimulateur' | string;

class AudioService {
  // ===== Nouveautés pour le bip machine =====
  private machineBeepTimer: NodeJS.Timeout | null = null;
  private currentMode: OperatingMode = 'ARRET';

  // ===== Déjà existant =====
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private settings: AudioSettings = {
    enabled: true,
    volume: 0.8,
    language: 'fr-FR'
  };
  private repetitionTimer: NodeJS.Timeout | null = null;
  private audioContext: AudioContext | null = null;
  private fcBeepTimer: NodeJS.Timeout | null = null;
  private alertAlarmTimer: NodeJS.Timeout | null = null;
  private alarmOscillator: OscillatorNode | null = null;

  // Legacy audio
  private chargingSound: HTMLAudioElement | null = null;
  private alarmSound: HTMLAudioElement | null = null;

  // Click sounds
  private clickSounds: Map<string, HTMLAudioElement[]> = new Map();
  private clickSoundIndex = 0;
  private readonly CLICK_SOUND_POOL_SIZE = 3;

  private readonly clickSoundConfigs: Record<string, ClickSoundConfig> = {
    soft: { src: '/sounds/click-soft.wav', volume: 0.3 },
    normal: { src: '/sounds/click-normal.wav', volume: 0.5 },
    sharp: { src: '/sounds/click-sharp.wav', volume: 0.7 }
  };

  constructor() {
    if (typeof window === 'undefined') return;
    this.synthesis = window.speechSynthesis;
    this.initializeClickSounds();

    this.chargingSound = new Audio();
    this.alarmSound = new Audio();
  }

  // ===== Shared AudioContext =====
  public getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(console.error);
    }
    return this.audioContext;
  }

  public isSuspended(): boolean {
    return this.getAudioContext().state === 'suspended';
  }

  public resume(): Promise<void> {
    return this.getAudioContext().resume();
  }

  public getSettings(): AudioSettings {
    return this.settings;
  }

  updateSettings(settings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...settings };

    // MàJ volume des clics
    this.clickSounds.forEach((pool, type) => {
      const cfg = this.clickSoundConfigs[type];
      if (cfg) pool.forEach(a => (a.volume = cfg.volume * this.settings.volume));
    });

    // Si on coupe le son globalement : on arrête tout (dont le bip machine)
    if (!this.settings.enabled) {
      this.stopAll();
    } else {
      this.updateMachineBeepState(); // relance si éligible
    }
  }

  // ===== Click sounds =====
  private initializeClickSounds(): void {
    Object.entries(this.clickSoundConfigs).forEach(([type, cfg]) => {
      const pool: HTMLAudioElement[] = [];
      for (let i = 0; i < this.CLICK_SOUND_POOL_SIZE; i++) {
        const a = new Audio(cfg.src);
        a.preload = 'auto';
        a.volume = cfg.volume * this.settings.volume;
        pool.push(a);
      }
      this.clickSounds.set(type, pool);
    });
  }

  playClickSound(type: 'soft' | 'normal' | 'sharp' = 'normal'): void {
    if (!this.settings.enabled) return;
    const pool = this.clickSounds.get(type);
    if (!pool || !pool.length) return;

    const audio = pool[this.clickSoundIndex % pool.length];
    audio.currentTime = 0;
    audio.play().catch(() => {});
    this.clickSoundIndex++;
  }

  async preloadClickSounds(): Promise<void> {
    const loads: Promise<void>[] = [];
    this.clickSounds.forEach(pool => {
      pool.forEach(a => {
        loads.push(new Promise<void>((res, rej) => {
          a.addEventListener('canplaythrough', () => res(), { once: true });
          a.addEventListener('error', rej, { once: true });
          a.load();
        }));
      });
    });
    try { await Promise.all(loads); } catch {}
  }

  // ===== TTS =====
  private messageQueue: { text: string; options?: any }[] = [];

  playMessage(
    text: string,
    options?: { priority?: boolean; repeat?: boolean; repeatInterval?: number }
  ): void {
    if (!this.settings.enabled || !this.synthesis) return;

    // Prevent duplicate messages from flooding the queue
    const isAlreadyQueued = this.messageQueue.some(m => m.text === text);
    const isCurrentlySpeaking = this.currentUtterance?.text === text;
    
    if ((isAlreadyQueued || isCurrentlySpeaking) && !options?.priority) {
        return;
    }

    if (options?.priority) {
      console.log(`[AudioService] Priority message: "${text}". Clearing queue and interrupting current speech.`);
      this.messageQueue = [];
      if (this.currentUtterance) {
          this.currentUtterance.onend = null;
          this.currentUtterance.onerror = null;
      }
      this.synthesis.cancel();
      this.clearRepetition();
      // Wrapping speak in a timeout after cancel prevents silent failures on most browsers
      setTimeout(() => {
          this.speakNow(text, options);
      }, 100);
    } else {
      this.messageQueue.push({ text, options });
      if (!this.isSpeaking()) {
        this.processQueue();
      }
    }
  }

  private processQueue(): void {
    if (!this.settings.enabled || !this.synthesis) return;
    if (this.messageQueue.length === 0) return;
    
    // Check if truly speaking
    if (this.synthesis.speaking || this.currentUtterance) return;

    const nextMessage = this.messageQueue.shift();
    if (nextMessage) {
      this.speakNow(nextMessage.text, nextMessage.options);
    }
  }

  private speakNow(
    text: string,
    options?: { repeat?: boolean; repeatInterval?: number }
  ): void {
    if (!this.synthesis) return;

    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.settings.language;
    u.volume = this.settings.volume;
    u.rate = 0.9;

    // CRITICAL: Keep reference to prevent aggressive garbage collection bug in Chrome
    this.currentUtterance = u;

    u.onend = () => {
      if (this.currentUtterance === u) {
          this.currentUtterance = null;
      }
      if (options?.repeat && options.repeatInterval) {
        this.repetitionTimer = setTimeout(
          () => this.playMessage(text, options),
          options.repeatInterval
        );
      } else {
        // Small delay before next queued message for clarity
        setTimeout(() => this.processQueue(), 50);
      }
    };

    u.onerror = (e) => {
      console.warn("[AudioService] SpeechSynthesis error:", e);
      if (this.currentUtterance === u) {
          this.currentUtterance = null;
      }
      this.processQueue();
    };

    this.synthesis.speak(u);
  }

  clearRepetition(): void {
    if (this.repetitionTimer) {
      clearTimeout(this.repetitionTimer);
      this.repetitionTimer = null;
    }
  }

  isSpeaking(): boolean {
    return (this.synthesis ? this.synthesis.speaking : false) || this.currentUtterance !== null;
  }

  // ===== DAE phrases =====
  playDAEModeAdulte() { this.playMessage('Mode adulte'); }
  playDAEInstructions() { this.playMessage("Insérez fermement le connecteur et appliquez les électrodes"); }
  playDAEElectrodeReminder() { this.playMessage('Appliquez les électrodes', { repeat: true, repeatInterval: 10000 }); }
  playDAEAnalyse() { this.playMessage('Analyse en cours', { priority: true }); }
  playDAEChocRecommande() { this.playMessage('Choc recommandé', { priority: true }); }
  playDAEEcartezVousduPatient() { this.playMessage('Écartez-vous du patient', { priority: true }); }
  playDAEEcartezVous() { this.playMessage('Écartez-vous'); }
  playPasDeChocIndique() { this.playMessage('Pas de choc indiqué', { priority: true }); }
  playCommencerRCP() { this.playMessage('Commencer la réanimation cardio pulmonaire'); }
  playDAEChoc() { this.playMessage('délivrer le choc maintenant', { priority: true }); }
  playDAEboutonOrange() { this.playMessage('appuyez sur le bouton orange maintenant'); }
  playDAEChocDelivre() { this.playMessage('choc délivré', { priority: true }); }

  private chargingOscillator: OscillatorNode | null = null;
  private chargeTimeout: NodeJS.Timeout | null = null;

  // ===== Séquence de charge (découplée) =====
  startChargingSound(): void {
    this.stopChargingSound();
    if (!this.settings.enabled) return;

    try {
      const ctx = this.getAudioContext();
      this.chargingOscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      this.chargingOscillator.type = 'triangle';
      // Pitch ramps up over time to simulate charging
      this.chargingOscillator.frequency.setValueAtTime(500, now);
      this.chargingOscillator.frequency.linearRampToValueAtTime(1500, now + 5);
      
      gain.gain.setValueAtTime(0.1 * this.settings.volume, now);

      this.chargingOscillator.connect(gain).connect(ctx.destination);
      this.chargingOscillator.start(now);
    } catch {}
  }

  stopChargingSound(): void {
    if (this.chargeTimeout) {
      clearTimeout(this.chargeTimeout);
      this.chargeTimeout = null;
    }
    if (this.synthesis) {
      this.synthesis.cancel();
    }
    this.messageQueue = [];
    this.clearRepetition();
    this.currentUtterance = null;

    if (this.chargingOscillator) {
      try {
        this.chargingOscillator.stop();
        this.chargingOscillator.disconnect();
      } catch {}
      this.chargingOscillator = null;
    }
    this.stopAlarmOscillator();
  }

  playChargedAlarm(): void {
    if (!this.settings.enabled) return;
    
    try {
      const ctx = this.getAudioContext();
      this.stopAlarmOscillator();
      
      this.alarmOscillator = ctx.createOscillator();
      const alarmGain = ctx.createGain();

      this.alarmOscillator.type = 'square';
      this.alarmOscillator.frequency.setValueAtTime(2000, ctx.currentTime);
      alarmGain.gain.setValueAtTime(0.05 * this.settings.volume, ctx.currentTime);

      this.alarmOscillator.connect(alarmGain).connect(ctx.destination);
      this.alarmOscillator.start();

      this.alarmOscillator.onended = () => { this.alarmOscillator = null; };

      this.playDAEChoc();
      this.chargeTimeout = setTimeout(() => this.playDAEboutonOrange(), 2000);
    } catch {}
  }

 // ===== Bips de FC (style moniteur Efficia-like) =====
playFCBeep(): void {
  if (!this.settings.enabled) return;
  try {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    // Timbre modifié doux
  osc.type = 'sine';
      osc.frequency.setValueAtTime(470, now); // ajuste si besoin

      const peak = 0.6 * this.settings.volume;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
  } catch {}
}


  startFCBeepSequence(): void {
    this.stopFCBeepSequence();
    this.playFCBeep();
    this.fcBeepTimer = setInterval(() => this.playFCBeep(), 2000);
  }

  stopFCBeepSequence(): void {
    if (this.fcBeepTimer) {
      clearInterval(this.fcBeepTimer);
      this.fcBeepTimer = null;
    }
  }

  // ===== Bip ALARME (existant) =====
  playAlertAlarmBeep(): void {
    if (!this.settings.enabled) return;
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1600, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1.5 * this.settings.volume, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.1 * this.settings.volume, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001 * this.settings.volume, now + 0.5);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } catch {}
  }

  startAlertAlarmSequence(): void {
    this.stopAlertAlarmSequence();
    this.alertAlarmTimer = setInterval(() => this.playAlertAlarmBeep(), 1000);
    this.updateMachineBeepState(); // ⛔️ 
  }

  stopAlertAlarmSequence(): void {
    if (this.alertAlarmTimer) {
      clearInterval(this.alertAlarmTimer);
      this.alertAlarmTimer = null;
    }
    this.updateMachineBeepState(); // ✅ peut relancer le bip machine
  }

  private stopAlarmOscillator(): void {
    if (this.alarmOscillator) {
      try {
        this.alarmOscillator.stop();
        this.alarmOscillator.disconnect();
      } catch {}
      this.alarmOscillator = null;
    }
  }

  // ======= NOUVEAU : BIP MACHINE RÉGULIER =======
  /**
   * À appeler quand le mode change (ARRET/DAE/Moniteur/Manuel/Stimulateur…)
   */
  public updateOperatingMode(mode: OperatingMode): void {
    this.currentMode = mode;
    this.updateMachineBeepState();
  }

  /**
   * Conditions d’activation du bip machine :
   * - audio activé
   * - PAS en alarme (fvAlarmTimer actif ? alors off)
   * - PAS en mode DAE
   * - PAS en mode ARRET
   */
  private shouldMachineBeep(): boolean {
    if (!this.settings.enabled) return false;
    if (this.isAlarmActive()) return false;
    const m = (this.currentMode || '').toUpperCase();
    if (m === 'DAE' || m === 'ARRET') return false;
    return false; // SamModif en attendant de configurer ce bip machine lorsqu'il n'y a pas de rytme affiché
  }

  private isAlarmActive(): boolean {
    return this.alertAlarmTimer != null;
    // (si tu veux aussi couper pendant certaines annonces TTS, tu peux ajouter: || this.isSpeaking())
  }

  private updateMachineBeepState(): void {
    if (this.shouldMachineBeep()) {
      this.startMachineBeep();
    } else {
      this.stopMachineBeep();
    }
  }

  private playMachineBeep(): void {
    // Bip doux / plus grave que FC
    if (!this.settings.enabled) return;
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      // Timbre plus rond 
      osc.type = 'sine';
      osc.frequency.setValueAtTime(470, now); 
      const peak = 0.6 * this.settings.volume;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.04);         // attaque douce ~20ms
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);   // extinction ~120ms

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {}
  }

  private startMachineBeep(): void {
    if (this.machineBeepTimer) return;
    // première impulsion immédiate, puis toutes les secondes
    this.playMachineBeep();
    this.machineBeepTimer = setInterval(() => {
      // si une alarme démarre entre-temps, on stoppe
      if (!this.shouldMachineBeep()) {
        this.stopMachineBeep();
        return;
      }
      this.playMachineBeep();
    }, 2000);
  }

  private stopMachineBeep(): void {
    if (this.machineBeepTimer) {
      clearInterval(this.machineBeepTimer);
      this.machineBeepTimer = null;
    }
  }

  // ===== Stop global =====
  stopAll(): void {
    if (this.synthesis) this.synthesis.cancel();
    this.clearRepetition();
    this.currentUtterance = null;

    if (this.chargingSound && !this.chargingSound.paused) {
      this.chargingSound.pause();
      this.chargingSound.currentTime = 0;
    }
    if (this.alarmSound && !this.alarmSound.paused) {
      this.alarmSound.pause();
      this.alarmSound.currentTime = 0;
    }

    if (this.chargeTimeout) {
      clearTimeout(this.chargeTimeout);
      this.chargeTimeout = null;
    }
    this.stopChargingSound();
    this.stopAlarmOscillator();

    this.stopFCBeepSequence();
    this.stopAlertAlarmSequence();
    this.stopMachineBeep(); // ✅ coupe aussi le bip machine
  }
}

export default AudioService;
