import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, className }) => {
    // Effect to handle the 'Escape' key press
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-[100]"
            onClick={onClose} // Close the modal if the background is clicked
        >
            {/* This is the actual modal panel */}
            <div
                className={`bg-gray-800 rounded-lg p-6 w-full mx-4 border border-gray-600 shadow-2xl max-h-[90vh] flex flex-col ${className || 'max-w-lg'}`}
                onClick={(e) => e.stopPropagation()} // Prevent clicks inside the panel from closing the modal
            >
                {children}
            </div>
        </div>,
        document.body
    );
};

export default Modal;
