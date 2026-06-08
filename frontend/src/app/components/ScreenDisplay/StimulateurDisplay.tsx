import React, { useState, forwardRef, useImperativeHandle } from "react";
import TimerDisplay from "../TimerDisplay";
import ECGDisplay from "../graphsdata/ECGDisplay";
import type { RhythmType } from "../graphsdata/ECGRhythms";
import type { PacerMode } from "../../hooks/useDefibrillator";
import VitalsDisplay from "../VitalsDisplay";

interface StimulateurDisplayProps {
  //ModifCodeSam
  bloodPressure?: { systolic: number; diastolic: number; map?: number };
  isScenario4?: boolean;

//ModifCodeSam
  rhythmType?: RhythmType;
  showSynchroArrows?: boolean;
  heartRate?: number;
  isScenario1Completed?: boolean;
  pacerFrequency: number;
  pacerIntensity: number;
  onFrequencyChange: (value: number) => void;
  onIntensityChange: (value: number) => void;
  pacerMode: PacerMode;
  isPacing: boolean;
  onPacerModeChange: (mode: PacerMode) => void;
  onTogglePacing: () => void;
  showFCValue?: boolean;
  showVitalSigns?: boolean;
  onShowFCValueChange?: (showFCValue: boolean) => void;
  onShowVitalSignsChange?: (showVitalSigns: boolean) => void;
  timerProps: {
    minutes: number;
    seconds: number;
    totalSeconds: number;
  };
  onOpenHelpModal?: () => void;
}

export interface StimulateurDisplayRef {
  triggerReglagesStimulateur: () => void;
  triggerMenu: () => void;
  triggerStimulation: () => void;
  navigateUp: () => void;
  navigateDown: () => void;
  selectCurrentItem: () => void;
  incrementValue: () => void;
  decrementValue: () => void;
  isInValueEditMode: () => boolean;
  isMenuOpen: () => boolean;

}

