import React from "react";
import { FileText, X, ChevronDown } from "lucide-react";
import { SCENARIOS } from "../../data/scenarios";
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
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2.5 tracking-tight">
            <FileText className="w-5 h-5 text-cyan-400" />
            Sélectionner un scénario
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 rounded-lg hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid gap-3 overflow-y-auto flex-1 pr-1 max-h-[60vh]">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => {
                onScenarioSelect(scenario.id);
                onClose();
              }}
              className="p-4 rounded-xl border bg-[#141414] hover:bg-[#1f1f1f] border-zinc-800 hover:border-zinc-700 transition-all duration-150 text-left cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="text-2xl p-2 rounded-lg bg-black border border-zinc-800">{scenario.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-zinc-100 text-sm group-hover:text-cyan-400 transition-colors mb-0.5">
                    {scenario.title}
                  </h3>
                </div>
                <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-transform duration-150 -rotate-90 group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 pt-3 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#18181b] hover:bg-[#27272a] text-zinc-200 border border-zinc-700/80 rounded-xl font-medium text-sm transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
    </Modal>
  );
};

export default ScenariosListModal;
