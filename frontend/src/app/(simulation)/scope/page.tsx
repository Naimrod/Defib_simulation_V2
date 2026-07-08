"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useVitals } from '../../hooks/useVitals';
import { AlarmBanner } from '../../components/AlarmBanner';
import { ToggleableValue } from '../../components/ToggleableValue';
import ECGWrapper from '../../components/graphsdata/ECGWrapper';
import PlethWrapper from '../../components/graphsdata/PlethWrapper';
import Co2Wrapper from '../../components/graphsdata/CO2Wrapper';
import { useAudio } from '../../context/AudioContext';
import { useWebSocket } from '../../context/WebSocketContext';
import styles from '../../styles/scope.module.css';

export default function App() {
    const { vitals, hasPulse, username, logout, startPNI } = useVitals();
    const { sendMessage, lastMessage } = useWebSocket();
    const audioService = useAudio();

    useEffect(() => {
        const timer = setTimeout(() => {
            sendMessage({ type: "request_sync" });
        }, 500); // Attendre que le WebSocket soit prêt
        return () => clearTimeout(timer);
    }, [sendMessage]);

    const [showECG, setShowECG] = useState(false);
    const [showPleth, setShowPleth] = useState(false);
    const [showCo2, setShowCo2] = useState(false);
    const [showBP, setShowBP] = useState(false);
    const [showPulse, setShowPulse] = useState(false);
    const [showFRVA, setShowFRVA] = useState(false);

    // PNI Audio Synchronization
    const prevIsPNIMeasuring = useRef(vitals.isPNIMeasuring);
    const prevLastAction = useRef<string | null>(null);

    useEffect(() => {
        if (vitals.isPNIMeasuring && !prevIsPNIMeasuring.current) {
            audioService.playCuffInflation?.();
        } else if (!vitals.isPNIMeasuring && prevIsPNIMeasuring.current) {
            audioService.stopCuffInflation?.();
        }

        if (lastMessage?.type === "defibrillator_action" && lastMessage?.action === "pni_done" && lastMessage?.action !== prevLastAction.current) {
            audioService.playBPDone?.();
        }

        prevIsPNIMeasuring.current = vitals.isPNIMeasuring;
        prevLastAction.current = lastMessage?.action || null;
    }, [vitals.isPNIMeasuring, audioService, lastMessage]);

    useEffect(() => {
        return () => {
            try { audioService.stopCuffInflation?.(); } catch {}
        };
    }, [audioService]);

    // Synchronisation avec l'état global du serveur (noms de variables corrigés !)
    useEffect(() => {
        if (vitals.isHRDotted !== undefined) setShowECG(!vitals.isHRDotted);
        if (vitals.isPressureDotted !== undefined) {
            setShowPleth(!vitals.isPressureDotted);
            setShowPulse(!vitals.isPressureDotted);
        }
        if (vitals.isCO2Dotted !== undefined) {
            setShowCo2(!vitals.isCO2Dotted);
            setShowFRVA(!vitals.isCO2Dotted);
        }
        if (vitals.isBPDotted !== undefined) setShowBP(!vitals.isBPDotted);
    }, [vitals.isHRDotted, vitals.isPressureDotted, vitals.isCO2Dotted, vitals.isBPDotted]);

    // Écouteur instantané pour l'injection venant de la tablette formateur
    useEffect(() => {
        if (!lastMessage) return;
        if (lastMessage.type === "visibility_state") {
            if (lastMessage.hrDotted !== undefined) setShowECG(!lastMessage.hrDotted);
            if (lastMessage.pressureDotted !== undefined) {
                setShowPleth(!lastMessage.pressureDotted);
                setShowPulse(!lastMessage.pressureDotted);
            }
            if (lastMessage.co2Dotted !== undefined) {
                setShowCo2(!lastMessage.co2Dotted);
                setShowFRVA(!lastMessage.co2Dotted);
            }
            if (lastMessage.bpDotted !== undefined) setShowBP(!lastMessage.bpDotted);
        }
    }, [lastMessage]);

    return (
        <div className={styles.scopeContainer}>

            {showECG && (
                <AlarmBanner rhythmType={vitals.rhythm as any} showFCValue={vitals.fcValue} heartRate={vitals.bpm} />
            )}

            <div className={styles.patientWidget}>
                <span>Patient: <strong>{username}</strong></span>
                <button className={styles.logoutButton} onClick={logout}>Logout</button>
            </div>

            <div className={styles.constant}>
                <div
                    className={styles.heartrate} 
                    onClick={() => { 
                        if (!vitals.isRemoteControl) {
                            setShowECG(prev => {
                                const nextVisibility = !prev;
                                sendMessage({ 
                                    type: "HRscope", 
                                    dataType: "scope", 
                                    isHRDotted: !nextVisibility 
                                });
                                return nextVisibility;
                            });
                        } 
                    }}
                    style={{ cursor: vitals.isRemoteControl ? 'default' : 'pointer' }}
                >
                    <div className={styles.graph}>
                        <ECGWrapper heartRate={vitals.bpm} rhythmType={vitals.rhythm as any} isRevealed={showECG} />
                    </div>
                    <h2 className={styles.graph_bounds}>130<br />50</h2>
                    <ToggleableValue value={vitals.bpm} className={styles.graph_value} isHidden={!showECG} />
                </div>
            </div>

            <div className={styles.constant}>
                <div
                    className={styles.spo2}
                    onClick={() => { 
                        if (!vitals.isRemoteControl) {
                            setShowPleth(prev => {
                                const nextVisibility = !prev;
                                sendMessage({ 
                                    type: "Prscope", 
                                    dataType: "scope",
                                    isPressureDotted: !nextVisibility
                                });
                                return nextVisibility;
                            });
                        } 
                    }}
                    style={{ cursor: vitals.isRemoteControl ? 'default' : 'pointer' }}
                >
                    <div className={styles.graph}>
                        <PlethWrapper spo2={vitals.spo2} heartRate={vitals.bpm} isRevealed={showPleth} />
                    </div>
                    <h2 className={styles.graph_bounds}>100<br />90</h2>
                    <ToggleableValue value={`${vitals.spo2}%`} className={styles.graph_value} isHidden={!showPleth} />
                </div>
            </div>

            <div className={styles.constant}>
                <div
                    className={styles.co2}
                    onClick={() => { 
                        if (!vitals.isRemoteControl) {
                            setShowCo2(prev => {
                                const nextVisibility = !prev;
                                sendMessage({ 
                                    type: "COscope", 
                                    dataType: "scope", 
                                    isCO2Dotted: !nextVisibility 
                                });
                                return nextVisibility;
                            });
                        } 
                    }}
                    style={{ cursor: vitals.isRemoteControl ? 'default' : 'pointer' }}
                >
                    <div className={styles.graph}>
                        <Co2Wrapper co2={vitals.co2} respirationRate={vitals.resp} isRevealed={showCo2} />
                    </div>
                    <h2 className={styles.graph_bounds}>65<br />25</h2>
                    <ToggleableValue value={vitals.co2} className={styles.graph_value} isHidden={!showCo2} />
                </div>
            </div>

            <div className={styles.bottomRow}>
                <div 
                    className={styles.pressure}
                    onClick={() => {
                        if (vitals.isRemoteControl) {
                            // Remote Control ON: L'étudiant ne peut pas afficher/cacher, juste mesurer
                            if (showBP) {
                                startPNI();
                            }
                        } else {
                            // Remote Control OFF: Comportement libre
                            if (!showBP) {
                                setShowBP(true);
                                sendMessage({
                                    type: "visibility_state",
                                    bpDotted: false 
                                });
                            }
                            startPNI();
                        }
                    }}
                    style={{ cursor: (!vitals.isRemoteControl || showBP) ? 'pointer' : 'default' }}
                >
                    <h2 className={styles.vitalLabel}>TA</h2>
                    <div className={styles.valueRow}>
                        <h2 className={styles.bounds}>160<br />90</h2>
                        <ToggleableValue 
                            value={vitals.bpDisplay || "--/--"} 
                            className={styles.graph_value} 
                            isHidden={!hasPulse || (!showBP && !vitals.isPNIMeasuring)} 
                        />
                    </div>
                </div>

                <div 
                    className={styles.pouls}
                    onClick={() => {
                        if (!vitals.isRemoteControl) setShowPulse(prev => !prev);
                    }}
                    style={{ cursor: vitals.isRemoteControl ? 'default' : 'pointer' }}
                >
                    <h2 className={styles.vitalLabel}>Pouls</h2>
                    <div className={styles.valueRow}>
                        <h2 className={styles.bounds}>120<br />50</h2>
                        <ToggleableValue value={vitals.pouls} className={styles.value} isHidden={!hasPulse || !showPulse}/>
                    </div>
                </div>

                <div 
                    className={styles.frequency}
                    onClick={() => {
                        if (!vitals.isRemoteControl) setShowFRVA(prev => !prev);
                    }}
                    style={{ cursor: vitals.isRemoteControl ? 'default' : 'pointer' }}
                >
                    <h2 className={styles.vitalLabel}>FRVA</h2>
                    <div className={styles.valueRow}>
                        <h2 className={styles.bounds}>30<br />8</h2>
                        <ToggleableValue value={vitals.resp} className={styles.value} isHidden={!hasPulse || !showFRVA}/>
                    </div>
                </div>
            </div>
        </div>
    );
}