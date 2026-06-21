import React, { useState, useEffect } from 'react';

interface PromptModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: (value: string) => void;
    onCancel: () => void;
    initialValue?: string;
}

export const PromptModal: React.FC<PromptModalProps> = ({
    isOpen,
    title,
    message,
    placeholder = 'Type here...',
    confirmText = 'Submit',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    initialValue = ''
}) => {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        if (isOpen) setValue(initialValue);
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(value);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                    <p className="text-gray-400 text-sm mb-4">{message}</p>

                    <form onSubmit={handleSubmit}>
                        <textarea
                            autoFocus
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={placeholder}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all resize-none h-24"
                        />

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 text-gray-300 font-bold text-sm hover:bg-gray-800 transition-all active:scale-95"
                            >
                                {cancelText}
                            </button>
                            <button
                                type="submit"
                                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-sm transition-all active:scale-95"
                            >
                                {confirmText}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            {/* Backdrop click closer */}
            <div className="absolute inset-0 -z-10" onClick={onCancel}></div>
        </div>
    );
};
