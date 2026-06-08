import React, {
  forwardRef,
} from "react";
import TwoLeadECGDisplay from "../graphsdata/TwoLeadECGDisplay";
import TimerDisplay from "../TimerDisplay";
import type { RhythmType } from "../graphsdata/ECGRhythms";
import VitalsDisplay from "../VitalsDisplay";

interface ManuelDisplayProps {
  energy: string;
  chargeProgress: number;
  shockCount: number;
  isCharging: boolean;
  rhythmType?: RhythmType;
  showSynchroArrows?: boolean;
  heartRate?: number;
  isCharged?: boolean;
  onCancelCharge?: () => boolean;
  showFCValue?: boolean;
  showVitalSigns?: boolean;
  onShowFCValueChange?: (showFCValue: boolean) => void;
  onShowVitalSignsChange?: (showVitalSigns: boolean) => void;
  showShockDelivered: boolean;
  showCPRMessage: boolean;
  timerProps: {
    minutes: number;
    seconds: number;
    totalSeconds: number;
  };
  //ModifCodeSam
   bloodPressure?: { systolic: number; diastolic: number; map?: number };
  isScenario4?: boolean;
   //ModifCodeSam
}

export interface ManuelDisplayRef {
  triggerCancelCharge: () => boolean;
  triggerDelayedShock: () => void;
}

const ManuelDisplay = forwardRef<ManuelDisplayRef, ManuelDisplayProps>(
  (
    {
      
      energy,
      chargeProgress,
      shockCount,
      rhythmType = "sinus",
      showSynchroArrows = false,
      heartRate = 70,
      isCharged = false,
      showFCValue = false,
      showVitalSigns = false,
      onShowFCValueChange,
      onShowVitalSignsChange,
      showShockDelivered,
      showCPRMessage,
      timerProps,
      //ModifCodeSam
      bloodPressure,
      isScenario4,
      //ModifCodeSam
    },
    ref,
  ) => {

    return (
      <div className="absolute inset-3 bg-gray-900 rounded-lg">
        <div className="h-full flex flex-col">
          {/* Row 1 - Header */}
          <div className="h-1/6 border-b border-gray-600 flex items-center justify-between bg-black text-white text-sm font-mono grid grid-cols-3">
            <div className="flex items-center h-full">
              <div className="bg-orange-500 px-3 py-1 h-full flex flex-col justify-start">
                <div className="text-black font-bold text-xs">Adulte</div>
                <div className="text-black text-xs">≥25 kg</div>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <TimerDisplay {...timerProps} />

            </div>
            <div className="flex items-end flex-col gap-2 px-3 justify-end">
              <div className="flex flex-row items-center gap-x-2">
                <div className="text-white text-xs">
                  {new Date()
                    .toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                    .replace(".", "")}{" "}
                  {new Date().toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </div>
                <div className="w-4 h-3 bg-green-500 rounded-sm flex items-center justify-center">
                  <div className="w-2 h-1.5 bg-white rounded-xs"></div>
                </div>
              </div>
              {showFCValue &&
                (rhythmType === "fibrillationVentriculaire" ||
                  rhythmType === "fibrillationAtriale") && (
                  <div className="w-35 h-4 bg-red-500 mb-2">
                    <span className="block text-center text-white text-xs">
                      {" "}
                      Analyse ECG impossible
                    </span>
                  </div>
                )}
            </div>
          </div>

          {/* Row 2 - Medical Parameters */}
          <VitalsDisplay
            rhythmType={rhythmType}
            heartRate={heartRate}
            showFCValue={showFCValue}
            onShowFCValueChange={onShowFCValueChange || (() => { })}
            showVitalSigns={showVitalSigns}
            onShowVitalSignsChange={onShowVitalSignsChange || (() => { })}
          //ModifCodeSam
            bloodPressure={bloodPressure}
            isScenario4={isScenario4}
            //ModifCodeSam
          />

          <div className="h-6 flex items-center justify-center relative bg-black">
            {isCharged && !showSynchroArrows && (
              <div className="bg-white px-2 py-0.5 mt-1">
                <span className="text-black text-xs font-bold">
                  Délivrez le choc maintenant
                </span>
              </div>
            )}
            {isCharged && showSynchroArrows && (
              <div className="bg-white px-2 py-0.5 mt-1">
                <span className="text-black text-xs font-bold">
                  Maintenez le bouton enfoncé pour délivrer le choc
                </span>
              </div>
            )}
            {showShockDelivered && (
              <div className="bg-white px-2 py-0.5 mt-1">
                <span className="text-black text-xs font-bold">
                  Choc délivré
                </span>
              </div>
            )}
            {showCPRMessage && (
              <div className="bg-white px-2 py-0.5 mt-1">
                <span className="text-black text-xs font-bold">
                  Commencez la réanimation cardio pulmonaire
                </span>
              </div>
            )}
          </div>

          {/* All in one ECG display containing defib info */}
          <div className="flex-grow border-b border-gray-600 flex flex-col bg-black">
            <TwoLeadECGDisplay
              width={800}
              height={45}
              rhythmType={showFCValue ? rhythmType : "asystole"}
              showSynchroArrows={showSynchroArrows}
              heartRate={heartRate}
              energy={energy}
              chargeProgress={chargeProgress}
              shockCount={shockCount}
              isDottedAsystole={!showFCValue}
              showDefibrillatorInfo={true}
              showRhythmText={true}
            />
          </div>

          {/* Row 5 & 6 - Messages and Footer */}

          <div
            className={`bg-black flex flex-col -mt-2 ${showFCValue &&
                (rhythmType === "fibrillationVentriculaire" ||
                  rhythmType === "fibrillationAtriale")
                ? "-mt-4"
                : "mb-0"
              }`}
          >


            <div className="flex items-center justify-between text-white text-xs px-2 mt-1">
              <div className="flex gap-2">
                <div className="bg-gray-500 px-5 py-1 -ml-3 text-xs">
                  <span>Début PNI</span>
                </div>
                <div className="bg-gray-500 px-5 py-1 ml-4 text-xs">
                  <span>Début RCP</span>
                </div>
              </div>
              <div className="flex items-center gap-12 px-7 mr-3">
                <div
                  className={`px-2 py-1  text-xs ${isCharged
                      ? "bg-red-500 text-white"
                      : "bg-gray-500 text-gray-300"
                    }`}
                >
                  <span>Annuler Charge</span>
                </div>
                <div className="bg-gray-500 px-7 py-1 -mr-10 text-xs">
                  <span>Menu</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

ManuelDisplay.displayName = 'ManuelDisplay';

export default ManuelDisplay;
