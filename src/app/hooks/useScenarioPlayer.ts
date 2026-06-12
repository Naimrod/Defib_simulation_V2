import { useState, useEffect, useRef, useCallback } from 'react';
import { DefibrillatorState } from './useDefibrillator';
import { RhythmType } from '../components/graphsdata/ECGRhythms';
import { NotificationService } from '../services/NotificationService';

//modifcodeSam
import { on, off, emit } from "@/lib/eventBus"; 
//modifcodeSam




// --- Type Definitions for Scenario JSON ---

interface ValidationCondition {
    type: 'stateChange' | 'event' | 'timeout';
    property?: keyof DefibrillatorState;
    value?: any;
    eventName?: string;
    duration?: number;
}

interface Constraint {
    property: keyof DefibrillatorState;
    mustBe?: any;
    mustNotBe?: any;
    failMessage?: string;
}

interface OnCompleteAction {
    action: 'updateState';
    payload: Partial<DefibrillatorState>;
    delay?: number;
}

export interface ScenarioStep {
    step: number;
    description: string;
    validation: {
        all_of?: ValidationCondition[];
        any_of?: ValidationCondition[];
    } & ValidationCondition;
    constraints?: Constraint[];
    onComplete?: OnCompleteAction[];
}

export interface ScenarioConfig {
    id: string;
    title: string;
    description: string;
    initialState: Partial<DefibrillatorState>;
    steps: ScenarioStep[];
}


const reverseRhythmMap: Record<string, string> = {
  "sinus": "sinusal",
  "fibrillationVentriculaire": "fv",
  "tachycardieVentriculaire": "tv_1",
  "asystole": "asysto",
  "fibrillationAtriale": "fib_a",
  "choc": "choc",
  "bav3": "3_bav"
};




