"use client";
import React, { useState } from 'react';
import { useVitals } from '../../hooks/useVitals';
import { AlarmBanner } from '../../components/AlarmBanner';
import { ToggleableValue } from '../../components/ToggleableValue';
import ECGWrapper from '../../components/graphsdata/ECGWrapper';
import PlethWrapper from '../../components/graphsdata/PlethWrapper';
import CO2Wrapper from '../../components/graphsdata/CO2Wrapper';
import { AudioProvider } from '../../context/AudioContext';

import styles from '../../styles/scope.module.css';

export default function App() {
    const { vitals, username, logout } = useVitals();

    const [showECG, setShowECG] = useState(false);
    const [showPleth, setShowPleth] = useState(false);
    const [showCo2, setShowCo2] = useState(false);

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
                        onClick={() => setShowECG(vitals.isHRDotted)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className={styles.graph}>
                            <ECGWrapper heartRate={vitals.bpm} rhythmType={vitals.rhythm as any} isRevealed={!vitals.isHRDotted} />
                        </div>
                        <h2 className={styles.graph_bounds}>130<br />50</h2>
                        <ToggleableValue value={vitals.bpm} className={styles.graph_value} isHidden={vitals.isHRDotted} />
                    </div>
                </div>

                <div className={styles.constant}>
                    <div
                        className={styles.spo2}
                        onClick={() => setShowPleth(vitals.isPressureDotted)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className={styles.graph}>
                            <PlethWrapper spo2={vitals.spo2} heartRate={vitals.bpm} isRevealed={!vitals.isPressureDotted} />
                        </div>
                        <h2 className={styles.graph_bounds}>100<br />90</h2>
                        <ToggleableValue value={`${vitals.spo2}%`} className={styles.graph_value} isHidden={vitals.isPressureDotted} />
                    </div>
                </div>

                <div className={styles.constant}>

                    <div
                        className={styles.co2}
                        onClick={() => setShowCo2(vitals.isCO2Dotted)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className={styles.graph}>
                            <CO2Wrapper co2={vitals.co2} respirationRate={vitals.resp} isRevealed={!vitals.isCO2Dotted} />
                        </div>
                        <h2 className={styles.graph_bounds}>65<br />25</h2>
                        <ToggleableValue value={vitals.co2} className={styles.graph_value} isHidden={vitals.isCO2Dotted} />
                    </div>
                </div>

                <div className={styles.constant}>
                    <div className={styles.pressure}>
                        <h2 style={{ margin: 0, fontSize: '1.2em' }}>TA</h2>
                        <div className={styles.valueRow}>
                            <h2 className={styles.bounds} style={{ color: 'rgb(255, 0, 0)', margin: 0 }}>160<br />90</h2>
                            <ToggleableValue value={`${vitals.systolic}/${vitals.diastolic}`} className={styles.value} />
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