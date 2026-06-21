import React from 'react';

interface OutsideCommWarningProps {
    show: boolean;
    message?: string;
    detectedType?: string;
    label?: string;
    cooldownMs?: number;
}

const formatCooldown = (ms?: number) => {
    if (!ms || ms <= 0) return '';
    if (ms < 60_000) return `${Math.ceil(ms / 1000)}s`;
    const minutes = Math.ceil(ms / 60000);
    return `${minutes}m`;
};

export const OutsideCommWarning: React.FC<OutsideCommWarningProps> = ({ 
    show, 
    message = '⚠️ WARNING: For your safety, please do not share contact information outside of HIREWORK. All communication should happen within our platform to ensure secure transactions and dispute resolution. Sharing personal contact information may result in account suspension.',
    detectedType,
    label,
    cooldownMs
}) => {
    if (!show) return null;
    const cooldownText = formatCooldown(cooldownMs);

    return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
                <div className="text-2xl">⚠️</div>
                <div>
                    <div className="flex items-center gap-2">
                        <h4 className="text-red-400 font-bold text-sm">
                            {label ? `Contact Information Detected (${label})` : 'Outside Communication Detected'}
                        </h4>
                        {cooldownText && (
                            <span className="text-[10px] uppercase tracking-widest text-red-300 bg-red-500/10 border border-red-500/40 rounded-full px-2 py-0.5">
                                Wait {cooldownText}
                            </span>
                        )}
                    </div>
                    <p className="text-gray-300 text-xs leading-relaxed">
                        {message}
                    </p>
                </div>
            </div>
        </div>
    );
};

// Hook to handle outside communication warning state
export const useOutsideCommWarning = () => {
    const [warning, setWarning] = React.useState<{
        show: boolean;
        message?: string;
        detectedType?: string;
        label?: string;
        cooldownMs?: number;
    }>({ show: false });

    const checkForWarning = (error: any) => {
        if (error?.warning || error?.message?.includes('WARNING')) {
            setWarning({
                show: true,
                message: error.message,
                detectedType: error.detectedType,
                label: error.label,
                cooldownMs: error.cooldownMs
            });
            return true;
        }
        return false;
    };

    const clearWarning = () => setWarning({ show: false });

    return { warning, checkForWarning, clearWarning };
};
