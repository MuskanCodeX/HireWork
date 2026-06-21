import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ExternalLink, Calendar, User, Info } from 'lucide-react';
import { API_BASE } from '../config';

import type { PortfolioItem } from '../types/portfolio';

interface PortfolioViewerProps {
    item: PortfolioItem | null;
    isOpen: boolean;
    onClose: () => void;
}

const SERVER_BASE = API_BASE.replace(/\/api$/, '');

export const PortfolioViewer: React.FC<PortfolioViewerProps> = ({ item, isOpen, onClose }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Reset index when item changes
    useEffect(() => {
        setCurrentImageIndex(0);
    }, [item?._id]);

    if (!item) return null;

    const nextImage = () => {
        if (item.images.length > 0) {
            setCurrentImageIndex((prev) => (prev + 1) % item.images.length);
        }
    };

    const prevImage = () => {
        if (item.images.length > 0) {
            setCurrentImageIndex((prev) => (prev - 1 + item.images.length) % item.images.length);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 md:p-8"
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
                    >
                        <X size={24} />
                    </button>

                    <motion.div
                        initial={{ scale: 0.9, y: 20, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.9, y: 20, opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="w-full max-w-7xl h-full flex flex-col md:flex-row overflow-hidden rounded-3xl border border-white/10 bg-gray-950/50 shadow-2xl shadow-black/50"
                    >
                        {/* Image Section */}
                        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden group">
                            <AnimatePresence mode="wait">
                                {item.images.length > 0 ? (
                                    <motion.img
                                        key={currentImageIndex}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.4, ease: "easeOut" }}
                                        src={item.images[currentImageIndex].startsWith('/uploads') ? `${SERVER_BASE}${item.images[currentImageIndex]}` : `${SERVER_BASE}/uploads/portfolio/${item.images[currentImageIndex]}`}
                                        alt={item.title}
                                        className="max-h-full max-w-full object-contain"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-4 text-gray-700">
                                        <Info size={64} />
                                        <p>No images for this project</p>
                                    </div>
                                )}
                            </AnimatePresence>

                            {/* Navigation Arrows */}
                            {item.images.length > 1 && (
                                <>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); prevImage(); }}
                                        className="absolute left-4 p-3 rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/5 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
                                    >
                                        <ChevronLeft size={28} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); nextImage(); }}
                                        className="absolute right-4 p-3 rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/5 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
                                    >
                                        <ChevronRight size={28} />
                                    </button>
                                </>
                            )}

                            {/* Image Indicators */}
                            {item.images.length > 1 && (
                                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                                    {item.images.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentImageIndex ? 'w-8 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'w-2 bg-white/30'}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Details Section */}
                        <div className="w-full md:w-[400px] border-l border-white/10 flex flex-col bg-gray-900/40 backdrop-blur-xl">
                            <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">
                                            Project Detail
                                        </span>
                                        {item.status !== 'approved' && (
                                            <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-wider border border-amber-500/20">
                                                {item.status}
                                            </span>
                                        )}
                                    </div>

                                    <h2 className="text-3xl font-bold text-white mb-2 leading-tight">
                                        {item.title}
                                    </h2>

                                    <div className="flex flex-wrap gap-4 mb-8">
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <div className="p-1.5 rounded-lg bg-gray-800">
                                                <User size={14} className="text-indigo-400" />
                                            </div>
                                            <span className="text-xs font-semibold">{item.user?.name || 'User'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <div className="p-1.5 rounded-lg bg-gray-800">
                                                <Calendar size={14} className="text-emerald-400" />
                                            </div>
                                            <span className="text-xs font-semibold">{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3 ml-1">About Project</h3>
                                            <div className="relative">
                                                <div className="absolute -left-4 top-0 bottom-0 w-1 bg-emerald-500/20 rounded-full" />
                                                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                                    {item.description}
                                                </p>
                                            </div>
                                        </div>

                                        {item.externalLink && (
                                            <motion.a
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                href={item.externalLink}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all border border-white/5 group"
                                            >
                                                <ExternalLink size={18} className="text-emerald-400 group-hover:rotate-12 transition-transform" />
                                                Visit Live Project
                                            </motion.a>
                                        )}
                                    </div>
                                </motion.div>
                            </div>

                            <div className="p-6 border-t border-white/5 bg-black/20">
                                <p className="text-[10px] text-gray-600 text-center uppercase tracking-widest font-bold">
                                    HIREWORK Verified Work
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
