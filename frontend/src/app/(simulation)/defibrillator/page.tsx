"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { useStopwatch } from "react-timer-hook";
import MonitorDisplay, { type MonitorDisplayRef } from "../../components/ScreenDisplay/MonitorDisplay";
import DAEDisplay from "../../components/ScreenDisplay/DAEDisplay";
import ARRETDisplay from "../../components/ScreenDisplay/ARRETDisplay";
import StimulateurDisplay, { type StimulateurDisplayRef } from "../../components/ScreenDisplay/StimulateurDisplay";
import ManuelDisplay, { type ManuelDisplayRef } from "../../components/ScreenDisplay/ManuelDisplay";
import Header from "../../components/Header";
import { useDefibrillator } from "../../hooks/useDefibrillator";
import { useAlarms } from "../../hooks/useAlarms";
import { DisplayMode } from "@/types/simulation";
import { RotaryMappingService } from "../../services/RotaryMappingService";
import { useScenarioPlayer } from "../../hooks/useScenarioPlayer";
import { useElectrodeValidation } from "../../hooks/useElectrodeValidation";
import ElectrodeValidationOverlay from "../../components/ElectrodeValidationOverlay";

// --- Audio & EventBus ---
import { useAudio } from "../../context/AudioContext";
import { emit } from "../../../lib/eventBus";

import { RhythmType } from "../../components/graphsdata/ECGRhythms";
import DefibrillatorUI from "../../components/DefibrillatorUI";
import { useResponsiveScale } from "../../hooks/useResponsiveScale";

// Import scenarios data for ID-to-Object resolution
import { SCENARIOS } from "../../data/scenarios";

const SimulatorPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stimulateurDisplayRef = useRef<StimulateurDisplayRef>(null);
  const manuelDisplayRef = useRef<ManuelDisplayRef>(null);
  const monitorDisplayRef = useRef<MonitorDisplayRef>(null);

  const audio = useAudio();
  const scale = useResponsiveScale(1024, 768);

  const defibrillator = useDefibrillator();
  const electrodeValidation = useElectrodeValidation();
  const timer = useStopwatch({ autoStart: true });

  // Handle defibrillator page audio sequences globally at the parent level
  // to avoid restarts and sync issues during sub-display mode switches
  useAlarms(
    defibrillator.patient.rhythm_type as RhythmType,
    defibrillator.device.show_fc,
    defibrillator.patient.heart_rate,
    true
  );

  const fullSimulationState = { ...defibrillator, ...electrodeValidation };
  const scenarioPlayer = useScenarioPlayer(fullSimulationState as any);

  // --- UI and Interaction State ---
  const [daePhase, setDaePhase] = useState<string | null>(null);
  const [daeShockFunction, setDaeShockFunction] = useState<(() => void) | null>(null);

  const handleModeChange = useCallback(
    (mode: DisplayMode) => {
      defibrillator.actions.setDisplayMode(mode);
    },
    [defibrillator.actions],
  );

  const handleRotaryValueChange = (angle: number) => {
    const value = RotaryMappingService.mapRotaryToValue(angle);
    
    if (value === "DAE") {
      handleModeChange("DAE");
    } else if (value === "ARRET") {
      handleModeChange("ARRET");
    } else if (value === "Moniteur") {
      handleModeChange("Moniteur");
    } else if (value === "Stimulateur") {
      handleModeChange("Stimulateur");
    } else {
      defibrillator.actions.setmanualEnergy(value);
      handleModeChange("Manuel");
    }
  };

  const handleChargeButtonClick = () => defibrillator.actions.startCharging();

  const handleShockButtonClick = () => {
    if (defibrillator.displayMode === "DAE") {
      if (daeShockFunction) daeShockFunction();
    } else {
      defibrillator.actions.deliverShock();
    }
  };

  const handleSynchroButtonClick = () => {
    defibrillator.actions.toggle('synchro');
  };

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
  const handleStimulatorStartButton = () => defibrillator.actions.toggle('pacing');
  const handleCancelChargeButton = () => defibrillator.actions.cancelCharge();
  const handleMonitorMenuButton = () => monitorDisplayRef.current?.triggerMenu();

  // --- DAE Callbacks ---
  const handleDaePhaseChange = useCallback((phase: string) => setDaePhase(phase), []);

  // --- Rendering Screen Content ---
  const renderScreenContent = () => {
    const { is_booting: isBooting } = defibrillator.device;
    const { bootProgress, bootTargetMode } = (defibrillator as any).device;

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
              <div className="mt-2">Passage en mode {bootTargetMode}</div>
            </div>
          </div>
        </div>
      );
    }

    const timerProps = {
      minutes: timer.minutes,
      seconds: timer.seconds,
      totalSeconds: timer.totalSeconds,
    };



    switch (defibrillator.displayMode) {
      case "ARRET":
        return <ARRETDisplay />;
      case "DAE":
        return (
          <DAEDisplay
            timerProps={timerProps}
            device={defibrillator.device}
            patient={defibrillator.patient}
            actions={defibrillator.actions}
            chargeProgress={(defibrillator as any).chargeProgress || 0}
            onPhaseChange={handleDaePhaseChange}
            onShockReady={setDaeShockFunction}
            onElectrodePlacementValidated={() => {
                electrodeValidation.validateElectrodes();
                emit("stepValidated");
            }}
          />
        );
      case "Moniteur":
        return (
          <MonitorDisplay
            ref={monitorDisplayRef}
            timerProps={timerProps}
            device={defibrillator.device}
            patient={defibrillator.patient}
            actions={defibrillator.actions}
          />
        );
      case "Stimulateur":
        return (
          <StimulateurDisplay
            ref={stimulateurDisplayRef}
            timerProps={timerProps}
            device={defibrillator.device}
            patient={defibrillator.patient}
            actions={defibrillator.actions}
          />
        );
      case "Manuel":
        return (
          <ManuelDisplay
            ref={manuelDisplayRef}
            timerProps={timerProps}
            device={defibrillator.device}
            patient={defibrillator.patient}
            actions={defibrillator.actions}
          />
        );
      default:
        return <ARRETDisplay />;
    }
  };

  const handleStartScenario = (scenarioId: string) => {
    const scenarioToStart = SCENARIOS.find(s => s.id === scenarioId);
    if (scenarioToStart) {
      scenarioPlayer.startScenario(scenarioToStart as any);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 overflow-hidden font-sans">
      <Header
        onStartScenario={handleStartScenario}
        onExitScenario={scenarioPlayer.stopScenario}
        currentRhythm={defibrillator.rhythmType as RhythmType}
        onRhythmChange={() => {}} // Disabled on student device
        heartRate={defibrillator.heartRate}
        onHeartRateChange={() => {}} // Disabled on student device
        isScenarioActive={scenarioPlayer.isScenarioActive}
        isComplete={scenarioPlayer.isComplete}
        scenarioTitle={scenarioPlayer.scenarioConfig?.title}
        currentStepNumber={
          scenarioPlayer.currentStep?.step != null
            ? scenarioPlayer.currentStep.step + 1
            : undefined
        }
        totalSteps={scenarioPlayer.scenarioConfig?.steps?.length}
        showStepNotifications={scenarioPlayer.showStepNotifications}
        onToggleStepNotifications={scenarioPlayer.toggleStepNotifications}
      />

      <div className="flex-1 p-2 md:p-4 lg:p-8 flex items-center justify-center mt-[-2vh]">
        <div className="w-full h-full max-h-[85vh] flex items-center justify-center">
          <div
            ref={containerRef}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "center center",
              transition: "transform 0.1s ease-out",
            }}
            className="w-[1024px] h-[768px] flex-shrink-0"
          >
            <DefibrillatorUI
              defibrillator={defibrillator}
              renderScreenContent={renderScreenContent}
              handleRotaryValueChange={handleRotaryValueChange}
              handleChargeButtonClick={handleChargeButtonClick}
              handleShockButtonClick={handleShockButtonClick}
              handleShockButtonPress={defibrillator.actions.handleShockButtonPress}
              handleShockButtonRelease={defibrillator.actions.handleShockButtonRelease}
              handleSynchroButtonClick={handleSynchroButtonClick}
              handleJoystickStepUp={handleJoystickStepUp}
              handleJoystickStepDown={handleJoystickStepDown}
              handleJoystickClick={handleJoystickClick}
              handleStimulatorSettingsButton={handleStimulatorSettingsButton}
              handleStimulatorMenuButton={handleStimulatorMenuButton}
              handleStimulatorStartButton={handleStimulatorStartButton}
              handleCancelChargeButton={handleCancelChargeButton}
              handleMonitorMenuButton={handleMonitorMenuButton}
              isShockButtonBlinking={defibrillator.device.isShockButtonBlinking}
              daePhase={daePhase}
            />
          </div>
        </div>
      </div>

      {scenarioPlayer.showStepNotifications && scenarioPlayer.currentStep && (
        <div className="fixed bottom-4 left-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg border border-gray-600 max-w-sm z-50">
          <h4 className="font-bold text-sm text-blue-400 mb-1">
            Étape {scenarioPlayer.currentStep.step + 1}
          </h4>
          <p className="text-sm">{scenarioPlayer.currentStep.description}</p>
        </div>
      )}
    </div>
  );
};

export default SimulatorPage;
