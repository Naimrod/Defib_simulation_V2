import React, { useState, forwardRef, useImperativeHandle } from "react";
import TwoLeadECGDisplay from "../graphsdata/TwoLeadECGDisplay";
import PlethDisplay from "../graphsdata/PlethDisplay";
import TimerDisplay from "../TimerDisplay";
import type { RhythmType } from "../graphsdata/ECGRhythms";
import { usePlethAnimation } from "../../hooks/usePlethAnimation";
import VitalsDisplay from "../VitalsDisplay";
import { PatientState, DefibState } from "@/types/simulation";

interface MonitorDisplayProps {
  device: DefibState;
  patient: PatientState;
  actions: any;
  timerProps: {
    minutes: number;
    seconds: number;
    totalSeconds: number;
  };
}

export interface MonitorDisplayRef {
  triggerMenu: () => void;
  navigateUp: () => void;
  navigateDown: () => void;
  selectCurrentItem: () => void;
  isInValueEditMode: () => boolean;
  incrementValue: () => void;
  decrementValue: () => void;
  isMenuOpen: () => boolean;
}

const MonitorDisplay = forwardRef<MonitorDisplayRef, MonitorDisplayProps>(
  (
    {
      device,
      patient,
      actions,
      timerProps,
    },
    ref,
  ) => {
    const plethAnimation = usePlethAnimation();

    // Local state extraction
    const { rhythm_type: rhythmType, heart_rate: heartRate } = patient;
    const { is_synchro_mode: showSynchroArrows, energy, shock_count: shockCount, show_fc: showFCValue } = device;
    const chargeProgress = (device as any).chargeProgress ?? 0;

    // Safely and explicitly pull show_spo2 so it is NEVER undefined
    const showSpo2 = (device as any).show_spo2 === true;

    // États pour le menu
    const [showMenu, setShowMenu] = useState(false);
    const [showMesuresMenu, setShowMesuresMenu] = useState(false);
    const [showFCMenu, setShowFCMenu] = useState(false);
    const [showPNIMenu, setShowPNIMenu] = useState(false);
    const [showLimitesFCMenu, setShowLimitesFCMenu] = useState(false);
    const [showLimitesBassesFCMenu, setShowLimitesBassesFCMenu] = useState(false);
    const [showFrequencePNIMenu, setShowFrequencePNIMenu] = useState(false);
    const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
    const [limitesFCValue, setLimitesFCValue] = useState(120);
    const [limitesBassesFCValue, setLimitesBassesFCValue] = useState(50);
    const [selectedFrequencePNI, setSelectedFrequencePNI] = useState("Manuel");
    const [frequencePNIStartIndex, setFrequencePNIStartIndex] = useState(0);

    const menuConfigs = {
      main: ["Volume", "Courbes affichées", "Mesures/Alarmes", "Infos patient", "Tendances", "Fin"],
      Mesures: ["FC/Arythmie", "PNI", "SpO2", "Pouls", "Fin"],
      FC: ["Reprise acqu. rythme", "Alarmes desactivées", "Limites FC", "Limites Tachy. V", "Limite fréquence ESV", "Fin"],
      PNI: ["Fréquence PNI", "Alarmes desactivées", "Limites PNI", "Fin"],
      LimitesFC: ["▲", limitesFCValue.toString(), "▼", "Fin"],
      LimitesBasseFC: ["▲", limitesBassesFCValue.toString(), "▼", "Fin"],
      FrequencePNI: ["Manuel", "1 min", "2.5 min", "5 min", "10 min", "15 min", "30 min", "60 min", "120 min"],
    };

    const isAnyMenuOpen = () => showMenu || showMesuresMenu || showFCMenu || showPNIMenu || showLimitesFCMenu || showLimitesBassesFCMenu || showFrequencePNIMenu;

    const getCurrentMenuItems = () => {
      if (showMenu) return menuConfigs.main;
      if (showMesuresMenu) return menuConfigs.Mesures;
      if (showFCMenu) return menuConfigs.FC;
      if (showPNIMenu) return menuConfigs.PNI;
      if (showLimitesFCMenu) return menuConfigs.LimitesFC;
      if (showLimitesBassesFCMenu) return menuConfigs.LimitesBasseFC;
      if (showFrequencePNIMenu) return menuConfigs.FrequencePNI;
      return [];
    };

    const renderMenu = (title: string, items: string[], onClose: () => void) => (
      <div className="absolute bottom-6 -right-1 transform translate-x-0 translate-y-0 z-50">
        <div className="bg-gray-300 border-2 border-black w-64 shadow-lg">
          <div className="bg-gray-400 px-4 py-2 border-b border-black">
            <h3 className="text-black font-bold text-sm">{title}</h3>
          </div>
          <div className="flex flex-col">
            {items.map((item, index) => (
              <div
                key={index}
                className={`px-4 py-2 ${index < items.length - 1 ? "border-b border-gray-500" : ""} ${selectedMenuIndex === index ? "bg-blue-500" : "bg-gray-300"}`}
              >
                <span className={`text-sm ${selectedMenuIndex === index ? "text-white" : "text-black"}`}>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="fixed inset-0 bg-black bg-opacity-0 -z-10" onClick={onClose}></div>
      </div>
    );

    useImperativeHandle(ref, () => ({
      triggerMenu: () => {
        if (isAnyMenuOpen() && !showMenu) return;
        setShowMenu(!showMenu);
        setSelectedMenuIndex(0);
      },
      isMenuOpen: isAnyMenuOpen,
      navigateUp: () => {
        if (showLimitesFCMenu || showLimitesBassesFCMenu) return;
        const menuItems = getCurrentMenuItems();
        if (menuItems.length > 0) {
          if (showFrequencePNIMenu) {
            const newIndex = selectedMenuIndex > 0 ? selectedMenuIndex - 1 : menuItems.length - 1;
            setSelectedMenuIndex(newIndex);
            if (newIndex < frequencePNIStartIndex) setFrequencePNIStartIndex(Math.max(0, newIndex));
            else if (newIndex >= menuItems.length - 4) setFrequencePNIStartIndex(Math.max(0, menuItems.length - 5));
          } else {
            setSelectedMenuIndex((prev) => prev > 0 ? prev - 1 : menuItems.length - 1);
          }
        }
      },
      navigateDown: () => {
        if (showLimitesFCMenu || showLimitesBassesFCMenu) return;
        const menuItems = getCurrentMenuItems();
        if (menuItems.length > 0) {
          if (showFrequencePNIMenu) {
            const newIndex = selectedMenuIndex < menuItems.length - 1 ? selectedMenuIndex + 1 : 0;
            setSelectedMenuIndex(newIndex);
            if (newIndex >= frequencePNIStartIndex + 5) setFrequencePNIStartIndex(Math.min(menuItems.length - 5, newIndex - 4));
            else if (newIndex === 0) setFrequencePNIStartIndex(0);
          } else {
            setSelectedMenuIndex((prev) => prev < menuItems.length - 1 ? prev + 1 : 0);
          }
        }
      },
      isInValueEditMode: () => showLimitesFCMenu || showLimitesBassesFCMenu,
      incrementValue: () => {
        if (showLimitesFCMenu && limitesFCValue < 200) setLimitesFCValue((prev) => prev + 1);
        else if (showLimitesBassesFCMenu && limitesBassesFCValue < 200) setLimitesBassesFCValue((prev) => prev + 1);
      },
      decrementValue: () => {
        if (showLimitesFCMenu && limitesFCValue > 30) setLimitesFCValue((prev) => prev - 1);
        else if (showLimitesBassesFCMenu && limitesBassesFCValue > 30) setLimitesBassesFCValue((prev) => prev - 1);
      },
      selectCurrentItem: () => {
        if (showLimitesFCMenu) {
          setShowLimitesFCMenu(false);
          setShowLimitesBassesFCMenu(true);
          setSelectedMenuIndex(0);
          return;
        }
        if (showLimitesBassesFCMenu) {
          setShowLimitesBassesFCMenu(false);
          return;
        }

        const menuActions = {
          main: [
            () => console.log("Volume sélectionné"), 
            () => console.log("Courbes affichées sélectionné"), 
            () => { setShowMesuresMenu(true); setShowMenu(false); setSelectedMenuIndex(0); }, 
            () => console.log("Infos patient sélectionné"), 
            () => console.log("Tendances sélectionné"), 
            () => setShowMenu(false), 
          ],
          Mesures: [
            () => { setShowFCMenu(true); setShowMesuresMenu(false); setSelectedMenuIndex(0); }, 
            () => { setShowPNIMenu(true); setShowMesuresMenu(false); setSelectedMenuIndex(0); }, 
            () => console.log("SpO2 sélectionné"), 
            () => console.log("Pouls sélectionné"), 
            () => setShowMesuresMenu(false), 
          ],
          FC: [
            () => console.log("Reprise acqu. rythme sélectionné"), 
            () => console.log("Alarmes desactivées sélectionné"), 
            () => { setShowLimitesFCMenu(true); setShowFCMenu(false); setSelectedMenuIndex(0); }, 
            () => console.log("Limites Tachy. V sélectionné"), 
            () => console.log("Limite fréquence ESV sélectionné"), 
            () => setShowFCMenu(false), 
          ],
          PNI: [
            () => { setShowFrequencePNIMenu(true); setShowPNIMenu(false); setSelectedMenuIndex(0); setFrequencePNIStartIndex(0); }, 
            () => console.log("Alarmes desactivées sélectionné"), 
            () => console.log("Limites PNI sélectionné"), 
            () => setShowPNIMenu(false), 
          ],
          LimitesFC: [
            () => { if (limitesFCValue < 200) setLimitesFCValue((prev) => prev + 1); },
            () => { },
            () => { if (limitesFCValue > 30) setLimitesFCValue((prev) => prev - 1); },
            () => setShowLimitesFCMenu(false), 
          ],
          FrequencePNI: [
            () => { setSelectedFrequencePNI("Manuel"); setShowFrequencePNIMenu(false); },
            () => { setSelectedFrequencePNI("1 min"); setShowFrequencePNIMenu(false); },
            () => { setSelectedFrequencePNI("2.5 min"); setShowFrequencePNIMenu(false); },
            () => { setSelectedFrequencePNI("5 min"); setShowFrequencePNIMenu(false); },
            () => { setSelectedFrequencePNI("10 min"); setShowFrequencePNIMenu(false); },
            () => { setSelectedFrequencePNI("15 min"); setShowFrequencePNIMenu(false); },
            () => { setSelectedFrequencePNI("30 min"); setShowFrequencePNIMenu(false); },
            () => { setSelectedFrequencePNI("60 min"); setShowFrequencePNIMenu(false); },
            () => { setSelectedFrequencePNI("120 min"); setShowFrequencePNIMenu(false); },
          ],
        };

        const currentActions = showMenu ? menuActions.main : showMesuresMenu ? menuActions.Mesures : showFCMenu ? menuActions.FC : showPNIMenu ? menuActions.PNI : showLimitesFCMenu ? menuActions.LimitesFC : showFrequencePNIMenu ? menuActions.FrequencePNI : [];
        currentActions[selectedMenuIndex]?.();
      },
    }));

    return (
      <div className="absolute inset-3 bg-gray-900 rounded-lg">
        <div className="h-full flex flex-col">
          <div className="h-1/6 border-b border-gray-600 flex items-center justify-between bg-black text-white text-sm font-mono grid grid-cols-3">
            <div className="flex items-center h-full">
              <div className="bg-orange-500 px-3 py-1 h-full flex flex-col justify-sart">
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
                  {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "")}{" "}
                  {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </div>
                <div className="w-4 h-3 bg-green-500 rounded-sm flex items-center justify-center">
                  <div className="w-2 h-1.5 bg-white rounded-xs"></div>
                </div>
              </div>
              {showFCValue && (rhythmType === "fibrillationVentriculaire" || rhythmType === "fibrillationAtriale") && (
                  <div className="w-35 h-4 bg-red-500 mb-2">
                    <span className="block text-center text-white text-xs mb-3">Analyse ECG impossible</span>
                  </div>
              )}
            </div>
          </div>

          <VitalsDisplay
            patient={patient}
            device={device}
            actions={actions}
            showCountdown={false}
          />

          <div className="flex-grow border-b border-gray-600 flex flex-col bg-black">
            <TwoLeadECGDisplay
              width={800}
              height={45}
              rhythmType={showFCValue ? rhythmType as any : "asystole"}
              showSynchroArrows={showSynchroArrows}
              heartRate={heartRate}
              energy={energy.toString()}
              chargeProgress={chargeProgress}
              shockCount={shockCount}
              isDottedAsystole={!showFCValue}
              showDefibrillatorInfo={false}
              showRhythmText={false}
              isPacing={device.is_pacing}
              pacerFrequency={device.pacer_frequency}
              pacerIntensity={device.pacer_intensity}
            />
          </div>

          {/* Row 5 - Pleth Graph */}
          <div className="h-1/5 border-b border-gray-600 flex flex-col items-center justify-start text-green-400 text-sm bg-black ">
            <PlethDisplay
              width={800}
              height={45}
              animationState={plethAnimation}
              isDotted={!showSpo2}
              isFlatLine={
                (rhythmType === "fibrillationVentriculaire" && showSpo2) ||
                (rhythmType === "tachycardieVentriculaire" && showSpo2) ||
                (rhythmType === "asystole" && showSpo2)
              }
            />
          </div>

          {/* Row 6 */}
          <div className=" bg-black h-1/12 flex items-center justify-between  text-white text-xs ">
            <div className="flex items-center gap-2">
              <div className="bg-gray-500 px-5 py-0.5 h-full flex flex-col justify-center text-xs ">
                <span>Début PNI</span>
              </div>
            </div>
            <div className="flex items-center gap-2"><span> </span></div>
            <div className="flex items-center gap-2">
              <div className="bg-gray-500 px-6 py-0.5 h-full flex flex-col justify-center text-xs">
                <span>Menu</span>
              </div>
            </div>
          </div>
        </div>

        {showMenu && renderMenu("Menu principal", menuConfigs.main, () => setShowMenu(false))}
        {showMesuresMenu && renderMenu("Mesures/Alarmes", menuConfigs.Mesures, () => setShowMesuresMenu(false))}
        {showFCMenu && renderMenu("FC/Arythmie", menuConfigs.FC, () => setShowFCMenu(false))}
        {showPNIMenu && renderMenu("PNI", menuConfigs.PNI, () => setShowPNIMenu(false))}
      </div>
    );
  },
);

MonitorDisplay.displayName = 'MonitorDisplay';
export default MonitorDisplay;