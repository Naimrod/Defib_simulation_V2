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

function EditableBound({ 
    value, 
    minLimit, 
    maxLimit, 
    onChange 
}: { 
    value: number, 
    minLimit: number, 
    maxLimit: number, 
    onChange: (val: number) => void 
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempVal, setTempVal] = useState(value);

    const validateAndSave = () => {
        let finalVal = tempVal;
        
        if (finalVal < minLimit) finalVal = minLimit;
        if (finalVal > maxLimit) finalVal = maxLimit;
        
        setTempVal(finalVal); 
        setIsEditing(false);
        onChange(finalVal);
    };

    const handleBlur = () => validateAndSave();

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') validateAndSave();
    };

    // Synchronisation si le composant parent met à jour la valeur pendant qu'on n'édite pas
    useEffect(() => {
        setTempVal(value);
    }, [value]);

    if (isEditing) {
        return (
            <input
                type="number"
                value={tempVal}
                min={minLimit}
                max={maxLimit}
                onChange={(e) => setTempVal(Number(e.target.value))}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                autoFocus
                style={{ 
                    width: "45px", 
                    background: "rgba(0,0,0,0.8)", 
                    color: "white", 
                    textAlign: "center", 
                    fontSize: "inherit", 
                    fontFamily: "inherit",
                    outline: "none"
                }}
            />
        );
    }

    return (
        <span 
            onClick={() => setIsEditing(true)} 
            style={{ cursor: "pointer", paddingBottom: "2px" }} 
            title={`Limite: ${minLimit-1} à ${maxLimit}`}
        >
            {value}
        </span>
    );
}

