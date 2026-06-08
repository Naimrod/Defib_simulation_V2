"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { useStopwatch } from "react-timer-hook";
import MonitorDisplay, { type MonitorDisplayRef } from "../components/ScreenDisplay/MonitorDisplay";
import DAEDisplay from "../components/ScreenDisplay/DAEDisplay";
import ARRETDisplay from "../components/ScreenDisplay/ARRETDisplay";
import StimulateurDisplay, { type StimulateurDisplayRef } from "../components/ScreenDisplay/StimulateurDisplay";
import ManuelDisplay, { type ManuelDisplayRef } from "../components/ScreenDisplay/ManuelDisplay";
import Header from "../components/Header";
import { useDefibrillator, type DisplayMode } from "../hooks/useDefibrillator";
import { RotaryMappingService } from "../services/RotaryMappingService";
import { useScenarioPlayer, type ScenarioConfig } from "../hooks/useScenarioPlayer";
import { useElectrodeValidation } from "../hooks/useElectrodeValidation";
import ElectrodeValidationOverlay from "../components/ElectrodeValidationOverlay";


// --- Audio & EventBus ---
import { useAudio } from "../context/AudioContext";
import { emit } from "../../lib/eventBus";

import { RhythmType } from "../components/graphsdata/ECGRhythms";
import DefibrillatorUI from "../components/DefibrillatorUI";
import { AudioProvider } from "../context/AudioContext";
import { useResponsiveScale } from "../hooks/useResponsiveScale";

const SimulatorPageContent: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stimulateurDisplayRef = useRef<StimulateurDisplayRef>(null);
  const manuelDisplayRef = useRef<ManuelDisplayRef>(null);
  const monitorDisplayRef = useRef<MonitorDisplayRef>(null);

  const audio = useAudio();
  const scale = useResponsiveScale(1024, 768);

  // --- State Management Hooks ---
  const [manualRhythm, setManualRhythm] = useState<RhythmType>("sinus");
  const [manualHeartRate, setManualHeartRate] = useState(70);

  const defibrillator = useDefibrillator();
  const electrodeValidation = useElectrodeValidation();
  const timer = useStopwatch({ autoStart: true });

  const fullSimulationState = { ...defibrillator, ...electrodeValidation };
  const scenarioPlayer = useScenarioPlayer(fullSimulationState as any);

  // --- UI and Interaction State ---
  const [daePhase, setDaePhase] = useState<string | null>(null);
  const [daeShockFunction, setDaeShockFunction] = useState<(() => void) | null>(null);
  const [isBooting, setIsBooting] = useState(false);
  const [targetMode, setTargetMode] = useState<DisplayMode | null>(null);
  const [bootProgress, setBootProgress] = useState(0);
  const [showFCValue, setShowFCValue] = useState(true);
  const [showVitalSigns, setShowVitalSigns] = useState(true);

  // --- TA helpers ---
  const computeMAP = (sys: number, dia: number) => dia + (sys - dia) / 3;
  const [bloodPressure, setBloodPressure] = useState({ systolic: 83, diastolic: 54, map: computeMAP(83, 54) });
  const updateBP = (sys: number, dia: number) =>
    setBloodPressure({ systolic: sys, diastolic: dia, map: computeMAP(sys, dia) });

  // --- Timers ---
  const bootTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const targetModeRef = useRef<DisplayMode | null>(null);

  useEffect(() => {
    targetModeRef.current = targetMode;
  }, [targetMode]);

  // --- Sync affichage -> AudioService (bip machine ON/OFF selon mode) ---
  useEffect(() => {
    const mode = defibrillator.displayMode ?? "ARRET";
    audio.updateOperatingMode(mode);
  }, [defibrillator.displayMode, audio]);

  // Auto-reset timer at 30 minutes
  useEffect(() => {
    if (timer.totalSeconds >= 1800) timer.reset();
  }, [timer.totalSeconds, timer.reset]);

  // --- Scenario Management ---
  const handleStartScenario = async (scenarioId: string) => {
    try {
      defibrillator.resetState();
      timer.reset();

      const scenarioModule = await import(`../data/scenarios/${scenarioId}.json`);
      const scenarioConfig: ScenarioConfig = scenarioModule.default;

      scenarioPlayer.startScenario(scenarioConfig);

      // (on laisse l'auto-start de la TA au useEffect ci-dessous)
    } catch (error) {
      console.error("Error starting scenario:", error);
    }
  };

  const handleExitScenario = () => {
    try { audio.stopAll(); } catch {}
    emit("bp:requireManual"); // la prochaine TA doit être lancée manuellement
    scenarioPlayer.stopScenario();
    defibrillator.resetState();
    timer.reset();
  };

