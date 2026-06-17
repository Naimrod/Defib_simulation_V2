import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { SCENARIOS } from '../data/scenarios';

export interface ScenarioStep {
    step: number;
    description: string;
    validation: any;
}

export interface ScenarioConfig {
    id: string;
    title: string;
    description: string;
    initialState: any;
    steps: ScenarioStep[];
}

export const useScenarioPlayer = (
    defibrillator: any 
) => {
    const { lastMessage, sendMessage } = useWebSocket();
    const [scenarioConfig, setScenarioConfig] = useState<ScenarioConfig | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [failureMessage, setFailureMessage] = useState<string | null>(null);
    const [showStepNotifications, setShowStepNotifications] = useState(false);

    // --- Authoritative Sync Listener ---
    useEffect(() => {
        if (!lastMessage) return;
        const msg = lastMessage as any;

        if (msg.type === "scenario") {
            if (msg.action === "start") {
                const config = SCENARIOS.find(s => s.id === msg.scenario_id);
                if (config) {
                    setScenarioConfig(config as any);
                    setIsActive(true);
                    setIsComplete(false);
                    setCurrentStepIndex(0);
                    setShowStepNotifications(true);
                    setFailureMessage(null);
                }
            } else if (msg.action === "advance") {
                setCurrentStepIndex(msg.step);
            } else if (msg.action === "stop") {
                setIsActive(false);
                setIsComplete(false);
                setScenarioConfig(null);
                setShowStepNotifications(false);
            } else if (msg.action === "complete") {
                setIsComplete(true);
            } else if (msg.action === "fail") {
                setFailureMessage(msg.message || "Le scénario a échoué.");
                setIsActive(false);
            }
        }
    }, [lastMessage]);

    const toggleStepNotifications = useCallback(() => {
        setShowStepNotifications(prev => !prev);
    }, []);

    const startScenario = (config: ScenarioConfig) => {
        if (!config) return;
        // Simply request the backend to start it
        sendMessage({
            type: "scenario",
            action: "start",
            scenario_id: config.id
        });
    };

    const stopScenario = () => {
        sendMessage({
            type: "scenario",
            action: "stop"
        });
    };

    return {
        isScenarioActive: isActive,
        currentStep: scenarioConfig?.steps?.[currentStepIndex],
        scenarioConfig,
        isComplete,
        failureMessage,
        showStepNotifications,
        toggleStepNotifications,
        startScenario,
        stopScenario,
    };
};
