import React from 'react';
import { Zap, X } from 'lucide-react';
import Modal from './Modal';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" />À propos
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-gray-300">
          <div>
            <h3 className="font-semibold text-white mb-2">
              Simulateur de Défibrillateur
            </h3>
            <p className="text-sm">Version 1.0</p>
          </div>

          <div>
            <h4 className="font-medium text-white mb-1">Description</h4>
            <p className="text-sm">
              Application de simulation pour la formation médicale aux
              techniques de défibrillation. Conçue pour l'apprentissage et la
              pratique en environnement sécurisé.
            </p>
          </div>

          <div>
            <h4 className="font-medium text-white mb-1">Fonctionnalités</h4>
            <ul className="text-sm space-y-1">
              <li>• </li>
              <li>• </li>
              <li>• </li>
              <li>• </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </Modal>
  );
};

export default AboutModal;
