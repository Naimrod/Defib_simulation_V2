"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWebSocket } from '../../context/WebSocketContext';
import stylesConnect from '../../styles/connect.module.css';
import stylesLoggedin from '../../styles/loggedin.module.css';

export default function ConnectPage() {
  const router = useRouter();
  const { sessionId } = useWebSocket();
  const [usernameInput, setUsernameInput] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [sessionUser, setSessionUser] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
    setSessionUser(localStorage.getItem('username'));
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim()) {
      localStorage.setItem('username', usernameInput.trim());
      // Force page reload to initialize the WebSocket session with the new identity in Layout
      window.location.href = `/connect?username=${encodeURIComponent(usernameInput.trim())}`;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('username');
    window.location.href = '/connect';
  };

  if (!isClient) return null; // Prevent SSR hydration mismatches

  // If user is not logged in
  if (!sessionUser || sessionUser === 'anonymous') {
    return (
      <div className={stylesConnect.container}>
        <h1>Outil d'entraînement aux techniques de défibrillation</h1>
        <div className={stylesConnect.loginCard}>
          <h2>Connectez-vous à une session</h2>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Tapez votre identifiant"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              required
            />
            <button type="submit">Se connecter</button>
          </form>
        </div>
      </div>
    );
  }

  // If user is logged in, show application dashboard / role selection
  return (
    <div className={stylesLoggedin.container}>
      {/* Top right user header */}
      <div className={stylesLoggedin.userHeader}>
        <span>User: <strong>{sessionUser}</strong></span>
        <button onClick={handleLogout} className={stylesLoggedin.logoutBtn}>Logout</button>
      </div>

      <h1>Sélectionnez votre rôle dans la simulation</h1>

      <div className={stylesLoggedin.menuContainer}>
        <div onClick={() => router.push(`/streamer?username=${sessionUser}`)} className={stylesLoggedin.menuCard}>
          <h2>🫀 Streamer ECG</h2>
          <p>TEST</p>
        </div>

        <div onClick={() => router.push(`/plotter?username=${sessionUser}`)} className={stylesLoggedin.menuCard}>
          <h2>📊 Plotter</h2>
          <p>TEST</p>
        </div>

        <div onClick={() => router.push(`/defibrillator?username=${sessionUser}`)} className={stylesLoggedin.menuCard}>
          <h2>⚡ Défibrillateur</h2>
          <p>Simulez des scénarios de défibrillation avec l'Efficia DFM100.</p>
        </div>

        <div onClick={() => router.push(`/control?username=${sessionUser}`)} className={stylesLoggedin.menuCard}>
          <h2>🎛️ Panneau de contrôle</h2>
          <p>Contrôlez manuellement l'état et les constantes vitales du patient.</p>
        </div>

        <div onClick={() => router.push(`/scope?username=${sessionUser}`)} className={stylesLoggedin.menuCard}>
          <h2>📈 Vue Scope</h2>
          <p>Visualisez les constantes vitales (ECG, SpO2, CO2, BP) en temps réel.</p>
        </div>

        <div onClick={() => router.push(`/dashboard?username=${sessionUser}`)} className={stylesLoggedin.menuCard}>
          <h2>📊 Dashboard</h2>
          <p>Suivez les logs, les actions et l'état général de la simulation.</p>
        </div>
      </div>
    </div>
  );
}