"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWebSocket } from '../../context/WebSocketContext';

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
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6 font-sans">
        <h1 className="text-3xl font-bold text-center mb-4">Outil d'entraînement aux techniques de défibrillation</h1>
        <div className="bg-[#1a1a1a] p-8 border border-gray-700 rounded-xl w-full max-w-md mt-6 text-center flex flex-col items-center shadow-xl">
          <h2 className="text-xl font-semibold mb-6 border-b border-gray-700 pb-3 w-full">Connectez-vous à une session</h2>
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
            <input
              type="text"
              placeholder="Tapez votre identifiant"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="w-full p-3 bg-black border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              required
            />
            <button
              type="submit"
              className="w-full p-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
            >
              Se connecter
            </button>
          </form>
        </div>
      </div>
    );
  }

  // If user is logged in, show application dashboard / role selection
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-8 relative font-sans">
      {/* Top right user header */}
      <div className="absolute top-6 right-6 bg-black/40 px-4 py-2 rounded-lg text-sm flex items-center border border-gray-800">
        <span>User: <strong>{sessionUser}</strong></span>
        <button onClick={handleLogout} className="ml-4 text-cyan-400 hover:underline bg-transparent font-medium cursor-pointer">Logout</button>
      </div>

      <h1 className="text-3xl font-bold text-center mb-10 mt-6">Sélectionnez votre rôle dans la simulation</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
        <div onClick={() => router.push(`/streamer?username=${sessionUser}`)} className="bg-[#1a1a1a] hover:bg-gray-800 p-6 border border-gray-700 hover:border-cyan-500 rounded-xl cursor-pointer transition-all flex flex-col justify-between group shadow-lg">
          <h2 className="text-xl font-bold mb-2 group-hover:text-cyan-400 transition-colors">🫀 Streamer ECG</h2>
          <p className="text-gray-400 text-sm">Diffusez les constantes d'un mannequin sur l'application</p>
        </div>

        <div onClick={() => router.push(`/defibrillator?username=${sessionUser}`)} className="bg-[#1a1a1a] hover:bg-gray-800 p-6 border border-gray-700 hover:border-cyan-500 rounded-xl cursor-pointer transition-all flex flex-col justify-between group shadow-lg">
          <h2 className="text-xl font-bold mb-2 group-hover:text-cyan-400 transition-colors">⚡ Défibrillateur</h2>
          <p className="text-gray-400 text-sm">Simulez des scénarios de défibrillation avec l'Efficia DFM100.</p>
        </div>

        <div onClick={() => router.push(`/control?username=${sessionUser}`)} className="bg-[#1a1a1a] hover:bg-gray-800 p-6 border border-gray-700 hover:border-cyan-500 rounded-xl cursor-pointer transition-all flex flex-col justify-between group shadow-lg">
          <h2 className="text-xl font-bold mb-2 group-hover:text-cyan-400 transition-colors">🎛️ Panneau de contrôle</h2>
          <p className="text-gray-400 text-sm">Contrôlez manuellement l'état et les constantes vitales du patient.</p>
        </div>

        <div onClick={() => router.push(`/scope?username=${sessionUser}`)} className="bg-[#1a1a1a] hover:bg-gray-800 p-6 border border-gray-700 hover:border-cyan-500 rounded-xl cursor-pointer transition-all flex flex-col justify-between group shadow-lg">
          <h2 className="text-xl font-bold mb-2 group-hover:text-cyan-400 transition-colors">📈 Vue Scope</h2>
          <p className="text-gray-400 text-sm">Visualisez les constantes vitales (ECG, SpO2, CO2, BP) en temps réel.</p>
        </div>

        <div onClick={() => router.push(`/flowmeter?username=${sessionUser}`)} className="bg-[#1a1a1a] hover:bg-gray-800 p-6 border border-gray-700 hover:border-cyan-500 rounded-xl cursor-pointer transition-all flex flex-col justify-between group shadow-lg">
          <h2 className="text-xl font-bold mb-2 group-hover:text-cyan-400 transition-colors">💨 Debitmetre</h2>
          <p className="text-gray-400 text-sm">Simulez des débitmêtres d'oxygène, d'air et l'aspirateur.</p>
        </div>
      </div>
    </div>
  );
}