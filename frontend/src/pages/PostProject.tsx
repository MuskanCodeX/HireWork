import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE } from '../config';
import toast from 'react-hot-toast';
import { OutsideCommWarning } from '../components/OutsideCommWarning';
import { ActionReviewOverlay } from '../components/ActionReviewOverlay';

export const PostProject = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [budget, setBudget] = useState('');
    const [warning, setWarning] = useState<{ show: boolean; message?: string; cooldownMs?: number; label?: string }>({ show: false });
    const [aiWarning, setAiWarning] = useState<any | null>(null);
    const [safetyResult, setSafetyResult] = useState<any | null>(null);
    const [safetyLoading, setSafetyLoading] = useState(false);
    const [safetyError, setSafetyError] = useState<string | null>(null);

    const [enhanceLoading, setEnhanceLoading] = useState(false);
    const [enhanceError, setEnhanceError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reviewOverlay, setReviewOverlay] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

    const [limitWarning, setLimitWarning] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

    const [verificationPopup, setVerificationPopup] = useState<{ show: boolean; isVerified: boolean; message?: string }>({ show: false, isVerified: false });
    const [userVerification, setUserVerification] = useState<{ isAadhaarVerified: boolean; isEmailVerified: boolean; isPhoneVerified: boolean } | null>(null);

    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user?.token) {
            fetchUserVerification();
        }
    }, [user?.token]);

    const fetchUserVerification = async () => {
        if (!user?.token) return null;
        try {
            const res = await fetch(`${API_BASE}/auth/me`, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            const data = await res.json();
            if (res.ok) {
                const verificationPayload = {
                    isAadhaarVerified: data.isAadhaarVerified || false,
                    isEmailVerified: data.isEmailVerified || false,
                    isPhoneVerified: data.isPhoneVerified || false
                };
                setUserVerification(verificationPayload);
                return verificationPayload;
            }
        } catch (err) {
            console.error('Error fetching verification:', err);
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || isSubmitting) return;

        setIsSubmitting(true);
        setReviewOverlay({ open: true, message: 'We are making sure your project follows platform guidelines.' });

        try {
            const response = await fetch(`${API_BASE}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                body: JSON.stringify({ title, description, budget }),
            });
            const data = await response.json();
            if (response.ok) {
                setWarning({ show: false });
                const hasWarn = data?.aiWarning && data.aiWarning.severity && data.aiWarning.severity !== 'low';
                setAiWarning(hasWarn ? data.aiWarning : null);
                if (hasWarn) {
                    setSafetyResult(data.aiWarning);
                }

                const contextVerified = Boolean((user as any)?.isAadhaarVerified || (user as any)?.isPhoneVerified);
                const cachedVerified = Boolean(userVerification?.isAadhaarVerified || userVerification?.isPhoneVerified);
                const responseVerified = typeof data?.ownerVerified === 'boolean' ? data.ownerVerified : undefined;
                const isVerified = typeof responseVerified === 'boolean' ? responseVerified : (cachedVerified || contextVerified);

                setVerificationPopup({
                    show: true,
                    isVerified,
                    message: isVerified
                        ? 'Your project has been posted successfully!'
                        : 'Your project has been posted but is pending verification. Complete your Aadhaar or Phone verification to go live.'
                });

                setTimeout(() => {
                    navigate('/projects/my');
                }, 2000);
            } else {
                const hasWarn = data?.aiWarning && data.aiWarning.severity && data.aiWarning.severity !== 'low';
                setAiWarning(hasWarn ? data.aiWarning : null);
                if (data.error_code === 'POST_LIMIT_REACHED') {
                    setLimitWarning({ show: true, message: data.message });
                } else if (data.warning) {
                    setWarning({ show: true, message: data.message, cooldownMs: data.cooldownMs, label: data.label });
                } else {
                    setWarning({ show: false });
                    toast.error(data.message);
                }
            }
        } catch (error) {
            console.error('Error posting project:', error);
        } finally {
            setIsSubmitting(false);
            setReviewOverlay({ open: false, message: '' });
        }
    };

    const runAiSafetyCheck = async () => {
        if (!user) return toast.error('Please log in to run the safety check.');
        if (!title.trim() || !description.trim()) {
            setSafetyError('Add a title and description first.');
            return;
        }
        setSafetyError(null);
        setSafetyLoading(true);
        try {
            const res = await fetch(`${API_BASE}/ai/screen-project`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
                body: JSON.stringify({ title, description })
            });
            const data = await res.json();
            if (res.ok) {
                setSafetyResult(data.screening);
                const hasWarn = data?.screening && data.screening.severity && data.screening.severity !== 'low';
                setAiWarning(hasWarn ? data.screening : null);
            } else {
                setSafetyError(data.message || 'Unable to run AI safety check');
            }
        } catch (err) {
            console.error('Safety check error:', err);
            setSafetyError('AI safety check failed. Please try again.');
        } finally {
            setSafetyLoading(false);
        }
    };

    const handleEnhanceProject = async () => {
        if (!user) return toast.error('Please log in to use AI features.');
        if (!title.trim() && !description.trim()) {
            setEnhanceError('Add a rough title or description first.');
            return;
        }
        setEnhanceError(null);
        setEnhanceLoading(true);
        setReviewOverlay({ open: true, message: 'AI is enhancing your project brief. This usually takes a few seconds.' });
        try {
            const res = await fetch(`${API_BASE}/ai/enhance-project`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
                body: JSON.stringify({
                    title,
                    description,
                    budget: Number(budget) || undefined
                })
            });
            const data = await res.json();
            if (res.ok && data.enhanced) {
                if (data.enhanced.title) setTitle(data.enhanced.title);
                if (data.enhanced.description) setDescription(data.enhanced.description);
            } else {
                setEnhanceError(data.message || 'Unable to enhance project details');
            }
        } catch (err) {
            console.error('Enhance error:', err);
            setEnhanceError('AI enhancement failed. Please try again.');
        } finally {
            setEnhanceLoading(false);
            setReviewOverlay({ open: false, message: '' });
        }
    };

    return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center py-12">
            <div className="w-full max-w-2xl px-4">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Post a New Project</h1>
                    <p className="text-gray-500">Describe your project and find the right talent on HIREWORK.</p>
                </div>
                <div className="card">
                    <OutsideCommWarning show={warning.show} message={warning.message} cooldownMs={warning.cooldownMs} label={warning.label} />
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-gray-400 text-sm font-medium mb-2">Project Title</label>
                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" required placeholder="e.g. Build a Modern SaaS Dashboard" />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm font-medium mb-2">Description</label>
                            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-field h-40 resize-none" required placeholder="Describe your project in detail..." />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm font-medium mb-2">Budget (₹)</label>
                            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="input-field" required placeholder="500" />
                        </div>
                        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-4">
                            {/* AI Enhance Project */}
                            <div className="border-t border-gray-800 pt-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">AI Assistant</p>
                                        <p className="text-white font-bold text-sm">Enhance Project Details</p>
                                        <p className="text-xs text-gray-400 mt-1">Automatically writes a professional title and detailed description based on your rough ideas.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleEnhanceProject}
                                        className="btn-secondary text-xs px-4 py-2 flex items-center gap-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap"
                                        disabled={enhanceLoading}
                                    >
                                        {enhanceLoading ? (
                                            <><div className="w-3 h-3 border-2 border-purple-400/20 border-t-purple-400 rounded-full animate-spin" /> Enhancing...</>
                                        ) : (
                                            <>✨ Enhance Project</>
                                        )}
                                    </button>
                                </div>
                                {enhanceError && <p className="text-red-400 text-xs mt-2">{enhanceError}</p>}
                            </div>
                        </div>
                        {aiWarning && (
                            <div className={`rounded-xl border p-4 ${aiWarning.severity === 'block' ? 'bg-red-500/5 border-red-500/40' : 'bg-amber-500/5 border-amber-500/30'}`}>
                                <p className="text-sm font-semibold text-white mb-1">AI Review Notice</p>
                                <p className="text-xs text-gray-300">{aiWarning.notes || 'Our automated guardrails flagged parts of this description. Please avoid off-platform contact or sensitive requests.'}</p>
                            </div>
                        )}
                        <div className="flex gap-4 pt-2">
                            <button type="button" onClick={() => navigate(-1)} className="btn-secondary w-full">Cancel</button>
                            <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
                                {isSubmitting ? 'Posting…' : 'Post Project'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Verification Popup */}
            {verificationPopup.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className={`bg-gray-900 border rounded-2xl w-full max-w-md p-6 shadow-2xl ${verificationPopup.isVerified ? 'border-emerald-500/50' : 'border-amber-500/50'}`}>
                        <div className="text-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${verificationPopup.isVerified ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                                {verificationPopup.isVerified ? (
                                    <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                )}
                            </div>
                            <h3 className={`text-xl font-bold mb-2 ${verificationPopup.isVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {verificationPopup.isVerified ? 'Project Posted!' : 'Verification Required'}
                            </h3>
                            <p className="text-gray-300 mb-4">{verificationPopup.message}</p>

                            {!verificationPopup.isVerified && (
                                <div className="space-y-3">
                                    <p className="text-gray-500 text-sm">To publish your project, please verify your identity:</p>
                                    <Link
                                        to="/profile"
                                        className="block w-full bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold py-3 rounded-xl transition-colors"
                                        onClick={() => setVerificationPopup({ show: false, isVerified: false })}
                                    >
                                        Complete Verification
                                    </Link>
                                    <button
                                        onClick={() => {
                                            setVerificationPopup({ show: false, isVerified: false });
                                            navigate('/projects/my');
                                        }}
                                        className="text-gray-500 hover:text-gray-300 text-sm"
                                    >
                                        Maybe Later
                                    </button>
                                </div>
                            )}

                            {verificationPopup.isVerified && (
                                <button
                                    onClick={() => setVerificationPopup({ show: false, isVerified: true })}
                                    className="mt-2 text-emerald-400 hover:text-emerald-300 text-sm"
                                >
                                    Great!
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Daily Posting Limit Modal */}
            {limitWarning.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 border border-amber-500/50 rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-[40px]" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-red-500/10 rounded-full blur-[40px]" />
                        <div className="relative z-10 text-center">
                            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
                                <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-amber-400 mb-2">Posting Limit Reached</h3>
                            <p className="text-gray-300 mb-6">{limitWarning.message}</p>
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => setLimitWarning({ show: false, message: '' })}
                                    className="flex-1 py-2.5 rounded-xl font-semibold bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => {
                                        setLimitWarning({ show: false, message: '' });
                                        navigate('/membership');
                                    }}
                                    className="flex-1 py-2.5 rounded-xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 hover:opacity-90 text-gray-950 transition-all shadow-lg"
                                >
                                    Upgrade Plan
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ActionReviewOverlay open={reviewOverlay.open} message={reviewOverlay.message} />
        </div>
    );
};
