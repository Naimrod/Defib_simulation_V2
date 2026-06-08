import React from "react";
import { FileText, X, ChevronDown } from "lucide-react";
import { SCENARIOS, COLOR_CLASSES } from "../../data/scenarios";
import Modal from './Modal';

interface ScenariosListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScenarioSelect: (scenarioId: string) => void;
}

const ScenariosListModal: React.FC<ScenariosListModalProps> = ({
  isOpen,
  onClose,
  onScenarioSelect,
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Sélectionner un scénario
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto flex-1 pr-2">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => {
                onScenarioSelect(scenario.id);
                onClose();
              }}
              className={`p-4 rounded-lg border-2 ${COLOR_CLASSES[scenario.color]} transition-all duration-200 text-left `}
            >
              <div className="flex items-start gap-4">
                <div className="text-2xl">{scenario.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">
                    {scenario.title}
                  </h3>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 bg-gray-700 text-white rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
    </Modal>
  );
};

export default ScenariosListModal;
