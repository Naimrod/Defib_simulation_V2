"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import AudioService from "../services/AudioService";

// ---- Type étendu exposé au reste de l'app ----
export type AudioAPI = AudioService & {
  playCuffInflation?: () => void;
  stopCuffInflation?: () => void;
  playBPDone?: () => void;
};

const AudioContext = createContext<AudioAPI | null>(null);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioService = useMemo(() => new AudioService(), []);
  const [isInitialized, setIsInitialized] = useState(false);

  // === GONFLAGE (gapless) via Web Audio, 1 seul MP3 ===
  const cuffBufferRef = useRef<AudioBuffer | null>(null);
  const cuffSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const cuffGainRef = useRef<GainNode | null>(null);

  // 👉 ajuster si nécessaire pour un cycle propre (en secondes)
  const CUFF_LOOP_START = 0.00;
  const CUFF_LOOP_END   = 0.00; // 0.00 => boucle sur toute la durée du fichier

  const loadCuffBuffer = useCallback(async () => {
    if (cuffBufferRef.current) return;
    const ctx = audioService.getAudioContext();
    const res = await fetch("/audio/cuff_inflate.mp3"); // 1 seul MP3
    const arr = await res.arrayBuffer();
    cuffBufferRef.current = await ctx.decodeAudioData(arr);
  }, [audioService]);

  const playCuffInflation = useCallback(async () => {
    try {
      await loadCuffBuffer();

      const ctx = audioService.getAudioContext();

      // stop/déconnecte une éventuelle lecture précédente
      try { cuffSourceRef.current?.stop(); } catch {}
      try { cuffSourceRef.current?.disconnect(); } catch {}
      try { cuffGainRef.current?.disconnect(); } catch {}
      cuffSourceRef.current = null;
      cuffGainRef.current = null;

      // volume
      const gain = ctx.createGain();
      gain.gain.value = 0.6 * (audioService.getSettings().volume ?? 1);
      cuffGainRef.current = gain;

      // source buffer en loop gapless
      const src = ctx.createBufferSource();
      src.buffer = cuffBufferRef.current!;
      src.loop = true;

      const dur = cuffBufferRef.current!.duration;
      const loopStart = Math.min(Math.max(0, CUFF_LOOP_START), Math.max(0, dur - 0.01));
      const loopEnd = CUFF_LOOP_END > 0 ? Math.min(CUFF_LOOP_END, dur) : dur;

      src.loopStart = loopStart;
      src.loopEnd = loopEnd;

      src.connect(gain).connect(ctx.destination);
      src.start(0);

      cuffSourceRef.current = src;
    } catch (e) {
      console.error("playCuffInflation (gapless mp3) error:", e);
    }
  }, [audioService, loadCuffBuffer]);

  const stopCuffInflation = useCallback(() => {
    try { cuffSourceRef.current?.stop(); } catch {}
    try { cuffSourceRef.current?.disconnect(); } catch {}
    try { cuffGainRef.current?.disconnect(); } catch {}
    cuffSourceRef.current = null;
    cuffGainRef.current = null;
  }, []);

  // === BIP FIN (HTMLAudio simple) ===
  const bpDoneRef = useRef<HTMLAudioElement | null>(null);

  const ensureBPDone = useCallback(() => {
    if (!bpDoneRef.current) {
      const a = new Audio("/audio/bp_done.mp3");
      a.loop = false;
      a.volume = 0.9;
      bpDoneRef.current = a;
    }
  }, []);

  const playBPDone = useCallback(() => {
    try {
      ensureBPDone();
      const a = bpDoneRef.current!;
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {}
  }, [ensureBPDone]);

  // ---- Initialisation AudioService (inchangée) ----
  useEffect(() => {
    try {
      console.log("Initial AudioContext state:", audioService.getAudioContext().state);
    } catch {}

    const initializeAudio = async () => {
      try {
        if (audioService.isSuspended()) {
          await audioService.resume(); // doit être déclenché après interaction user
        }
        if (typeof (audioService as any).preloadClickSounds === "function") {
          await (audioService as any).preloadClickSounds();
        }
        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to initialize or preload audio:", error);
      }
    };

    const handleInteraction = () => {
      if (!isInitialized) initializeAudio();
    };

    document.addEventListener("click", handleInteraction, { once: true });
    document.addEventListener("touchstart", handleInteraction, { once: true });

    return () => {
      try { audioService.stopAll(); } catch {}
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
    };
  }, [audioService, isInitialized]);

  // Cleanup à l’unmount : stop gonflage si en cours
  useEffect(() => {
    return () => {
      try { cuffSourceRef.current?.stop(); } catch {}
    };
  }, []);

  // --- Expose AudioService + 3 méthodes TA ---
  const value: AudioAPI = useMemo(() => {
    return Object.assign(Object.create(Object.getPrototypeOf(audioService)), audioService, {
      playCuffInflation,
      stopCuffInflation,
      playBPDone,
    });
  }, [audioService, playCuffInflation, stopCuffInflation, playBPDone]);

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
};