// ✅ Auto-lancer la PNI dès qu’un scénario devient actif (incl. scénario 3)
useEffect(() => {
  // garde-fou : ne spam pas si on est déjà parti pour ce scénario
  const startedFor = (window as any).__bpAutoStartedFor as string | undefined;
  const currentId = scenarioPlayer.scenarioConfig?.id;
  const canStartNow =
    scenarioPlayer.isScenarioActive &&
    !!currentId &&
    startedFor !== currentId;

  if (!canStartNow) return;

  // mémorise que ce scénario a reçu son autoStart
  (window as any).__bpAutoStartedFor = currentId;

  // On “arrose” plusieurs fois juste après le montage pour s’assurer
  // que VitalsDisplay a bien accroché ses listeners.
  let rafId: number | null = null;
  let frames = 0;
  const rafPing = () => {
    emit("bp:autoStart");
    frames += 1;
    if (frames < 5) rafId = requestAnimationFrame(rafPing);
  };

  const t0 = setTimeout(() => emit("bp:autoStart"), 0);
  const t1 = setTimeout(() => emit("bp:autoStart"), 200);
  const t2 = setTimeout(() => emit("bp:autoStart"), 500);
  const t3 = setTimeout(() => emit("bp:autoStart"), 800);
  const t4 = setTimeout(() => emit("bp:autoStart"), 1200);

  rafPing();

  return () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
  };
}, [scenarioPlayer.isScenarioActive, scenarioPlayer.scenarioConfig?.id]);

  // Quand un scénario se termine (succès), exiger une prise manuelle suivante
  useEffect(() => {
    if (scenarioPlayer.isScenarioActive && scenarioPlayer.isComplete) {
      emit("bp:requireManual");
    }
  }, [scenarioPlayer.isScenarioActive, scenarioPlayer.isComplete]);

  const handleModeChange = (newMode: DisplayMode) => {
    const isScenarioRunning = scenarioPlayer.isScenarioActive;

    if (newMode === "ARRET") {
      try { audio.stopAll(); } catch {}
      if (bootTimeoutRef.current) { clearTimeout(bootTimeoutRef.current); bootTimeoutRef.current = null; }
      if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }

      setIsBooting(false);
      setTargetMode(null);
      setBootProgress(0);

      electrodeValidation.resetElectrodeValidation();
      defibrillator.setDisplayMode("ARRET", isScenarioRunning);
      timer.reset();
      return;
    }

    if (isBooting) {
      setTargetMode(newMode);
      return;
    }

    if (defibrillator.displayMode === "ARRET") {
      setIsBooting(true);
      setTargetMode(newMode);
      setBootProgress(0);

      if (!progressIntervalRef.current) {
        progressIntervalRef.current = setInterval(() => {
          setBootProgress((prev) => Math.min(prev + 2, 100));
        }, 100);
      }

      if (!bootTimeoutRef.current) {
        bootTimeoutRef.current = setTimeout(() => {
          if (targetModeRef.current) {
            defibrillator.setDisplayMode(targetModeRef.current, isScenarioRunning);
          }
          setIsBooting(false);
          setTargetMode(null);
          setBootProgress(0);
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          bootTimeoutRef.current = null;
        }, 5000);
      }
      return;
    }

    defibrillator.setDisplayMode(newMode, isScenarioRunning);
  };

  const handleRotaryValueChange = (value: number) => {
    const newValue = RotaryMappingService.mapRotaryToValue(value);
    if (["DAE", "ARRET", "Moniteur", "Stimulateur"].includes(newValue)) {
      handleModeChange(newValue as DisplayMode);
    } else {
      defibrillator.setmanualEnergy(newValue, handleModeChange);
    }
  };

  const handleChargeButtonClick = () => {
    if (defibrillator.displayMode === "Manuel") {
      defibrillator.startCharging();
    }
  };

  const handleShockButtonClick = () => {
    if (defibrillator.displayMode === "DAE" && daePhase === "attente_choc" && daeShockFunction) {
      daeShockFunction();
    } else if (defibrillator.displayMode === "Manuel") {
      defibrillator.deliverShock();
    }
  };

  const handleSynchroButtonClick = () => defibrillator.toggleSynchroMode();

  // --- Joystick Handlers ---
  const handleJoystickStepUp = () => {
    let displayRef:
      | React.RefObject<StimulateurDisplayRef | MonitorDisplayRef | null>
      | null = null;
    if (defibrillator.displayMode === "Stimulateur") {
      displayRef = stimulateurDisplayRef;
    } else if (defibrillator.displayMode === "Moniteur") {
      displayRef = monitorDisplayRef;
    }

    if (displayRef?.current) {
      const isEditing = displayRef.current.isInValueEditMode();
      if (isEditing) displayRef.current.decrementValue();
      else displayRef.current.navigateUp();
    }
  };

  const handleJoystickStepDown = () => {
    let displayRef:
      | React.RefObject<StimulateurDisplayRef | MonitorDisplayRef | null>
      | null = null;
    if (defibrillator.displayMode === "Stimulateur") {
      displayRef = stimulateurDisplayRef;
    } else if (defibrillator.displayMode === "Moniteur") {
      displayRef = monitorDisplayRef;
    }

    if (displayRef?.current) {
      const isEditing = displayRef.current.isInValueEditMode();
      if (isEditing) displayRef.current.incrementValue();
      else displayRef.current.navigateDown();
    }
  };

  const handleJoystickClick = () => {
    let displayRef:
      | React.RefObject<StimulateurDisplayRef | MonitorDisplayRef | ManuelDisplayRef | any>
      | null = null;

    if (defibrillator.displayMode === "Stimulateur") displayRef = stimulateurDisplayRef;
    else if (defibrillator.displayMode === "Moniteur") displayRef = monitorDisplayRef;
    else if (defibrillator.displayMode === "Manuel") displayRef = manuelDisplayRef;

    if (displayRef?.current) {
      if (displayRef.current.isMenuOpen()) displayRef.current.selectCurrentItem();
      else displayRef.current.triggerMenu();
    }
  };

  const handleStimulatorSettingsButton = () => stimulateurDisplayRef.current?.triggerReglagesStimulateur();
  const handleStimulatorMenuButton = () => stimulateurDisplayRef.current?.triggerMenu();
  const handleStimulatorStartButton = () => defibrillator.toggleIsPacing();
  const handleCancelChargeButton = () => defibrillator.cancelCharge();
  const handleMonitorMenuButton = () => monitorDisplayRef.current?.triggerMenu();

  // --- DAE Callbacks ---
  const handleDaePhaseChange = useCallback((phase: string) => setDaePhase(phase), []);

  // --- Effective state getters ---
  const getEffectiveRhythm = (): RhythmType =>
    scenarioPlayer.isScenarioActive ? defibrillator.rhythmType : manualRhythm;
  const getEffectiveHeartRate = (): number =>
    scenarioPlayer.isScenarioActive ? defibrillator.heartRate : manualHeartRate;

  // --- Scénarios & TA init ---
  useEffect(() => {
    const bp = scenarioPlayer.scenarioConfig?.initialState?.bloodPressure;
    if (scenarioPlayer.isScenarioActive && bp?.systolic != null && bp?.diastolic != null) {
      updateBP(bp.systolic, bp.diastolic);
    }
  }, [scenarioPlayer.isScenarioActive, scenarioPlayer.scenarioConfig?.initialState?.bloodPressure]);

  const isScenario1 = scenarioPlayer.scenarioConfig?.id === "scenario_1";
  const isScenario2 = scenarioPlayer.scenarioConfig?.id === "scenario_2";
  const isScenario3 = scenarioPlayer.scenarioConfig?.id === "scenario_3";
  const currentStep = scenarioPlayer.currentStep?.step;

  const s3BPAppliedRef = useRef(false);
  useEffect(() => {
    const isS3 = scenarioPlayer.scenarioConfig?.id === "scenario_3";
    if (!scenarioPlayer.isScenarioActive || !isS3) {
      s3BPAppliedRef.current = false;
      return;
    }
    const inStim = defibrillator.displayMode === "Stimulateur";
    const pacingOn = defibrillator.isPacing === true;
    const captured = (defibrillator.pacerIntensity ?? 0) >= 90;

    if (!s3BPAppliedRef.current && inStim && pacingOn && captured) {
      updateBP(116, 73);
      s3BPAppliedRef.current = true;
    }
  }, [
    scenarioPlayer.isScenarioActive,
    scenarioPlayer.scenarioConfig?.id,
    defibrillator.displayMode,
    defibrillator.isPacing,
    defibrillator.pacerIntensity,
  ]);

  useEffect(() => {
    if (isScenario1 && currentStep === 3 && defibrillator.showShockDelivered) updateBP(110, 75);
  }, [isScenario1, currentStep, defibrillator.showShockDelivered]);

  useEffect(() => {
    if (isScenario2 && daePhase === "choc") updateBP(115, 80);
  }, [isScenario2, daePhase]);

  const isScenario4 = scenarioPlayer.scenarioConfig?.id === "scenario_4";
  useEffect(() => {
    if (!isScenario4) return;
    const shock = daePhase === "choc" || defibrillator.showShockDelivered === true;
    if (shock) updateBP(112, 85);
  }, [isScenario4, daePhase, defibrillator.showShockDelivered]);

  useEffect(() => {
    if (scenarioPlayer.scenarioConfig?.id === "scenario_4") {
      setShowVitalSigns(true);
    }
  }, [scenarioPlayer.scenarioConfig?.id]);

  // --- Render Logic ---
  const renderScreenContent = () => {
    if (isBooting) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-black text-white">
          <div className="flex flex-col items-center space-y-8">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-green-400 mb-4">MARIUS</h1>
              <div className="text-sm text-gray-400">DFM100</div>
            </div>
            <div className="w-64 h-2 bg-gray-700 rounded">
              <div className="h-full bg-green-500 rounded transition-all duration-100" style={{ width: `${bootProgress}%` }}></div>
            </div>
            <div className="text-center text-sm text-gray-300">
              <div>Démarrage en cours...</div>
              <div className="mt-2">Passage en mode {targetMode}</div>
            </div>
          </div>
        </div>
      );
    }

    const effectiveRhythm = getEffectiveRhythm();
    const effectiveHeartRate = getEffectiveHeartRate();

    const timerProps = { minutes: timer.minutes, seconds: timer.seconds, totalSeconds: timer.totalSeconds };

    switch (defibrillator.displayMode) {
      case "ARRET":
        return <ARRETDisplay />;
      case "DAE":
        return (
          <DAEDisplay
            timerProps={timerProps}
            {...{
              ...defibrillator,
              rhythmType: effectiveRhythm,
              heartRate: effectiveHeartRate,
              onPhaseChange: handleDaePhaseChange,
              onShockReady: setDaeShockFunction,
              onElectrodePlacementValidated: () => {
                electrodeValidation.validateElectrodes();
                emit("stepValidated");
              },
              energy: "150",
              showFCValue,
              onShowFCValueChange: setShowFCValue,
              showVitalSigns,
              onShowVitalSignsChange: setShowVitalSigns,
              showSynchroArrows: defibrillator.isSynchroMode,
            }}
            bloodPressure={bloodPressure}
            isScenario4={isScenario4}
          />
        );
      case "Moniteur":
        return (
          <MonitorDisplay
            bloodPressure={bloodPressure}
            isScenario4={isScenario4}
            timerProps={timerProps}
            ref={monitorDisplayRef}
            rhythmType={effectiveRhythm}
            showSynchroArrows={defibrillator.isSynchroMode}
            heartRate={effectiveHeartRate}
            showFCValue={showFCValue}
            onShowFCValueChange={setShowFCValue}
            showVitalSigns={showVitalSigns}
            onShowVitalSignsChange={setShowVitalSigns}
          />
        );
      case "Manuel":
        return (
          <ManuelDisplay
            bloodPressure={bloodPressure}
            isScenario4={isScenario4}
            timerProps={timerProps}
            ref={manuelDisplayRef}
            {...{
              ...defibrillator,
              rhythmType: effectiveRhythm,
              heartRate: effectiveHeartRate,
              onCancelCharge: defibrillator.cancelCharge,
              energy: defibrillator.manualEnergy,
              showFCValue,
              onShowFCValueChange: setShowFCValue,
              showVitalSigns,
              onShowVitalSignsChange: setShowVitalSigns,
              showSynchroArrows: defibrillator.isSynchroMode,
              showShockDelivered: defibrillator.showShockDelivered,
              showCPRMessage: defibrillator.showCPRMessage,
            }}
          />
        );
      case "Stimulateur":
        return (
          <StimulateurDisplay
            bloodPressure={bloodPressure}
            isScenario4={isScenario4}
            timerProps={timerProps}
            ref={stimulateurDisplayRef}
            rhythmType={effectiveRhythm}
            showSynchroArrows={defibrillator.isSynchroMode}
            heartRate={effectiveHeartRate}
            pacerFrequency={defibrillator.pacerFrequency}
            pacerIntensity={defibrillator.pacerIntensity}
            onFrequencyChange={defibrillator.setPacerFrequency}
            onIntensityChange={defibrillator.setPacerIntensity}
            pacerMode={defibrillator.pacerMode}
            isPacing={defibrillator.isPacing}
            onPacerModeChange={defibrillator.setPacerMode}
            onTogglePacing={defibrillator.toggleIsPacing}
            showFCValue={showFCValue}
            onShowFCValueChange={setShowFCValue}
            showVitalSigns={showVitalSigns}
            onShowVitalSignsChange={setShowVitalSigns}
          />
        );
      default:
        return <ARRETDisplay />;
    }
  };

  const defibrillatorUIProps = {
    defibrillator,
    renderScreenContent,
    handleRotaryValueChange,
    handleChargeButtonClick,
    handleShockButtonClick,
    handleShockButtonPress: defibrillator.handleShockButtonPress,
    handleShockButtonRelease: defibrillator.handleShockButtonRelease,
    handleSynchroButtonClick,
    handleJoystickStepUp,
    handleJoystickStepDown,
    handleJoystickClick,
    handleStimulatorSettingsButton,
    handleStimulatorMenuButton,
    handleStimulatorStartButton,
    handleCancelChargeButton,
    handleMonitorMenuButton,
    isShockButtonBlinking: defibrillator.isShockButtonBlinking,
    daePhase,
  };

  return (
    <div className="h-screen bg-[#0B1222] flex flex-col relative">
      <Header
        onStartScenario={handleStartScenario}
        currentRhythm={manualRhythm}
        onRhythmChange={setManualRhythm}
        heartRate={manualHeartRate}
        onHeartRateChange={setManualHeartRate}
        isScenarioActive={scenarioPlayer.isScenarioActive}
        isComplete={scenarioPlayer.isComplete}
        onExitScenario={handleExitScenario}
        scenarioTitle={scenarioPlayer.scenarioConfig?.title}
        currentStepNumber={scenarioPlayer.currentStep ? scenarioPlayer.currentStep.step + 1 : 0}
        totalSteps={scenarioPlayer.scenarioConfig?.steps.length ?? 0}
        showStepNotifications={scenarioPlayer.showStepNotifications}
        onToggleStepNotifications={scenarioPlayer.toggleStepNotifications}
      />

      <main className="h-[94vh] flex-grow flex items-center justify-center p-2 portrait:hidden">
        <div
          className="relative"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center",
            transition: "none",
          }}
        >
          <DefibrillatorUI {...defibrillatorUIProps} />
        </div>
      </main>

      {scenarioPlayer.isScenarioActive && (
        <>
          {scenarioPlayer.currentStep && !scenarioPlayer.isComplete && scenarioPlayer.showStepNotifications && (
            <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full bg-white rounded-lg shadow-2xl border-2 border-green-500 p-4 portrait:hidden">
              <h3 className="text-sm font-bold text-gray-800 mb-1">
                Étape {scenarioPlayer.currentStep.step + 1}
              </h3>
              <p className="text-gray-600 text-sm">{scenarioPlayer.currentStep.description}</p>
            </div>
          )}
          {scenarioPlayer.isComplete && (
            <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full bg-green-100 rounded-lg shadow-2xl border-2 border-green-500 p-4 portrait:hidden">
              <h3 className="text-lg font-bold text-green-800 mb-1">Félicitations !</h3>
              <p className="text-green-700 text-sm">Scénario terminé avec succès.</p>
            </div>
          )}
          {scenarioPlayer.failureMessage && (
            <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 portrait:hidden">
              <div className="bg-red-500 text-white p-8 rounded-lg text-center">
                <h2 className="text-2xl font-bold">Erreur Critique</h2>
                <p>{scenarioPlayer.failureMessage}</p>
              </div>
            </div>
          )}
        </>
      )}

      {!showFCValue && defibrillator.displayMode != "ARRET" && (
        <div className="absolute top-1/8 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-100 bg-blue-500 text-white text-[11px] px-2 py-1 rounded-lg shadow-lg animate-pulse">
          Cliquez sur les constantes (FC, SpO2, PNI) pour les afficher
        </div>
      )}

      <div className="hidden portrait:flex tablet:hidden text-center absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-100 bg-blue-500 text-white text-[11px] px-2 py-1 rounded-lg shadow-lg animate-pulse">
        <div className="flex flex-col items-center">
          <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 122.88 106.43"
            className="w-12 h-12 mb-3 fill-white"
          >
            <path d="M11.1,0h35.63c3.05,0,5.85,1.25,7.85,3.25c2.03,2.03,3.25,4.8,3.25,7.85v31.46h-3.19V12.18H3.15v75.26l0,0
              h7.61v11.61c0,1.58,0.27,3.10,0.77,4.51H11.1c-3.05,0-5.85-1.25-7.85-3.25C1.22,98.27,0,95.51,0,92.45V11.1
              c0-3.05,1.25-5.85,3.25-7.85C5.28,1.22,8.04,0,11.1,0L11.1,0L11.1,0z M94.95,33.45c-0.37-5.8-2.64-10.56-6.06-13.97
              c-3.64-3.63-8.59-5.74-13.94-5.93l2.46,2.95c0.73,0.88,0.62,2.18-0.26,2.91c-0.88,0.73-2.18,0.62-2.91-0.26l-5.72-6.85l0,0
              c-0.72-0.86-0.62-2.14,0.22-2.88l6.71-5.89c0.86-0.75,2.16-0.66,2.91,0.19c0.75,0.86,0.66,2.16-0.19,2.91l-3.16,2.78
              c6.43,0.21,12.4,2.75,16.8,7.13c4.07,4.06,6.79,9.69,7.25,16.49l2.58-3.08c0.73-0.88,2.04-0.99,2.91-0.26
              c0.88,0.73,0.99,2.04,0.26,2.91l-5.73,6.84c-0.72,0.86-1.99,0.99-2.87,0.29l-6.98-5.56c-0.89-0.71-1.04-2.01-0.33-2.91
              c0.71-0.89,2.01-1.04,2.91-0.33L94.95,33.45L94.95,33.45z M122.88,59.7v35.63c0,3.05-1.25,5.85-3.25,7.85
              c-2.03,2.03-4.8,3.25-7.85,3.25h-78.9c-3.05,0-5.85-1.25-7.85-3.25c-2.03-2.03-3.25-4.8-3.25-7.85V59.7c0-3.05,1.25-5.85,3.25-7.85
              c2.03-2.03,4.79-3.25,7.85-3.25h78.9c3.05,0,5.85,1.25,7.85,3.25C121.66,53.88,122.88,56.64,122.88,59.7L122.88,59.7L122.88,59.7z
              M35.41,77.49c0,2.51-2.03,4.57-4.57,4.57c-2.51,0-4.57-2.03-4.57-4.57c0-2.51,2.03-4.57,4.57-4.57
              C33.36,72.92,35.41,74.95,35.41,77.49L35.41,77.49L35.41,77.49z M37.88,51.75v51.49h72.82V51.75H37.88L37.88,51.75z"/>
          </svg>
          <p className="text-lg">Veuillez tourner votre appareil.</p>
        </div>
      </div>
    </div>
  );
};

const SimulatorPage: React.FC = () => (
  <AudioProvider>
    <SimulatorPageContent />
  </AudioProvider>
);

export default SimulatorPage;
