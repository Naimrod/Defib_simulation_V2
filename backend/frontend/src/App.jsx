import { useEffect, useState, useRef } from 'react';

// ============================================================================
// 1. COMPOSANT : DASHBOARD
// ============================================================================
const Dashboard = () => {
  const [sensors, setSensors] = useState({});

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8000/ws/dashboard");
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setSensors((prev) => ({ ...prev, [data.sensor_id]: data.message }));
    };
    return () => ws.close();
  }, []);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Live Medical Dashboard</h1>
      <div style={styles.grid}>
        {Object.entries(sensors).map(([sensorId, message]) => (
          <div key={sensorId} style={styles.cardLight}>
            <h2 style={styles.cardTitle}>Monitor: {sensorId.replace('_', ' ')}</h2>
            <div style={styles.data}>{message}</div>
            <div style={styles.status}>● Live Connection</div>
          </div>
        ))}
        {Object.keys(sensors).length === 0 && (
          <p style={{ color: '#7f8c8d', textAlign: 'center', width: '100%' }}>
            En attente des données des capteurs...
          </p>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 2. COMPOSANT : PANNEAU DE CONTRÔLE
// ============================================================================
const ControlPanel = () => {
  const ecgWs = useRef(null);
  const pressureWs = useRef(null);

  const [bpm, setBpm] = useState('');
  const [spo2, setSpo2] = useState('');
  const [bp, setBp] = useState('');

  useEffect(() => {
    ecgWs.current = new WebSocket("ws://127.0.0.1:8000/ws/sensor/ecg_sensor");
    pressureWs.current = new WebSocket("ws://127.0.0.1:8000/ws/sensor/pressure_sensor");

    return () => {
      ecgWs.current.close();
      pressureWs.current.close();
    };
  }, []);

  const sendECG = () => {
    if (bpm && spo2) {
      ecgWs.current.send(`BPM : ${bpm}, SpO2: ${spo2}%`);
    } else {
      alert("Veuillez entrer le BPM et la SpO2.");
    }
  };

  const sendPressure = () => {
    if (bp) {
      pressureWs.current.send(`BP : ${bp} mmHg`);
    } else {
      alert("Veuillez entrer une pression artérielle.");
    }
  };

  return (
    <div style={{ ...styles.page, backgroundColor: '#2c3e50', color: 'white' }}>
      <h1 style={{ ...styles.title, color: 'white' }}>Master Control Panel</h1>
      
      <div style={styles.grid}>
        <div style={styles.cardDark}>
          <h2 style={{ color: '#3498db', marginTop: 0 }}>ECG Simulator</h2>
          <label style={styles.label}>BPM (Heart Rate)</label>
          <input style={styles.input} type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} />
          <label style={styles.label}>SpO2 (%)</label>
          <input style={styles.input} type="number" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
          <button style={styles.button} onClick={sendECG}>Push ECG Data</button>
        </div>

        <div style={styles.cardDark}>
          <h2 style={{ color: '#3498db', marginTop: 0 }}>Pressure Simulator</h2>
          <label style={styles.label}>Blood Pressure (mmHg)</label>
          <input style={styles.input} type="text" value={bp} onChange={(e) => setBp(e.target.value)} />
          <button style={styles.button} onClick={sendPressure}>Push Pressure Data</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. COMPOSANT PRINCIPAL : LE ROUTEUR MANUEL
// ============================================================================
const App = () => {
  // On lit l'adresse web tapée par l'utilisateur
  const currentPath = window.location.pathname;

  // Si l'URL contient "/control", on affiche le panneau de contrôle
  if (currentPath === '/control') {
    return <ControlPanel />;
  }

  // Pour toutes les autres adresses (comme "/" ou une erreur), on affiche le Dashboard
  return <Dashboard />;
};

// ============================================================================
// STYLES CSS
// ============================================================================
const styles = {
  page: { padding: '30px', fontFamily: 'Segoe UI, Tahoma, sans-serif', backgroundColor: '#eef2f5', minHeight: '100vh', color: '#333' },
  title: { textAlign: 'center', color: '#2c3e50', marginBottom: '30px' },
  grid: { display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' },
  cardLight: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '300px', textAlign: 'center' },
  cardDark: { backgroundColor: '#34495e', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', width: '300px' },
  cardTitle: { marginTop: 0, color: '#7f8c8d', fontSize: '1.2em', textTransform: 'uppercase' },
  data: { fontSize: '1.8em', fontWeight: 'bold', color: '#e74c3c', marginTop: '15px' },
  status: { fontSize: '0.9em', color: '#2ecc71', marginTop: '10px' },
  label: { display: 'block', marginTop: '15px', fontWeight: 'bold', color: '#bdc3c7', fontSize: '14px' },
  input: { width: '100%', padding: '10px', marginTop: '5px', borderRadius: '5px', border: 'none', boxSizing: 'border-box' },
  button: { marginTop: '25px', width: '100%', padding: '12px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }
};

export default App;