"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWebSocket } from '../../context/WebSocketContext';
import PageHeader from '../../components/PageHeader';
import { useTheme } from "../../hooks/useTheme";
import { Sun, Moon, Clock } from "lucide-react";

export default function ConnectPage() {
  const router = useRouter();
  const { sessionId } = useWebSocket();
  const { theme, isTimeLocked, toggleTheme, lockToSystemTime } = useTheme();
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
    setSessionUser(null);
    window.location.href = '/connect';
  };

  if (!isClient) return null; // Prevent SSR hydration mismatches

  // If user is not logged in
  if (!sessionUser || sessionUser === 'anonymous') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-zinc-100 p-6 font-sans relative">
        <div className="absolute top-4 right-4 flex items-center gap-1 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800 shadow-md">
          <button
            onClick={toggleTheme}
            aria-label="Changer le thème"
            className="p-1 hover:bg-zinc-800 text-zinc-200 rounded transition-colors cursor-pointer"
            title={theme === "dark" ? "Mode Sombre actif (cliquer pour basculer)" : "Mode Clair actif (cliquer pour basculer)"}
          >
            {theme === "dark" ? <Moon className="w-3.5 h-3.5 text-blue-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
          </button>
          <button
            onClick={lockToSystemTime}
            aria-label="Synchroniser avec l'heure système"
            className={`p-1 rounded transition-colors cursor-pointer ${
              isTimeLocked ? "bg-cyan-950/80 text-cyan-400 border border-cyan-800" : "text-zinc-500 hover:text-zinc-300"
            }`}
            title={isTimeLocked ? "Thème synchronisé sur l'heure système (07h-19h Jour, 19h-07h Nuit)" : "Cliquer pour synchroniser sur l'heure système"}
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
        </div>
        <h1 className="text-3xl font-bold text-center mb-4 text-zinc-100">LARDS</h1>
        <div className="bg-zinc-900 p-8 border border-zinc-800 rounded-xl w-full max-w-md mt-6 text-center flex flex-col items-center shadow-xl">
          <h2 className="text-xl font-semibold mb-6 border-b border-zinc-800 pb-3 w-full text-zinc-100">Créez une nouvelle session</h2>
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
            <input
              type="text"
              placeholder="Tapez le nom de votre patient"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500/80 transition-colors"
              required
            />
            <button
              type="submit"
              className="w-full p-3 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-700/60 font-bold rounded-lg transition-all cursor-pointer shadow-md hover:text-white"
            >
              Démarrer
            </button>
          </form>
        </div>
      </div>
    );
  }

  // If user is logged in, show application dashboard / role selection
  return (
    <div className="flex flex-col min-h-screen bg-black text-white font-sans">
      <PageHeader
        title="Sélectionnez votre rôle dans la simulation"
        icon="🏥"
        username={sessionUser}
        onLogout={handleLogout}
        showBackLink={false}
      />

      <div className="p-8 flex-1 flex flex-col justify-center items-center">

        
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
         
          <div onClick={() => router.push(`/control?username=${sessionUser}`)} className="connect-card bg-[#1a1a1a] hover:bg-gray-800 p-6 border border-gray-700 hover:border-cyan-500 rounded-xl cursor-pointer transition-all flex flex-col justify-between group shadow-lg">
            <h2 className="text-xl font-bold mb-2 group-hover:text-cyan-400 transition-colors">🎛️ Panneau de contrôle</h2>
            <p className="text-gray-400 text-sm">Contrôlez manuellement l'état et les constantes vitales du patient.</p>
          </div>

          <div onClick={() => router.push(`/defibrillator?username=${sessionUser}`)} className="connect-card bg-[#1a1a1a] hover:bg-gray-800 p-6 border border-gray-700 hover:border-cyan-500 rounded-xl cursor-pointer transition-all flex flex-col justify-between group shadow-lg">
            <h2 className="text-xl font-bold mb-2 group-hover:text-cyan-400 transition-colors">⚡ Défibrillateur</h2>
            <p className="text-gray-400 text-sm">Simulez des scénarios de défibrillation avec l'Efficia DFM100.</p>
          </div>

          <div onClick={() => router.push(`/scope?username=${sessionUser}`)} className="connect-card bg-[#1a1a1a] hover:bg-gray-800 p-6 border border-gray-700 hover:border-cyan-500 rounded-xl cursor-pointer transition-all flex flex-col justify-between group shadow-lg">
            <h2 className="text-xl font-bold mb-2 group-hover:text-cyan-400 transition-colors">📈 Scope</h2>
            <p className="text-gray-400 text-sm">Visualisez les constantes vitales (ECG, SpO2, CO2, BP) en temps réel.</p>
          </div>

          <div onClick={() => router.push(`/flowmeter?username=${sessionUser}`)} className="connect-card bg-[#1a1a1a] hover:bg-gray-800 p-6 border border-gray-700 hover:border-cyan-500 rounded-xl cursor-pointer transition-all flex flex-col justify-between group shadow-lg">
            <h2 className="text-xl font-bold mb-2 group-hover:text-cyan-400 transition-colors">💨 Débitmètre</h2>
            <p className="text-gray-400 text-sm">Simulez des débitmètres d'oxygène, d'air et l'aspirateur.</p>
          </div>

          <div onClick={() => router.push(`/streamer?username=${sessionUser}`)} className="connect-card bg-[#1a1a1a] hover:bg-gray-800 p-6 border border-gray-700 hover:border-cyan-500 rounded-xl cursor-pointer transition-all flex flex-col justify-between group shadow-lg">
            <h2 className="text-xl font-bold mb-2 group-hover:text-cyan-400 transition-colors">🫀 Streamer ECG</h2>
            <p className="text-gray-400 text-sm">Diffusez les constantes d'un mannequin sur l'application</p>
          </div>
        </div>
      </div>
    </div>
  );
}