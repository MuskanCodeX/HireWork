import React, { useState } from 'react';
import { API_BASE } from '../config';
import { useAuth } from '../hooks/useAuth';
import { Shield, Upload, X } from 'lucide-react';

interface VerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [documentType, setDocumentType] = useState('Aadhaar');
    const [docFile, setDocFile] = useState<File | null>(null);
    const [selfieFile, setSelfieFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!docFile || !selfieFile) {
            setError('Please upload both your ID document and a selfie.');
            return;
        }

        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('documentType', documentType);
        formData.append('documentImage', docFile);
        formData.append('selfieImage', selfieFile);

        try {
            const res = await fetch(`${API_BASE}/verification`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${user?.token}`
                    // Do not set Content-Type, let browser set it with boundary for FormData
                },
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => {
                    setSuccess(false);
                    onClose();
                }, 2000);
            } else {
                setError(data.message || 'Failed to submit verification request.');
            }
        } catch (err: any) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1"
                >
                    <X size={20} />
                </button>

                <div className="p-6 border-b border-gray-800 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Verify Identity</h2>
                        <p className="text-sm text-gray-400">Get the blue checkmark</p>
                    </div>
                </div>

                <div className="p-6">
                    {success ? (
                        <div className="text-center py-8" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-400">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Submitted Successfully!</h3>
                            <p className="text-gray-400">Our admins will review your document shortly.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm text-center">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Document Type</label>
                                <select
                                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                    value={documentType}
                                    onChange={(e) => setDocumentType(e.target.value)}
                                >
                                    <option value="Aadhaar">Aadhaar Card</option>
                                    <option value="Passport">Passport</option>
                                    <option value="Driving License">Driving License</option>
                                    <option value="PAN Card">PAN Card</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">ID Document (Front)</label>
                                    <div className="mt-1 flex justify-center px-4 py-4 border-2 border-gray-800 border-dashed rounded-xl hover:border-blue-500/50 transition-colors bg-gray-950/50 relative group cursor-pointer">
                                        <input
                                            type="file"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            accept="image/*"
                                            onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                                        />
                                        <div className="space-y-1 text-center">
                                            {docFile ? (
                                                <div className="text-blue-400 flex flex-col items-center">
                                                    <Shield className="mx-auto h-8 w-8" />
                                                    <p className="text-xs font-medium truncate max-w-[150px] mt-1">{docFile.name}</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <Upload className="mx-auto h-6 w-6 text-gray-500 group-hover:text-blue-400 transition-colors" />
                                                    <div className="text-xs text-gray-400">
                                                        <span className="text-blue-400 font-medium">Upload ID</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Selfie with ID</label>
                                    <div className="mt-1 flex justify-center px-4 py-4 border-2 border-gray-800 border-dashed rounded-xl hover:border-blue-500/50 transition-colors bg-gray-950/50 relative group cursor-pointer">
                                        <input
                                            type="file"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            accept="image/*"
                                            onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                                        />
                                        <div className="space-y-1 text-center">
                                            {selfieFile ? (
                                                <div className="text-blue-400 flex flex-col items-center">
                                                    <Upload className="mx-auto h-8 w-8" />
                                                    <p className="text-xs font-medium truncate max-w-[150px] mt-1">{selfieFile.name}</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <Upload className="mx-auto h-6 w-6 text-gray-500 group-hover:text-blue-400 transition-colors" />
                                                    <div className="text-xs text-gray-400">
                                                        <span className="text-blue-400 font-medium">Upload Selfie</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3">
                                <p className="text-[11px] text-gray-500 leading-relaxed text-center">
                                    <Shield size={12} className="inline mr-1 text-blue-400" />
                                    Your data is encrypted and used only for identity verification. All documents will be <span className="text-blue-400 font-bold">permanently deleted</span> once verification is complete.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition-colors mt-2 disabled:opacity-50 flex justify-center items-center"
                            >
                                {loading ? (
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : 'Submit for Verification'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
