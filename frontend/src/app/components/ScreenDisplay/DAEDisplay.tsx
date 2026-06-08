//DAEDisplay.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import ECGDisplay from "../graphsdata/ECGDisplay";
import TimerDisplay from "../TimerDisplay";
import { useAudio } from '../../context/AudioContext';
import type { RhythmType } from "../graphsdata/ECGRhythms";
import VitalsDisplay from "../VitalsDisplay";

//ModifcodeSam
import { emit } from "@/lib/eventBus";
//ModifcodeSam

interface DAEDisplayProps {
  //ModifCodeSam
  isScenario4?: boolean;
  //ModifCodeSam
  energy: string;
  chargeProgress: number;
  shockCount: number;
  isCharging: boolean;
  isCharged: boolean;
  rhythmType?: RhythmType;
  showSynchroArrows?: boolean;
  heartRate?: number;
  deliverShock: () => void;
  onShockReady?: (handleShock: (() => void) | null) => void;
  startCharging: () => void;
  onPhaseChange?: (phase: Phase) => void;
  onElectrodePlacementValidated?: () => void;
  showFCValue?: boolean;
  showVitalSigns?: boolean;
  onShowFCValueChange?: (showFCValue: boolean) => void;
  onShowVitalSignsChange?: (showVitalSigns: boolean) => void;
  timerProps: {
    minutes: number;
    seconds: number;
    totalSeconds: number;
  };
  //ModifCodeSam
    bloodPressure?: {
    systolic: number;
    diastolic: number;
    map?: number;
  };
  //ModifCodeSam
}

type Phase =
  | "placement"
  | "preparation"
  | "analyse"
  | "pre-charge"
  | "charge"
  | "attente_choc"
  | "choc"
  | "pas_de_choc";

const shockableRhythms: RhythmType[] = ['fibrillationVentriculaire', 'tachycardieVentriculaire', 'fibrillationAtriale'];

