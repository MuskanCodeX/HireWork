import React from 'react';

interface ActionReviewOverlayProps {
    open: boolean;
    message?: string;
}

export const ActionReviewOverlay: React.FC<ActionReviewOverlayProps> = ({ open, message }) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md px-4">
            <div className="w-full max-w-sm rounded-3xl border border-gray-800/80 bg-gray-900/95 px-6 py-8 text-center shadow-[0_30px_120px_rgba(0,0,0,0.6)]">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-400/30">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-400" />
                </div>
                <p className="text-[11px] font-semibold tracking-[0.5em] text-gray-500 uppercase">Please wait</p>
                <h3 className="mt-2 text-xl font-black text-white">AI is reviewing</h3>
                <p className="mt-3 text-sm text-gray-400">
                    {message || 'We are scanning your submission to keep the community safe.'}
                </p>
            </div>
        </div>
    );
};