const StimulateurDisplay = forwardRef<StimulateurDisplayRef, StimulateurDisplayProps>(({
  rhythmType = 'sinus',
  showSynchroArrows = true,
  heartRate = 70,
  isScenario1Completed = false,
  pacerFrequency,
  pacerIntensity,
  onFrequencyChange,
  onIntensityChange,
  pacerMode,
  isPacing,
  onPacerModeChange,
  onTogglePacing,
  showFCValue = false,
  showVitalSigns = false,
  onShowFCValueChange,
  onShowVitalSignsChange,
  timerProps,
  onOpenHelpModal,
  //ModifCodeSam
  bloodPressure,
  isScenario4,
  //ModifCodeSam
}, ref) => {


  const [showMenu, setShowMenu] = useState(false);
  const [showStimulationModeMenu, setShowStimulationModeMenu] = useState(false);
  const [showReglagesStimulateur, setShowReglagesStimulateur] = useState(false);
  const [showReglagesStimulateurMenu, setShowReglagesStimulateurMenu] = useState(false);
  const [showIntensiteMenu, setShowIntensiteMenu] = useState(false);

  // Temporary state for editing values
  const [tempPacerFrequency, setTempPacerFrequency] = useState(pacerFrequency);
  const [tempPacerIntensity, setTempPacerIntensity] = useState(pacerIntensity);


  // États pour la navigation au joystick
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);

  //  vérifie si un menu ouvert
  const isAnyMenuOpen = () => {
    return showMenu || showStimulationModeMenu || showReglagesStimulateur ||
      showReglagesStimulateurMenu || showIntensiteMenu;
  };

  // Configuration des menus
  const menuConfigs = {
    main: ['Mode stimulation', 'Volume', 'Courbes affichées', 'Mesures/Alarmes', 'Infos patient', 'Aide', 'Fin'],
    settings: ['Fréquence stimulation', 'Intensité stimulation', 'Fin'],
    stimMode: ['Sentinelle', 'Fixe'] as PacerMode[]
  };

  const getCurrentMenuItems = () => {
    if (showMenu) return menuConfigs.main;
    if (showReglagesStimulateur) return menuConfigs.settings;
    if (showStimulationModeMenu) return menuConfigs.stimMode;
    return [];
  };

  // Fonction pour rendre un menu générique
  const renderMenu = (
    title: string,
    items: string[],
    onClose: () => void,
  ) => (
    <div className="absolute bottom-6 -right-1 transform translate-x-0 translate-y-0 z-50">
      <div className="bg-gray-300 border-2 border-black w-64 shadow-lg">
        <div className="bg-gray-400 px-4 py-2 border-b border-black">
          <h3 className="text-black font-bold text-sm">{title}</h3>
        </div>
        <div className="flex flex-col">
          {items.map((item, index) => (
            <div
              key={index}
              className={`px-4 py-2 ${index < items.length - 1 ? "border-b border-gray-500" : ""} ${selectedMenuIndex === index ? "bg-blue-500" : "bg-gray-300"
                }`}
            >
              <span
                className={`text-sm ${selectedMenuIndex === index ? "text-white" : "text-black"}`}
              >
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div
        className="fixed inset-0 bg-black bg-opacity-0 -z-10"
        onClick={onClose}
      ></div>
    </div>
  );

  useImperativeHandle(ref, () => ({
    triggerReglagesStimulateur: () => {
      if (isAnyMenuOpen() && !showReglagesStimulateur) return;
      setShowReglagesStimulateur(!showReglagesStimulateur);
      setSelectedMenuIndex(0);
    },
    triggerMenu: () => {
      if (isAnyMenuOpen() && !showMenu) return;
      setShowMenu(!showMenu);
      setSelectedMenuIndex(0);
    },
    isMenuOpen: isAnyMenuOpen,
    triggerStimulation: onTogglePacing,
    navigateUp: () => {
      const menuItems = getCurrentMenuItems();
      if (menuItems.length > 0) {
        setSelectedMenuIndex((prev) => (prev > 0 ? prev - 1 : menuItems.length - 1));
      }
    },
    navigateDown: () => {
      const menuItems = getCurrentMenuItems();
      if (menuItems.length > 0) {
        setSelectedMenuIndex((prev) => (prev < menuItems.length - 1 ? prev + 1 : 0));
      }
    },
    selectCurrentItem: () => {
      if (showReglagesStimulateurMenu) {
        onFrequencyChange(tempPacerFrequency);
        setShowReglagesStimulateurMenu(false);
        return;
      }
      if (showIntensiteMenu) {
        onIntensityChange(tempPacerIntensity);
        setShowIntensiteMenu(false);
        return;
      }

      const actions = {
        main: [
          () => { setShowStimulationModeMenu(true); setShowMenu(false); setSelectedMenuIndex(0); },
          () => console.log("Volume selected"),
          () => console.log("Courbes affichées selected"),
          () => console.log("Mesures/Alarmes selected"),
          () => console.log("Infos patient selected"),
          () => { onOpenHelpModal?.(); setShowMenu(false); },
          () => setShowMenu(false)
        ],
        settings: [
          () => { setTempPacerFrequency(pacerFrequency); setShowReglagesStimulateurMenu(true); setShowReglagesStimulateur(false); },
          () => { setTempPacerIntensity(pacerIntensity); setShowIntensiteMenu(true); setShowReglagesStimulateur(false); },
          () => setShowReglagesStimulateur(false)
        ],
        stimMode: [
          () => { onPacerModeChange("Sentinelle"); setShowStimulationModeMenu(false); },
          () => { onPacerModeChange("Fixe"); setShowStimulationModeMenu(false); }
        ]
      };

      const currentActions = showMenu ? actions.main :
        showReglagesStimulateur ? actions.settings :
          showStimulationModeMenu ? actions.stimMode : [];

      currentActions[selectedMenuIndex]?.();
    },
    incrementValue: () => {
      if (showReglagesStimulateurMenu) {
        setTempPacerFrequency(f => Math.min(200, f + 5));
      } else if (showIntensiteMenu) {
        setTempPacerIntensity(i => Math.min(200, i + 5));
      }
    },
    decrementValue: () => {
      if (showReglagesStimulateurMenu) {
        setTempPacerFrequency(f => Math.max(30, f - 5));
      } else if (showIntensiteMenu) {
        setTempPacerIntensity(i => Math.max(5, i - 5));
      }
    },
    isInValueEditMode: () => {
      return showReglagesStimulateurMenu || showIntensiteMenu;
    }
  }));

  return (
    <div className="absolute inset-3 bg-gray-900 rounded-lg">
      <div className="h-full flex flex-col">
        {/* Rangée 1 - En-tête */}
        <div className="h-1/6 border-b border-gray-600 grid grid-cols-3 items-center bg-black text-white text-sm font-mono">
          {/* Section gauche - Info patient */}
          <div className="flex items-center h-full justify-start">
            <div className="bg-orange-500 px-3 py-1 h-full flex flex-col justify-center">
              <div className="text-black font-bold text-xs">Adulte</div>
              <div className="text-black text-xs">≥25 kg</div>
            </div>
          </div>

          {/* Section centre - Timer */}
          <div className="flex items-center justify-center">
            <TimerDisplay {...timerProps} />
          </div>

          {/* Section droite - Date et icône */}
          <div className="flex items-center gap-2 px-3 justify-end">
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
        </div>

        {/* Rangée 2 - Paramètres médicaux */}
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
        <div className="h-4 w-full flex items-center justify-center px-4 text-sm bg-white mb-1 flex-col">
          <span className="text-black text-xs">
            Appuyer sur début stimulation pour démarrer
          </span>
        </div>

        {/* Row 3*/}
        <div className="h-1/3 border-b border-gray-600 flex flex-col items-center justify-start text-green-400 text-sm bg-black ">
          <ECGDisplay
            width={800}
            height={65}
            rhythmType={rhythmType} // Pass rhythmType directly
            showSynchroArrows={showSynchroArrows}
            heartRate={heartRate} // Pass heartRate directly
            isPacing={isPacing} // Pass pacing status
            pacerFrequency={pacerFrequency} // Pass pacer frequency
            pacerIntensity={pacerIntensity} // Pass pacer intensity
          />
          <div className="w-full text-xs font-bold text-green-400 text-right ">
            <span>
              {rhythmType === 'fibrillationVentriculaire' ? 'Fibrillation ventriculaire' :
                rhythmType === 'asystole' ? 'Asystolie' : 'Rythme sinusal'}
            </span>
          </div>
        </div>

        {/* Row  4*/}
        <div className=" h-1/3 border-b border-gray-600 flex items-start justify-start text-blue-400 text-sm bg-black p-2">
          {/* Rectangle bleu à gauche */}
          <div
            className="h-16 w-85 flex flex-row justify-center px-3 py-2 text-white text-xs"
            style={{ backgroundColor: "#7BA7D7" }}
          >
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium">  {isPacing ? "Stimulation en cours" : "Stimulation interrompue"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Stimul. {pacerMode}</span>
              </div>
            </div>

            <div className="flex flex-row gap-2 ml-3 py-3">
              <span className="font-bold text-lg font-mono">{pacerFrequency} bpm</span>
              <span className="font-bold text-lg font-mono">{pacerIntensity} mA</span>
            </div>
          </div>
        </div>

        {/* Row 6 */}
        <div className=" pt-5 pb-2 bg-black h-1/12 flex items-center justify-between  text-white text-xs ">
          <div className="flex">
            <div className="flex items-center gap-2">
              <div className="bg-gray-500 px-5 py-0.5 h-full flex flex-col justify-center text-xs ">
                <span>Début PNI </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-gray-500 px-4 py-0.5 h-full flex flex-col justify-center text-xs mr-1 ">
                  <span>
                    {isPacing ? "Pause Stimulation" : "Début Stimulation"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex">
            <div className="flex items-center gap-5">
              <div className="bg-gray-500 px-4 py-0.5 h-full flex flex-col justify-center text-xs mr-5">
                <span>Réglages stimulateur</span>
              </div>
              <div className="bg-gray-500 px-6 py-0.5 h-full flex flex-col justify-center text-xs mr-1">
                <span>Menu</span>
              </div>
            </div>
          </div>
        </div>

        {/* Menu Principal */}
        {showMenu &&
          renderMenu("Menu principal", menuConfigs.main, () =>
            setShowMenu(false),
          )}

        {/* Menu Mode Stimulation */}
        {showStimulationModeMenu &&
          renderMenu("Mode stimulation", menuConfigs.stimMode, () =>
            setShowStimulationModeMenu(false),
          )}

        {/* Menu Réglages Stimulateur */}
        {showReglagesStimulateur &&
          renderMenu("Réglages stimulateur", menuConfigs.settings, () =>
            setShowReglagesStimulateur(false),
          )}

        {/* Menu Fréquence Stimulation */}
        {showReglagesStimulateurMenu && (
          <div className="absolute bottom-6 -right-1 transform translate-x-0 translate-y-0 z-50">
            <div className="bg-gray-300 border-2 border-black w-48 shadow-lg">
              <div className="bg-blue-600 px-4 py-2 border-b border-black">
                <h3 className="text-white font-bold text-sm">Fréquence stimulation</h3>
              </div>

              <div className="flex flex-col items-center py-4">
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex flex-col items-center">
                    <div className="text-black text-2xl px-2 py-1 rounded">
                      ▲
                    </div>
                    <div className="text-black text-2xl px-2 py-1 rounded">
                      ▼
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-black text-2xl font-bold font-mono min-w-[60px] text-center">{tempPacerFrequency}</span>
                    <span className="text-black text-sm">bpm</span>
                  </div>
                </div>
                <div className="bg-gray-400 px-2 py-1 border border-gray-600 rounded text-black text-sm font-medium">
                  Fin
                </div>
              </div>
            </div>

            <div
              className="fixed inset-0 bg-black bg-opacity-0 -z-10"
              onClick={() => setShowReglagesStimulateurMenu(false)}
            ></div>
          </div>
        )}

        {/* Menu Intensité Stimulation */}
        {showIntensiteMenu && (
          <div className="absolute bottom-6 -right-1 transform translate-x-0 translate-y-0 z-50">
            <div className="bg-gray-300 border-2 border-black w-48 shadow-lg">
              <div className="bg-blue-600 px-4 py-2 border-b border-black">
                <h3 className="text-white font-bold text-sm">Intensité stimulation</h3>
              </div>

              <div className="flex flex-col items-center py-4">
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex flex-col items-center">
                    <div className="text-black text-2xl px-2 py-1 rounded">
                      ▲
                    </div>
                    <div className="text-black text-2xl px-2 py-1 rounded">
                      ▼
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-black text-2xl font-bold font-mono min-w-[60px] text-center">{tempPacerIntensity}</span>
                    <span className="text-black text-sm">mA</span>
                  </div>
                </div>
                <div className="bg-gray-400 px-2 py-1 border border-gray-600 rounded text-black text-sm font-medium">
                  Fin
                </div>
              </div>
            </div>

            <div
              className="fixed inset-0 bg-black bg-opacity-0 -z-10"
              onClick={() => setShowIntensiteMenu(false)}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
});

StimulateurDisplay.displayName = 'StimulateurDisplay';

export default StimulateurDisplay;
