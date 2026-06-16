import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Settings, Power, FileText, Github, Home, HelpCircle } from 'lucide-react';
import { useModals } from '../hooks/useModals';
import AboutModal from './modals/AboutModal';
import SettingsModal from './modals/SettingsModal';
import ScenariosListModal from './modals/ScenariosListModal';
import ScenarioModal from './modals/ScenarioModal';
import HelpModal from './modals/HelpModal'; 

interface DropdownMenuProps {
  onMenuItemSelect?: (action: string) => void;
  onScenarioSelect?: (scenarioId: string) => void;
  onModeSelect?: (mode: string) => void;
  onStartScenario?: (scenarioId: string) => void;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  onMenuItemSelect,
  onScenarioSelect,
  onStartScenario
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modals = useModals();

  // Fermer le menu quand on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleMenuItemClick = async (action: string) => {
    switch (action) {
      case 'home':
        window.location.href = '/';
        break;
      case 'scenarios':
        modals.openScenariosList();
        break;
      case 'settings':
        modals.openSettings();
        break;
      case 'help':
        modals.openHelp();
        break;
      case 'github':
        window.open('https://github.com/Mariussgal/Defib_simulation', '_blank');
        break;
      case 'reset':
        const confirmed = confirm('Redémarrer le simulateur ?');
        if (confirmed) {
          window.location.reload();
        }
        break;
      default:
        onMenuItemSelect?.(action);
        break;
    }
    setIsOpen(false);
  };

  const handleScenarioSelect = (scenarioId: string) => {
    modals.openScenario(scenarioId);
    onScenarioSelect?.(scenarioId);
  };

  const menuItems = [
    {
      id: 'home',
      label: 'Accueil',
      icon: <Home className="w-4 h-4" />,
    },
    { id: 'separator_1', label: 'separator' },
    {
      id: 'scenarios',
      label: 'Scénarios',
      icon: <FileText className="w-4 h-4" />,
    },
    { id: 'separator_3', label: 'separator' },
    {
      id: 'settings',
      label: 'Paramètres',
      icon: <Settings className="w-4 h-4" />,
    },
    {
      id: 'help',
      label: 'Aide',
      icon: <HelpCircle className="w-4 h-4" />,
    },
    {
      id: 'github',
      label: 'GitHub',
      icon: <Github className="w-4 h-4" />,
    },
    { id: 'separator_2', label: 'separator' },
    {
      id: 'reset',
      label: 'Redémarrer',
      icon: <Power className="w-4 h-4" />,
      danger: true
    },
  ];

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Bouton du menu */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg border border-gray-600 transition-colors duration-200 shadow-lg"
        >
          <span className="text-sm font-medium">Menu</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
              }`}
          />
        </button>

        {/* Menu déroulant */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-50 overflow-hidden">
            <div className="py-2">
              {menuItems.map((item) => {
                if (item.label === 'separator') {
                  return (
                    <div
                      key={item.id}
                      className="border-t border-gray-600 my-2"
                    />
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => handleMenuItemClick(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors duration-200 ${item.danger
                        ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20'
                        : 'text-white hover:bg-gray-700'
                      }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <SettingsModal
        isOpen={modals.showSettingsModal}
        onClose={modals.closeSettings}
      />

      <ScenariosListModal
        isOpen={modals.showScenariosListModal}
        onClose={modals.closeScenarioslist}
        onScenarioSelect={handleScenarioSelect}
      />

      <ScenarioModal
        isOpen={modals.showScenarioModal}
        onClose={modals.closeScenario}
        scenarioId={modals.selectedScenario}
        onStartScenario={onStartScenario || (() => { })}
      />

      <HelpModal
        isOpen={modals.showHelpModal}
        onClose={modals.closeHelp}
      />
    </>
  );
};

export default DropdownMenu;