const DAEDisplay: React.FC<DAEDisplayProps> = ({
  energy,
  shockCount,
  chargeProgress,
  rhythmType = "sinus",
  showSynchroArrows = false,
  heartRate = 70,
  isCharged = false,
  //ModifCodeSam
  bloodPressure,
  isScenario4,
  //ModifCodeSam
  deliverShock,
  startCharging,
  onPhaseChange,
  onShockReady,
  onElectrodePlacementValidated,
  showFCValue = true,
  showVitalSigns = true,
  onShowFCValueChange,
  onShowVitalSignsChange,
  timerProps
}) => {
  const audioService = useAudio();
  const [phase, setPhase] = useState<Phase>("placement");
  const [progressBarPercent, setProgressBarPercent] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(120); // Timer for preparation phase
  const [isShockable, setIsShockable] = useState(false)
  const handleShockClick = useCallback(() => {
    if (phase === "attente_choc") {
      deliverShock();
      setPhase("choc");
      setProgressBarPercent(0);
    }
  }, [phase, deliverShock]);

  useEffect(() => {
    if (onShockReady) {
      if (phase === 'attente_choc') {
        onShockReady(() => handleShockClick);
      } else {
        onShockReady(null);
      }
    }
  }, [phase, onShockReady, handleShockClick]);

  useEffect(() => {
    setIsShockable(shockableRhythms.includes(rhythmType));
  }, [rhythmType]);

  useEffect(() => {
    if (isCharged && (phase === 'charge')) {
      setPhase('attente_choc');
    }
  }, [isCharged, phase]);

//ModifCodeSam

  useEffect(() => {
  if (onPhaseChange) {
    onPhaseChange(phase);
    console.log("PHASE ACTUELLE:", phase);
  }

  let interval: NodeJS.Timeout | undefined;
  let timers: NodeJS.Timeout[] = [];
  audioService.clearRepetition();

  switch (phase) {
    case "placement":
      audioService.playDAEModeAdulte();
      timers.push(setTimeout(() => {
        audioService.playDAEInstructions();
        timers.push(setTimeout(() => {
          audioService.playDAEElectrodeReminder();
        }, 3500));
      }, 1000));
      break;

    case "analyse":
      audioService.playDAEEcartezVousduPatient();
      timers.push(setTimeout(() => {
        audioService.playDAEAnalyse();
        // ⬇️ Délai total pour analyse + audio
        timers.push(setTimeout(() => {
          const isRhythmShockable = shockableRhythms.includes(rhythmType);
          setPhase(isRhythmShockable ? "pre-charge" : "pas_de_choc");
        }, 8000)); // 8s pour l’analyse
      }, 3000)); // 3s après "écartez-vous"
      break;

    case "pre-charge":
      audioService.playDAEChocRecommande();
      timers.push(setTimeout(() => {
        setPhase("charge");
      }, 2500)); // laisse parler
      break;

    case "charge":
      audioService.playDAEEcartezVous();
      timers.push(setTimeout(() => {
        startCharging();
      }, 2500)); // assez pour "écartez-vous"
      break;

    case "attente_choc":
      audioService.playDAEChoc();
      timers.push(setTimeout(() => {
        audioService.playDAEboutonOrange();
      }, 2500));
      break;

    case "choc":
      timers.push(setTimeout(() => {
        setPhase("preparation");
      }, 1500)); // laisse le son du choc se terminer
      break;

    case "pas_de_choc":
      audioService.playPasDeChocIndique();
      timers.push(setTimeout(() => {
        audioService.playCommencerRCP();
      }, 2500));
      timers.push(setTimeout(() => {
        setPhase("preparation");
      }, 5000)); // assez long pour entendre tout
      break;

    case "preparation":
      setElapsedTime(120);
      interval = setInterval(() => {
        setElapsedTime(prev => {
          if (prev <= 1) {
            setPhase("analyse");
            return 0;
          }
          setProgressBarPercent(100 - 100 * (prev - 1) / 120);
          return prev - 1;
        });
      }, 1000);
      break;
  }

  return () => {
    if (interval) clearInterval(interval);
    timers.forEach(clearTimeout);
  };
}, [phase, rhythmType, startCharging, audioService, onPhaseChange]);

//ModifCodeSam

  const handlePlacementValidate = () => {
    if (phase === "placement") {
      setPhase("analyse");
      onElectrodePlacementValidated?.();
      //ModifcodeSam
      emit("stepValidated"); 
       //ModifcodeSam
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="absolute inset-3 bg-gray-900 rounded-lg">
      <div className="h-full flex flex-col">
        {phase === "placement" ? (
          <div className="h-full flex flex-col items-center justify-center bg-black text-white">
            <div className="flex flex-col items-center justify-center space-y-8">
              <h2 className="text-xl font-bold text-center mb-4 mt-6">
                Placez les électrodes comme indiqué
              </h2>
              <div className="flex items-center justify-center">
                <img
                  src="/images/placement_electrodes.jpg"
                  alt="Placement des électrodes"
                  className="max-w-md h-auto"
                />
              </div>        
<button
//ModifcodeSam
  onClick={handlePlacementValidate}
  className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-5 rounded-lg text-xl transition-colors duration-200 mb-7"
  //ModifcodeSam
              
              >
                Valider
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-1/6 border-b border-gray-600 flex items-center justify-between bg-black text-white text-sm font-mono grid grid-cols-3">
              <div className="flex items-center h-full">
                <div className="bg-orange-500 px-3 py-1 h-full flex flex-col justify-start">
                  <div className="text-black font-bold text-xs">Adulte</div>
                  <div className="text-black text-xs">≥25 kg</div>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <TimerDisplay {...timerProps}/>
              </div>
              <div className="flex items-center gap-2 px-3 justify-end">
                <div className="text-white text-xs">
                  {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "")}{" "}
                  {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </div>
                <div className="w-4 h-3 bg-green-500 rounded-sm flex items-center justify-center">
                  <div className="w-2 h-1.5 bg-white rounded-xs"></div>
                </div>
              </div>
            </div>

            {/* Vitals */}
            <VitalsDisplay
            //ModifCodeSam
            bloodPressure={bloodPressure}
            isScenario4={isScenario4}
             //ModifCodeSam
              rhythmType={rhythmType}
              heartRate={heartRate}
              showFCValue={showFCValue}
              onShowFCValueChange={onShowFCValueChange || (() => { })}
              showVitalSigns={showVitalSigns}
              onShowVitalSignsChange={onShowVitalSignsChange || (() => { })}
            />

            {/* Message Banner */}
            <div className="h-4 w-full flex items-center justify-center px-4 text-sm bg-white mb-1">
              <span className="text-black text-xs">
                {phase === "preparation" && "Occupez-vous du patient"}
                {phase === "analyse" && "Écartez-vous du patient, analyse en cours."}
                {phase === "pas_de_choc" && "Pas de choc indiqué"}
                {phase === "pre-charge" && "Écartez-vous du patient, choc recommandé."}
                {phase === "charge" && "Écartez-vous du patient, choc recommandé."}
                {phase === "attente_choc" && "Délivrez le choc."}
                {phase === "choc" && "Occupez-vous du patient, choc délivré"}
              </span>
            </div>

            {/* ECG Display */}
            <div className="h-1/3 border-b border-gray-600 flex flex-col items-center justify-start text-green-400 text-sm bg-black ">
              <ECGDisplay width={800} height={65} rhythmType={rhythmType} showSynchroArrows={showSynchroArrows} heartRate={heartRate} />
              <div className="w-full text-xs font-bold text-green-400 text-right ">
                <span>
                  {rhythmType === "fibrillationVentriculaire" ? "Fibrillation ventriculaire" : rhythmType === "asystole" ? "Asystolie" : "Rythme sinusal"}
                </span>
              </div>
              {(phase === "charge" || phase === "attente_choc") && (
                <div className="w-full flex justify-start items-center gap-4 text-xs font-bold text-white">
                  <div className="text-left"><span>RCP :</span></div>
                  <div className="w-24 h-3 bg-gray-600 rounded">
                    <div className={`h-full bg-red-500 rounded transition-all duration-100 ${chargeProgress === 100 ? "animate-pulse" : ""}`} style={{ width: `${chargeProgress}%` }} />
                  </div>
                  <div className="text-center ml-30"><span>Chocs : {shockCount}</span></div>
                  <div className="text-right ml-auto"><span>Energie sélectionnée : {energy} joules</span></div>
                </div>
              )}
            </div>

            {/* Main Content Area */}
            <div className=" h-1/3 border-b border-gray-600 flex flex-col items-center justify-center text-blue-400 text-sm bg-black px-4">
              {phase === "preparation" && (
                <div className="w-full mb-2">
                  <div className="w-full h-6 bg-gray-700 rounded relative">
                    <div
                      className="h-full bg-green-500 rounded transition-all duration-100"
                      style={{ width: `${progressBarPercent}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-4 text-white text-xs ">
                      <div></div>
                      <div>{isShockable ? "RCP" : "Analyse suspendue"} {formatTime(120 - elapsedTime)}</div>
                      <div></div>
                      <div>2:00</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className=" pt-5 pb-2 bg-black h-1/12 flex items-center justify-between  text-white text-xs ">
              <div className="flex">
                <div className="flex items-center gap-2"></div>
                <div className="flex items-center gap-2">
                  <div className="bg-gray-500 px-5 py-0.5 h-full flex flex-col justify-center text-xs ">
                    <span>Début RCP</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-12 px-7 mr-3">
                <div className={`px-2 py-1  text-xs ${isCharged ? "bg-red-500 text-white" : "bg-gray-500 text-gray-300"}`}>
                  <span>Annuler Charge</span>
                </div>
                <div className="bg-gray-500 px-7 py-1 -mr-10 text-xs">
                  <span>Menu</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DAEDisplay;