export const useScenarioPlayer = (
    defibrillator: DefibrillatorState & { [key: string]: Function },
    syncVitalsToBackend?: (bpm: number, spo2: number, rhythmCode: string) => void,
    sendActionToBackend?: (actionType:string, payload?: any) => void
) => {
    const [scenarioConfig, setScenarioConfig] = useState<ScenarioConfig | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [failureMessage, setFailureMessage] = useState<string | null>(null);
    const [showStepNotifications, setShowStepNotifications] = useState(false); // New state for visibility

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const timeoutCompletedEvent = "timeoutCompleted";
    
    
    //modifcodeSam
const advanceStep = useCallback(() => {
  if (!scenarioConfig) return;

  const nextIndex = currentStepIndex + 1;

  if (nextIndex >= scenarioConfig.steps.length) {
    setIsComplete(true);
  } else {
    setCurrentStepIndex(nextIndex);
  }
}, [scenarioConfig, currentStepIndex]);


useEffect(() => {
  const handleStepValidated = () => {
    advanceStep(); // Fonction qui passe à l’étape suivante
  };

  on("stepValidated", handleStepValidated);

  return () => {
    off("stepValidated", handleStepValidated); // Nettoyage
  };
}, [advanceStep]);
//ModifcodeSam

    // --- Core Validation Logic ---

    const isConditionMet = useCallback((condition: ValidationCondition, defibState: DefibrillatorState): boolean => {
        switch (condition.type) {
            case 'stateChange':
                return condition.property ? defibState[condition.property] === condition.value : false;
            case 'event':
                return defibState.lastEvent === condition.eventName;
            case 'timeout':
                return defibState.lastEvent === timeoutCompletedEvent;
            default:
                return false;
        }
    }, []);

    const areStepConditionsMet = useCallback((step: ScenarioStep, defibState: DefibrillatorState): boolean => {
        if (step.validation.all_of) {
            return step.validation.all_of.every(cond => isConditionMet(cond, defibState));
        }
        if (step.validation.any_of) {
            return step.validation.any_of.some(cond => isConditionMet(cond, defibState));
        }
        return isConditionMet(step.validation, defibState);
    }, [isConditionMet]);


    // --- Main Scenario Engine ---
    useEffect(() => {
        if (!isActive || !scenarioConfig || isComplete || failureMessage) {
            return;
        }

        if (defibrillator.lastEvent) {
            console.log("Scenario Player Detected Event:", defibrillator.lastEvent);
        }

        const activeStep = scenarioConfig.steps[currentStepIndex];
        if (!activeStep) return;

        if (activeStep.constraints) {
            for (const constraint of activeStep.constraints) {
                let violated = false;
                if (constraint.mustBe !== undefined && defibrillator[constraint.property] !== constraint.mustBe) violated = true;
                if (constraint.mustNotBe !== undefined && defibrillator[constraint.property] === constraint.mustNotBe) violated = true;
                if (violated) {
                    setFailureMessage(constraint.failMessage || "Scenario failed due to a critical error.");
                    setIsActive(false);
                    return;
                }
            }
        }

        if (areStepConditionsMet(activeStep, defibrillator)) {
            if (activeStep.onComplete) {
                activeStep.onComplete.forEach(task => {
                    if (task.action === 'updateState') {
                        
                        // Create a wrapper that updates React AND sends the WebSocket message
                        const applyUpdateAndSync = () => {
                            // 1. Update the local React screen
                            defibrillator.updateState(task.payload);

                            // If the scenario tells us to show a shock, broadcast
                            if (task.payload.rhythmType === 'choc' && sendActionToBackend) {
                                sendActionToBackend("Choc délivré", {mode: "Scenario_Automated"});
                            }

                            // 2. If the payload contains heart info, sync it to the control panel
                            if (syncVitalsToBackend && (task.payload.rhythmType || task.payload.heartRate !== undefined)) {
                                
                                // Get the new values (or fallback to current state if only one changed)
                                const newRhythm = task.payload.rhythmType || defibrillator.rhythmType;
                                const newHR = task.payload.heartRate !== undefined ? task.payload.heartRate : defibrillator.heartRate;
                                const newSpo2 = 98; // Defaulting to 98 since SpO2 isn't in DefibrillatorState
                                
                                const htmlRhythmCode = reverseRhythmMap[newRhythm as string] || newRhythm;

                                syncVitalsToBackend(newHR, newSpo2, htmlRhythmCode as string);
                            }
                        };

                        // 3. Execute it immediately, or wait for the delay
                        if (task.delay) {
                            setTimeout(applyUpdateAndSync, task.delay);
                        } else {
                            applyUpdateAndSync();
                        }
                    }
                });
            }

            const nextStepIndex = currentStepIndex + 1;
            if (nextStepIndex >= scenarioConfig.steps.length) {
                setIsComplete(true);
            } else {
                setCurrentStepIndex(nextStepIndex);
            }
        }

    }, [defibrillator, scenarioConfig, isActive, currentStepIndex, isComplete, failureMessage, areStepConditionsMet]);


    // Effect to handle 'timeout' type validations.
    useEffect(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (!isActive || !scenarioConfig) return;

        const step = scenarioConfig.steps[currentStepIndex];
        if (!step) return;

        const timeoutCondition =
            step.validation.type === 'timeout' ? step.validation :
                step.validation.all_of?.find(c => c.type === 'timeout') ||
                step.validation.any_of?.find(c => c.type === 'timeout');

        if (timeoutCondition && timeoutCondition.duration) {
            timeoutRef.current = setTimeout(() => {
                defibrillator.updateState({ lastEvent: timeoutCompletedEvent });
            }, timeoutCondition.duration);
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [currentStepIndex, isActive, scenarioConfig, defibrillator]);


    const toggleStepNotifications = useCallback(() => {
        setShowStepNotifications(prev => !prev);
    }, []);

    const startScenario = (config: ScenarioConfig) => {
        setScenarioConfig(config);

        defibrillator.updateState({
            displayMode: "ARRET",
            lastEvent: null,
            isCharging: false,
            isCharged: false,
            chargeProgress: 0,
            shockCount: 0
        });

        defibrillator.updateState(config.initialState);

        setCurrentStepIndex(0);
        setIsComplete(false);
        setFailureMessage(null);
        setIsActive(true);
        setShowStepNotifications(false); // Ensure notifications are hidden by default
    };

    const stopScenario = () => {
        setIsActive(false);
        setIsComplete(false);
        setFailureMessage(null);
        setScenarioConfig(null);
        setShowStepNotifications(false); // Reset on stop
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    };

    return {
        isScenarioActive: isActive,
        currentStep: scenarioConfig?.steps[currentStepIndex],
        scenarioConfig,
        isComplete,
        failureMessage,
        showStepNotifications, // Export new state
        toggleStepNotifications, // Export new function
        startScenario,
        stopScenario,
    };
};
