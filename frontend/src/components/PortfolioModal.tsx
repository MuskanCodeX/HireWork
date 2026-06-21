import React, { useState } from 'react';
import { API_BASE } from '../config';
import { useAuth } from '../hooks/useAuth';
import { Briefcase, X, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';

interface PortfolioModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export const PortfolioModal: React.FC<PortfolioModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [externalLink, setExternalLink] = useState('');
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            if (files.length + imageFiles.length > 3) {
                setError('You can upload a maximum of 3 images.');
                return;
            }
            setImageFiles(prev => [...prev, ...files]);
            setError('');
        }
    };

    const removeFile = (index: number) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !description) {
            setError('Please provide at least a title and description.');
            return;
        }

        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('externalLink', externalLink);
        imageFiles.forEach(file => {
            formData.append('images', file);
        });

        try {
            const res = await fetch(`${API_BASE}/portfolio`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${user?.token}`
                },
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                setSuccess(true);
                if (onSuccess) onSuccess();
                setTimeout(() => {
                    setSuccess(false);
                    onClose();
                    // Reset fields
                    setTitle('');
                    setDescription('');
                    setExternalLink('');
                    setImageFiles([]);
                }, 2000);
            } else {
                setError(data.message || 'Failed to submit portfolio item.');
            }
        } catch (err: any) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1 z-10"
                >
                    <X size={20} />
                </button>

                <div className="p-6 border-b border-gray-800 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Briefcase size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Add Portfolio Work</h2>
                        <p className="text-sm text-gray-400">Showcase your best projects</p>
                    </div>
                </div>

                <div className="p-6 max-h-[80vh] overflow-y-auto">
                    {success ? (
                        <div className="text-center py-8" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-400">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Submitted for Review!</h3>
                            <p className="text-gray-400 text-sm">Our team will verify your submission shortly. It will be hidden until approved.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-[13px] text-center">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Project Title</label>
                                <input
                                    type="text"
                                    placeholder="e.g., E-commerce App Redesign"
                                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Description</label>
                                <textarea
                                    placeholder="Briefly explain what you did, the tools used, and the results..."
                                    rows={4}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors resize-none"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">External Link (Optional)</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600">
                                        <LinkIcon size={14} />
                                    </div>
                                    <input
                                        type="url"
                                        placeholder="https://yourproject.com"
                                        className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                                        value={externalLink}
                                        onChange={(e) => setExternalLink(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Project Images (Max 3)</label>
                                <div className="grid grid-cols-3 gap-3 mb-3">
                                    {imageFiles.map((file, idx) => (
                                        <div key={idx} className="aspect-video bg-gray-950 border border-gray-800 rounded-lg relative group overflow-hidden">
                                            <img
                                                src={URL.createObjectURL(file)}
                                                alt="Preview"
                                                className="w-full h-full object-cover opacity-60"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeFile(idx)}
                                                className="absolute inset-0 flex items-center justify-center bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={16} className="text-white" />
                                            </button>
                                        </div>
                                    ))}
                                    {imageFiles.length < 3 && (
                                        <div className="aspect-video bg-gray-950 border-2 border-dashed border-gray-800 rounded-lg flex items-center justify-center relative hover:border-emerald-500/30 transition-colors cursor-pointer">
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={handleFileChange}
                                            />
                                            <ImageIcon size={20} className="text-gray-600" />
                                        </div>
                                    )}
                                </div>
                                <p className="text-[10px] text-gray-600 italic">Recommended: 16:9 aspect ratio, under 5MB per image.</p>
                            </div>

                            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 mt-4">
                                <p className="text-[11px] text-amber-500/80 leading-relaxed text-center font-medium">
                                    Notice: Do NOT include phone numbers, emails, or WhatsApp links. Such submissions will be rejected immediately.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-gray-950 font-black py-4 px-4 rounded-xl transition-all mt-4 disabled:opacity-50 flex justify-center items-center gap-2 uppercase tracking-widest text-xs"
                            >
                                {loading ? (
                                    <svg className="animate-spin h-4 w-4 text-gray-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <>
                                        Submit for Approval
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
