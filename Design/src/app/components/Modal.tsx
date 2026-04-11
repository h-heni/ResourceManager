import React from 'react';
import { X } from 'lucide-react';
//import { cn } from '../lib/utils'; // Assuming you have this utility

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-full'
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className={`bg-white sm:rounded-2xl shadow-xl w-full ${sizeClasses[size]} h-full sm:h-auto sm:max-h-[90vh] overflow-hidden animate-slide-up flex flex-col`}>
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                    {children}
                </div>
            </div>
        </div>
    );
}
