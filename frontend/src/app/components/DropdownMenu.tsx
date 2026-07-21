import React, { useState, useRef, useEffect } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Settings, Power, FileText, Github, Home, HelpCircle } from 'lucide-react';
import { useModals } from '../hooks/useModals';
import AboutModal from './modals/AboutModal';
import SettingsModal from './modals/SettingsModal';
import ScenariosListModal from './modals/ScenariosListModal';
import ScenarioModal from './modals/ScenarioModal';
import HelpModal from './modals/HelpModal'; 
import { useDefibrillator } from '../hooks/useDefibrillator';

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
  const { actions } = useDefibrillator();

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
          if (actions.resetState) {
              actions.resetState();
          } else {
              window.location.reload();
          }
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
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg border border-gray-600 transition-colors duration-200 shadow-lg cursor-pointer group outline-none">
          <span className="text-sm font-medium">Menu</span>
          <ChevronDown className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content className="w-64 bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl p-1.5 z-50 text-zinc-100 outline-none">
            {menuItems.map((item) => {
              if (item.label === 'separator') {
                return (
                  <DropdownMenuPrimitive.Separator
                    key={item.id}
                    className="h-[1px] bg-zinc-800 my-1.5"
                  />
                );
              }

              return (
                <DropdownMenuPrimitive.Item
                  key={item.id}
                  onClick={() => handleMenuItemClick(item.id)}
                  className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg cursor-pointer outline-none transition-colors ${
                    item.danger
                      ? 'text-red-400 hover:bg-red-950/40 focus:bg-red-950/40'
                      : 'text-zinc-200 hover:bg-zinc-800 focus:bg-zinc-800'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </DropdownMenuPrimitive.Item>
              );
            })}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>

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
