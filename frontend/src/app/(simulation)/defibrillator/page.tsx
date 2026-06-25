"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { useStopwatch } from "react-timer-hook";
import MonitorDisplay, { type MonitorDisplayRef } from "../../components/ScreenDisplay/MonitorDisplay";
import DAEDisplay from "../../components/ScreenDisplay/DAEDisplay";
import ARRETDisplay from "../../components/ScreenDisplay/ARRETDisplay";
import StimulateurDisplay, { type StimulateurDisplayRef } from "../../components/ScreenDisplay/StimulateurDisplay";
import ManuelDisplay, { type ManuelDisplayRef } from "../../components/ScreenDisplay/ManuelDisplay";
import { useDefibrillator } from "../../hooks/useDefibrillator";
import { useWebSocket } from "../../context/WebSocketContext";
import { useAlarms } from "../../hooks/useAlarms";
import { DisplayMode } from "@/types/simulation";
import { RotaryMappingService } from "../../services/RotaryMappingService";
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
  const { lastMessage } = useWebSocket();
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

  const [scenarioState, setScenarioState] = useState({
    isActive: false,
    currentStepIndex: 0,
    stepDescription: "" as string | null,
    totalSteps: 0,
    isComplete: false,
    showHints: false,
    failureMessage: null as string | null,
    scenarioId: null as string | null,
    title: "" as string | null,
  });

  // Authoritative Scenario Synchronization from Server
  useEffect(() => {
    if (!lastMessage) return;
    const msg = lastMessage as any;

    if (msg.type === "sync_state") {
      if (msg.scenario) {
        setScenarioState({
          isActive: true,
          currentStepIndex: msg.scenario.current_step,
          stepDescription: msg.scenario.step_description,
          totalSteps: msg.scenario.total_steps,
          isComplete: msg.scenario.is_complete,
          showHints: msg.scenario.show_hints || false,
          failureMessage: null,
          scenarioId: msg.scenario.scenario_id,
          title: msg.scenario.title,
        });
      } else {
        setScenarioState({
          isActive: false,
          currentStepIndex: 0,
          stepDescription: null,
          totalSteps: 0,
          isComplete: false,
          showHints: false,
          failureMessage: null,
          scenarioId: null,
          title: null,
        });
      }
    } else if (msg.type === "scenario") {
      if (msg.action === "start") {
        setScenarioState({
          isActive: true,
          currentStepIndex: 0,
          stepDescription: msg.step_description || "",
          totalSteps: msg.total_steps || 0,
          isComplete: false,
          showHints: msg.show_hints || false,
          failureMessage: null,
          scenarioId: msg.scenario_id,
          title: msg.title || "",
        });
      } else if (msg.action === "advance") {
        setScenarioState(prev => ({
          ...prev,
          currentStepIndex: msg.step,
          stepDescription: msg.step_description || "",
        }));
      } else if (msg.action === "toggle_hints") {
        setScenarioState(prev => ({
          ...prev,
          showHints: msg.show_hints || false,
        }));
      } else if (msg.action === "stop") {
        setScenarioState({
          isActive: false,
          currentStepIndex: 0,
          stepDescription: null,
          totalSteps: 0,
          isComplete: false,
          showHints: false,
          failureMessage: null,
          scenarioId: null,
          title: null,
        });
      } else if (msg.action === "complete") {
        setScenarioState(prev => ({
          ...prev,
          isComplete: true,
        }));
      } else if (msg.action === "fail") {
        setScenarioState(prev => ({
          ...prev,
          isActive: false,
          failureMessage: msg.message || "Le scénario a échoué.",
        }));
      }
    }
  }, [lastMessage]);

  // --- UI and Interaction State ---
  const [daePhase, setDaePhase] = useState<string | null>(null);
  const daeShockFunctionRef = useRef<(() => void) | null>(null);
  const handleDaeShockReady = useCallback((fn: any) => {
    if (typeof fn === "function") {
      const inner = fn();
      daeShockFunctionRef.current = typeof inner === "function" ? inner : fn;
    } else {
      daeShockFunctionRef.current = null;
    }
  }, []);

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
      if (daeShockFunctionRef.current) daeShockFunctionRef.current();
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

  const handleStimulatorSettingsButton = () => {
    console.log("page.tsx: handleStimulatorSettingsButton -> calling triggerReglagesStimulateur");
    stimulateurDisplayRef.current?.triggerReglagesStimulateur();
  };
  const handleStimulatorMenuButton = () => {
    console.log("page.tsx: handleStimulatorMenuButton -> calling triggerMenu");
    stimulateurDisplayRef.current?.triggerMenu();
  };
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
            onShockReady={handleDaeShockReady}
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


  return (
    <div className="flex flex-col min-h-screen bg-gray-900 overflow-hidden font-sans">
      <div className="flex-1 flex items-center justify-center h-screen w-screen overflow-hidden">
        <div className="w-full h-full flex items-center justify-center">
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

      {scenarioState.isActive && scenarioState.stepDescription && !scenarioState.isComplete && scenarioState.showHints && (
        <div className="fixed bottom-4 left-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg border border-gray-600 max-w-sm z-50">
          <h4 className="font-bold text-sm text-blue-400 mb-1">
            Étape {scenarioState.currentStepIndex + 1}
          </h4>
          <p className="text-sm">{scenarioState.stepDescription}</p>
        </div>
      )}

      {scenarioState.isComplete && scenarioState.showHints && (
        <div className="fixed bottom-4 left-4 bg-green-800 text-white p-4 rounded-lg shadow-lg border border-green-600 max-w-sm z-50 animate-bounce">
          <h4 className="font-bold text-sm text-green-300 mb-1">
            ✓ Scénario Terminé
          </h4>
          <p className="text-sm">Félicitations, vous avez complété toutes les étapes avec succès !</p>
        </div>
      )}
    </div>
  );
};

export default SimulatorPage;
