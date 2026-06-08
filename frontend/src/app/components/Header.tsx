import { Eye, EyeOff, Check } from "lucide-react";
import DropdownMenu from "./DropdownMenu";
import ECGRhythmDropdown from "./controls/ECGRhythmDropdown";
import type { RhythmType } from "./graphsdata/ECGRhythms";

interface HeaderProps {
  // Manual Mode Props
  onStartScenario: (scenarioId: string) => void;
  currentRhythm: RhythmType;
  onRhythmChange: (rhythm: RhythmType) => void;
  heartRate: number;
  onHeartRateChange: (rate: number) => void;

  // Scenario Mode Props
  isScenarioActive: boolean;
  onExitScenario: () => void;
  scenarioTitle?: string;
  currentStepNumber?: number;
  totalSteps?: number;
  showStepNotifications: boolean;
  onToggleStepNotifications: () => void;
  isComplete: boolean;
}

export default function Header({
  onStartScenario,
  onExitScenario,
  currentRhythm,
  onRhythmChange,
  isScenarioActive,
  isComplete,
  scenarioTitle,
  heartRate,
  onHeartRateChange,
  currentStepNumber,
  totalSteps,
  showStepNotifications,
  onToggleStepNotifications,
}: HeaderProps) {
  return (
    <header className="h-[6vh] min-h-[50px] bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 flex items-center justify-between px-4 sm:px-6 z-50">
      {/* Left side: Controls or Scenario Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold text-white truncate">{scenarioTitle || "Simulateur basé sur l’EFFICIA DFM100"}</h1>
        {/* {isScenarioActive ? (
          <h1 className="text-lg font-bold text-white truncate">{scenarioTitle || "Scenario"}</h1>
        ) : (
          <ECGRhythmDropdown
            currentRhythm={currentRhythm}
            onRhythmChange={onRhythmChange}
            isScenarioActive={isScenarioActive}
            heartRate={heartRate}
            onHeartRateChange={onHeartRateChange}
          />
        )} */}
      </div>

      {/* Right side: Scenario Menu or Scenario Controls */}
      <div className="flex items-center gap-2 sm:gap-4">
        {isScenarioActive ? (
          <>
            {showStepNotifications && !isComplete && (
              <span className="text-base text-white font-medium hidden sm:inline">{currentStepNumber} / {totalSteps}</span>
            )}
            <button onClick={onToggleStepNotifications} className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors">
              {showStepNotifications ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>

            {isComplete ? (
              <button
                onClick={onExitScenario}
                className="px-3 py-1.5 flex items-center gap-2 bg-green-500 text-white rounded-lg transition-colors text-sm font-semibold animate-[glowing-green_2s_infinite]"
              >
                <Check className="w-4 h-4" />
                Terminé
              </button>
            ) : (
              <button
                onClick={onExitScenario}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
              >
                Quitter
              </button>
            )}
          </>
        ) : (
          <DropdownMenu onStartScenario={onStartScenario} />
        )}
      </div>
    </header>
  );
}