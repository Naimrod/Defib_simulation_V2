"use client";
import React, { useState, useEffect } from 'react';
import { useVitals } from '../../hooks/useVitals';
import { AlarmBanner } from '../../components/AlarmBanner';
import { ToggleableValue } from '../../components/ToggleableValue';
import ECGWrapper from '../../components/graphsdata/ECGWrapper';
import PlethWrapper from '../../components/graphsdata/PlethWrapper';
import Co2Wrapper from '../../components/graphsdata/Co2Wrapper';
import { AudioProvider } from '../../context/AudioContext';

import styles from '../../styles/scope.module.css';

export default function App() {
    const { vitals, username, logout } = useVitals();

    const [showECG, setShowECG] = useState(false);
    const [showPleth, setShowPleth] = useState(false);
    const [showCo2, setShowCo2] = useState(false);
    useEffect(() => {
        if (vitals.isRemoteControl) {
            setShowECG(!vitals.isHRDotted);
            setShowPleth(!vitals.isPressureDotted);
            setShowCo2(!vitals.isCO2Dotted);
        }
    }, [vitals.isRemoteControl, vitals.isHRDotted, vitals.isPressureDotted, vitals.isCO2Dotted]);
    const displayECG = vitals.isRemoteControl ? !vitals.isHRDotted : showECG;
    const displayPleth = vitals.isRemoteControl ? !vitals.isPressureDotted : showPleth;
    const displayCo2 = vitals.isRemoteControl ? !vitals.isCO2Dotted : showCo2;

    return (
        <AudioProvider>
            <div className={styles.scopeContainer}>

                <AlarmBanner rhythmType={vitals.rhythm as any} showFCValue={vitals.fcValue} heartRate={vitals.bpm} />

                <div className={styles.patientWidget}>
                    <span>Patient: <strong>{username}</strong></span>
                    <button className={styles.logoutButton} onClick={logout}>Logout</button>
                </div>


                <div className={styles.constant}>
                    <div
                        className={styles.heartrate} 
    onClick={() => { 
    if (!vitals.isRemoteControl) setShowECG(prev => !prev); 
}}
    style={{ cursor: vitals.isRemoteControl ? 'default' : 'pointer' }}
                    >
                        <div className={styles.graph}>
                            <ECGWrapper heartRate={vitals.bpm} rhythmType={vitals.rhythm as any} isRevealed={displayECG} />
                        </div>
                        <h2 className={styles.graph_bounds}>130<br />50</h2>
                        <ToggleableValue value={vitals.bpm} className={styles.graph_value} isHidden={!displayECG} />
                    </div>
                </div>

                <div className={styles.constant}>
                    <div
                        className={styles.spo2}
                        onClick={() => { 
    if (!vitals.isRemoteControl) setShowPleth(prev => !prev); 
}}
                    style={{ cursor: vitals.isRemoteControl ? 'default' : 'pointer' }}
                    >
                        <div className={styles.graph}>
                            <PlethWrapper spo2={vitals.spo2} heartRate={vitals.bpm} isRevealed={displayPleth} />
                            </div>
                        <h2 className={styles.graph_bounds}>100<br />90</h2>
                        <ToggleableValue value={`${vitals.spo2}%`} className={styles.graph_value} isHidden={!displayPleth} />
                    </div>
                </div>

                <div className={styles.constant}>

                    <div
                        className={styles.co2}
                        onClick={() => { 
    if (!vitals.isRemoteControl) setShowCo2(prev => !prev); 
}}
                    style={{ cursor: vitals.isRemoteControl ? 'default' : 'pointer' }}
                    >
                        <div className={styles.graph}>
                            <Co2Wrapper co2={vitals.co2} respirationRate={vitals.resp} isRevealed={displayCo2} />
                        </div>
                        <h2 className={styles.graph_bounds}>65<br />25</h2>
                        <ToggleableValue value={vitals.co2} className={styles.graph_value} isHidden={!displayCo2} />
                </div>
                </div>

                <div className={styles.constant}>
                    <div className={styles.pressure}>
                        <h2 style={{ margin: 0, fontSize: '1.2em' }}>TA</h2>
                        <div className={styles.valueRow}>
                            <h2 className={styles.bounds} style={{ color: 'rgb(255, 0, 0)', margin: 0 }}>160<br />90</h2>
                            <ToggleableValue value={`${vitals.systolic}/${vitals.diastolic}`} className={styles.graph_value}/>
                        </div>
                    </div>
                    

                    <div style={{ flex: 1 }}></div>

                    <div className={styles.pouls}>
                        <h2 style={{ margin: 0, fontSize: '1.2em' }}>Pouls</h2>
                        <div className={styles.valueRow}>
                            <h2 className={styles.bounds} style={{ margin: 0 }}>120<br />50</h2>
                            <ToggleableValue value={vitals.pouls} className={styles.value} />
                        </div>
                    </div>

                    <div className={styles.frequency}>
                        <h2 style={{ margin: 0, fontSize: '1.2em' }}>FRVA</h2>
                        <div className={styles.valueRow}>
                            <h2 className={styles.bounds} style={{ margin: 0 }}>30<br />8</h2>
                            <ToggleableValue value={vitals.resp} className={styles.value} />
                        </div>
                    </div>
                    </div>
            </div>
        </AudioProvider>
    );
}