import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, className }) => {
    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]" />
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <Dialog.Content
                        className={`bg-[#09090b] border border-zinc-800 rounded-2xl p-6 w-full text-zinc-100 shadow-2xl max-h-[90vh] flex flex-col focus:outline-none ${className || 'max-w-lg'}`}
                    >
                        {children}
                    </Dialog.Content>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default Modal;
