import React, { useState, useEffect } from 'react';
import { Settings, X } from 'lucide-react';
import { useAudio } from '../../context/AudioContext'; // Import the useAudio hook
import Modal from './Modal';


interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  // Get the shared audio service instance from the context
  const audioService = useAudio();

  // Initialize local state from the audio service's current settings
  const [soundEnabled, setSoundEnabled] = useState(audioService.getSettings().enabled);
  const [volume, setVolume] = useState(audioService.getSettings().volume * 100);
  const [language, setLanguage] = useState('fr');

  // Effect to sync modal state if it's reopened and settings might have changed elsewhere
  useEffect(() => {
    if (isOpen) {
      const currentSettings = audioService.getSettings();
      setSoundEnabled(currentSettings.enabled);
      setVolume(currentSettings.volume * 100);
    }
  }, [isOpen, audioService]);

  // Handlers now update the shared audio service instance
  const handleSoundToggle = (enabled: boolean) => {
    setSoundEnabled(enabled);
    audioService.updateSettings({ enabled });
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    audioService.updateSettings({ volume: newVolume / 100 });
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-green-400" />
          Paramètres
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-6 text-gray-300">
        {/* Audio Settings */}
        <div>
          <h3 className="font-semibold text-white mb-3">Audio</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm">Sons activés</label>
              <button
                onClick={() => handleSoundToggle(!soundEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${soundEnabled ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>

            <div>
              <label className="text-sm block mb-1">Volume: {Math.round(volume)}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Interface Settings */}
        <div>
          <h3 className="font-semibold text-white mb-3">Interface</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm block mb-1">Langue</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              >
                <option value="fr">Français</option>
                <option value="en">English (pas encore disponible)</option>
                <option value="es">Español (pas encore disponible)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          Fermer
        </button>
      </div>
    </Modal>
  );
};

export default SettingsModal;
