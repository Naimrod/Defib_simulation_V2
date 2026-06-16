import React from 'react';
import { HelpCircle, X } from 'lucide-react';
import Modal from './Modal';
import Image from 'next/image';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-4xl">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-blue-400" />
                    Aide - Commandes
                </h2>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="w-full">
                <Image
                    src="/images/commands.png"
                    alt="Commandes du simulateur"
                    width={1280}
                    height={720}
                    layout="responsive"
                    quality={100}
                    className="rounded-lg"
                />
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    Fermer
                </button>
            </div>
        </Modal>
    );
};

export default HelpModal;
