import React from 'react';

interface BrandLogoProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showText?: boolean;
    className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'md', className = '' }) => {
    const textDim = {
        sm: 'text-xl',
        md: 'text-2xl',
        lg: 'text-3xl md:text-4xl',
        xl: 'text-4xl md:text-5xl'
    }[size];

    return (
        <div className={`flex items-center select-none group ${className}`}>
            <span className={`${textDim} font-black tracking-tight leading-none transition-transform group-hover:scale-105 duration-200`}>
                <span className="text-white">HIRE</span><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">WORK</span>
            </span>
        </div>
    );
};