export default function App() {
    const { vitals, hasPulse, username, logout, startPNI, isScopeSpo2Alarm: _unused, isScopeCo2Alarm } = useVitals();
    const { activeDevices, sendMessage, sessionId, lastMessage, connectionRejected, rejectionMessage } = useWebSocket();
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
    const [ecgBounds, setEcgBounds] = useState({ max: 130, min: 50 });
    const [spo2Bounds, setSpo2Bounds] = useState({ max: 100, min: 90 });
    const [co2Bounds, setCo2Bounds] = useState({ max: 65, min: 25 });
    const [bpBounds, setBpBounds] = useState({ max: 160, min: 90 });
    const [frvaBounds, setFrvaBounds] = useState({ max: 30, min: 8 });

    const isScopeSpo2Alarm = showPleth && (vitals.cosmeticSpo2 < spo2Bounds.min);
    const isScopeRespAlarm = showFRVA && (vitals.cosmeticResp < frvaBounds.min || vitals.cosmeticResp >= frvaBounds.max);

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

    
    // SpO2 alarm audio sequence is now managed inside the AlarmBanner component via useAlarms hook

    const prevIsScopeCo2Alarm = useRef(isScopeCo2Alarm);
    useEffect(()=> {
        if (isScopeCo2Alarm && !prevIsScopeCo2Alarm.current) {
            audioService.startSpo2AlarmSequence?.();
        } else if (!isScopeCo2Alarm && prevIsScopeCo2Alarm.current) {
            audioService.stopSpo2AlarmSequence?.();
        }
        prevIsScopeCo2Alarm.current = isScopeCo2Alarm;

        return () => {
            try { audioService.stopSpo2AlarmSequence?.(); } catch {}
        };
    }, [isScopeCo2Alarm, audioService])

    useEffect(() => {
    // Liaison : FRVA -> ECG (BPM)
    if (vitals.isHRDotted !== undefined) {
        const isECGVisible = !vitals.isHRDotted;
        setShowECG(isECGVisible);
        setShowFRVA(isECGVisible); 
    }
    
    // Liaison : Pouls -> SpO2 (Pleth)
    if (vitals.isPressureDotted !== undefined) {
        const isPlethVisible = !vitals.isPressureDotted;
        setShowPleth(isPlethVisible);
        setShowPulse(isPlethVisible);
    }
    
    if (vitals.isCO2Dotted !== undefined) {
        setShowCo2(!vitals.isCO2Dotted); 
    }
    
    if (vitals.isBPDotted !== undefined) {
        setShowBP(!vitals.isBPDotted);
    }
}, [vitals.isHRDotted, vitals.isPressureDotted, vitals.isCO2Dotted, vitals.isBPDotted]);

useEffect(() => {
    if (!lastMessage) return;
    
    if (lastMessage.type === "visibility_state") {
        // Applique la liaison : FRVA -> ECG
        if (lastMessage.hrDotted !== undefined) {
            const isECGVisible = !lastMessage.hrDotted;
            setShowECG(isECGVisible);
            setShowFRVA(isECGVisible);
        }
        
        // Applique la liaison : Pouls -> SpO2
        if (lastMessage.pressureDotted !== undefined) {
            const isPlethVisible = !lastMessage.pressureDotted;
            setShowPleth(isPlethVisible);
            setShowPulse(isPlethVisible);
        }
        
        if (lastMessage.co2Dotted !== undefined) {
            setShowCo2(!lastMessage.co2Dotted);
        }
        
        if (lastMessage.bpDotted !== undefined) {
            setShowBP(!lastMessage.bpDotted);
        }
    }
}, [lastMessage]);

    if (connectionRejected) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#1a1a2e', color: 'white', flexDirection: 'column', gap: '20px' }}>
        <div style={{ fontSize: '1.5em', color: '#ff4444', fontWeight: 'bold' }}>⛔ Accès refusé</div>
        <div style={{ color: '#ccc', textAlign: 'center', maxWidth: '400px' }}>
          {rejectionMessage || "Un scope est déjà actif pour cette session."}
        </div>
      </div>
    );
  }

    return (
        <div className={styles.scopeContainer}>

            <div className={styles.alarmBannerContainer}>
                {showECG && (
                    <AlarmBanner 
                        rhythmType={vitals.rhythm as any} 
                        showFCValue={showECG} 
                        heartRate={vitals.cosmeticBpm}
                        minBpm={ecgBounds.min}
                        maxBpm={ecgBounds.max}
                        targetHR={vitals.bpm}
                    />
                )}
                <AlarmBanner 
                    type="spo2" 
                    showPleth={showPleth} 
                    cosmeticSpo2={vitals.cosmeticSpo2}
                    minSpo2={spo2Bounds.min}
                    maxSpo2={spo2Bounds.max}
                />
                <AlarmBanner 
                    type="resp" 
                    showResp={showFRVA} 
                    cosmeticResp={vitals.cosmeticResp}
                    minResp={frvaBounds.min}
                    maxResp={frvaBounds.max}
                />
            </div>

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
                        <ECGWrapper heartRate={vitals.bpm} rhythmType={vitals.rhythm as any} isRevealed={showECG} shockTimestamp={vitals.shockTimestamp}/>
                    </div>
                    <h2 className={styles.graph_bounds}>
                        <EditableBound 
                            value={ecgBounds.max} 
                            minLimit={ecgBounds.min + 1} 
                            maxLimit={300}
                            onChange={(v) => setEcgBounds(prev => ({ ...prev, max: v }))} 
                        /><br />
                        <EditableBound 
                            value={ecgBounds.min} 
                            minLimit={0}                 
                            maxLimit={ecgBounds.max - 1}
                            onChange={(v) => setEcgBounds(prev => ({ ...prev, min: v }))} 
                        />
                    </h2>
                    <ToggleableValue value={vitals.cosmeticBpm} className={styles.graph_value} isHidden={!showECG} />
                </div>
            </div>

            <div className={styles.constant}>
                <div
                    className={`${styles.spo2}${isScopeSpo2Alarm ? ` ${styles.spo2Alarm}` : ''}`}
                    onClick={() => { 
                        if (!vitals.isRemoteControl) {
                            setShowPleth(prev => {
                                const nextVisibility = !prev;
                                setShowPulse(nextVisibility);
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
                    <h2 className={styles.graph_bounds}>
                        <EditableBound 
                            value={spo2Bounds.max} 
                            minLimit={spo2Bounds.min + 1} 
                            maxLimit={100}               // Limite absolue (100%)
                            onChange={(v) => setSpo2Bounds(prev => ({ ...prev, max: v }))} 
                        /><br />
                        <EditableBound 
                            value={spo2Bounds.min} 
                            minLimit={0} 
                            maxLimit={spo2Bounds.max - 1} 
                            onChange={(v) => setSpo2Bounds(prev => ({ ...prev, min: v }))} 
                        />
                    </h2>
                    <ToggleableValue value={`${vitals.cosmeticSpo2}%`} className={styles.graph_value} isHidden={!showPleth} />
                </div>
            </div>

            <div className={styles.constant}>
                <div
                    className={`${styles.co2}${isScopeRespAlarm ? ` ${styles.co2Alarm}` : ''}`}
                    onClick={() => {
                        if (!vitals.isRemoteControl) {
                            setShowFRVA(prev => !prev); 
                        } 
                    }}
                    style={{ cursor: vitals.isRemoteControl ? 'default' : 'pointer' }}
                >
                    <div className={styles.graph}>
                        <Co2Wrapper 
                        co2={vitals.co2} 
                        respirationRate={vitals.resp} 
                        isRevealed={showFRVA}
                        />
                    </div>
                    <h2 className={styles.graph_bounds}>
                        <EditableBound 
                            value={frvaBounds.max} 
                            minLimit={frvaBounds.min + 1} 
                            maxLimit={100}               
                            onChange={(v) => setFrvaBounds(prev => ({ ...prev, max: v }))} 
                        /><br />
                        <EditableBound 
                            value={frvaBounds.min} 
                            minLimit={0} 
                            maxLimit={frvaBounds.max - 1}
                            onChange={(v) => setFrvaBounds(prev => ({ ...prev, min: v }))} 
                        />
                    </h2>
                    <ToggleableValue value={vitals.resp} className={styles.graph_value} isHidden={!showFRVA}/>
                </div>
            </div>

            <div className={styles.bottomRow}>
                <div className={styles.pressure}>
                    <h2 className={styles.vitalLabel}>TA</h2>
                    <div className={styles.valueRow}>
                        <h2 className={styles.graph_bounds}>
                        <EditableBound 
                            value={bpBounds.max} 
                            minLimit={bpBounds.min + 1} 
                            maxLimit={200}                // Limite absolue TA
                            onChange={(v) => setBpBounds(prev => ({ ...prev, max: v }))} 
                        /><br />
                        <EditableBound 
                            value={bpBounds.min} 
                            minLimit={0} 
                            maxLimit={bpBounds.max - 1} 
                            onChange={(v) => setBpBounds(prev => ({ ...prev, min: v }))} 
                        />
                    </h2>
                    <div 
                    
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
                        <ToggleableValue 
                            value={vitals.bpDisplay || "--/--"} 
                            className={styles.graph_value} 
                            isHidden={!hasPulse || (!showBP && !vitals.isPNIMeasuring)} 
                        />
                    </div>
                </div>
                </div>

                <div 
                    className={styles.pouls}
                    onClick={() => {
                        if (!vitals.isRemoteControl) {
                            setShowPulse(prev => {
                                const nextVisibility = !prev;
                                setShowPleth(nextVisibility); 
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
                    <h2 className={styles.vitalLabel}>Pouls</h2>
                <div className={styles.valueRow}>
                    <h2 className={styles.graph_bounds}>
                        <EditableBound 
                            value={ecgBounds.max} 
                            minLimit={ecgBounds.min + 1} 
                            maxLimit={300}
                            onChange={(v) => setEcgBounds(prev => ({ ...prev, max: v }))} 
                        /><br />
                        <EditableBound 
                            value={ecgBounds.min} 
                            minLimit={0}                 
                            maxLimit={ecgBounds.max - 1}
                            onChange={(v) => setEcgBounds(prev => ({ ...prev, min: v }))} 
                        />
                    </h2>
                    
                    
                        <ToggleableValue value={vitals.cosmeticPouls} className={styles.value} isHidden={!hasPulse || !showPulse}/>
                    </div>
                </div>

                <div 
                    className={styles.frequency}
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
                    <h2 className={styles.vitalLabel}>CO2</h2>
                    <div className={styles.valueRow}>
                        <h2 className={styles.graph_bounds}>
                        <EditableBound 
                            value={co2Bounds.max} 
                            minLimit={co2Bounds.min + 1} 
                            maxLimit={150}
                            onChange={(v) => setCo2Bounds(prev => ({ ...prev, max: v }))} 
                        /><br />
                        <EditableBound 
                            value={co2Bounds.min} 
                            minLimit={0}                 
                            maxLimit={co2Bounds.max - 1}
                            onChange={(v) => setCo2Bounds(prev => ({ ...prev, min: v }))} 
                        />
                    </h2>
                        <ToggleableValue value={vitals.cosmeticCo2} className={styles.value} isHidden={!hasPulse || !showCo2}/>
                    </div>
                </div>
            </div>
        </div>
    );
}