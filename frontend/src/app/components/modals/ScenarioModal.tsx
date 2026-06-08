import React from 'react';
import { FileText, X } from 'lucide-react';
import { SCENARIOS } from '../../data/scenarios';
import Modal from './Modal';

interface ScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarioId: string | null;
  onStartScenario: (scenarioId: string) => void;
}

const ScenarioModal: React.FC<ScenarioModalProps> = ({
  isOpen,
  onClose,
  scenarioId,
  onStartScenario,
}) => {
  if (!isOpen || !scenarioId) return null;

  const scenario = SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            {scenario.title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-gray-300 overflow-y-auto flex-1 pr-2">
          <div>
            <p
  className="text-sm mb-3 text-justify"
  style={{ whiteSpace: 'pre-line' }}
>
  {scenario.description}
</p>
          </div>

          <div>
            <h4 className="font-medium text-white mb-2 hidden">
              Objectifs pédagogiques
            </h4>
            <ul className="text-sm space-y-1 hidden">
              {scenario.objectives.map((objective, index) => (
                <li key={index}>• {objective}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Fermer
          </button>
          <button
            onClick={() => {
              if (scenarioId) {
                onStartScenario(scenarioId);
              }
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Démarrer le scénario
          </button>
        </div>
    </Modal>
  );
};

export default ScenarioModal;
