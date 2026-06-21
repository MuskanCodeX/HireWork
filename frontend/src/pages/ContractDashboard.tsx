import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE, SERVER_BASE } from '../config';
import { ReviewModal } from '../components/ReviewModal';
import { ConfirmModal } from '../components/ConfirmModal';
import toast from 'react-hot-toast';

interface Milestone {
    index: number;
    title: string;
    amount: number;
    status: 'pending' | 'paid' | 'confirmed';
    taskDoneByEmployer: boolean;
    taskDoneByFreelancer: boolean;
    taskConfirmed: boolean;
    paidNote: string;
    proofImage: string | null;
    paidAt: string | null;
    confirmedAt: string | null;
}

interface Agreement {
    _id: string;
    projectId: string;
    projectTitle: string;
    employerId: string;
    employerName: string;
    freelancerId: string;
    freelancerName: string;
    amount: number;
    milestones: Milestone[];
    projectDescription?: string;
    projectRules?: string;
    projectTimeline?: string;
    additionalTerms?: string;
    agreementFullText: string;
    status: string;
    agreementStatus: 'pending' | 'accepted' | 'cancelled';
    dispute?: {
        raisedById: string;
        raisedByName: string;
        raisedByRole: 'employer' | 'freelancer';
        type: string;
        reason: string;
        milestoneIndex: number | null;
        evidenceImage: string | null;
        createdAt: string;
    } | null;
    disputeResolution?: {
        outcome: 'refund_employer' | 'pay_freelancer';
        verificationChecklist: string[];
        verificationNotes: string;
        resolvedByName: string;
        resolvedAt: string;
    } | null;
    reviewedByEmployer: boolean;
    reviewedByFreelancer: boolean;
    createdAt: string;
    updatedAt: string;
}

export const ContractDashboard = () => {
    const { user } = useAuth();
    const [agreements, setAgreements] = useState<Agreement[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Freelancer info cache (upiId, qrImage)
    const [freelancerInfo, setFreelancerInfo] = useState<Record<string, any>>({});

    // Pay modal state
    const [payModal, setPayModal] = useState<{
        agreementId: string;
        milestoneIndex: number;
        freelancerName: string;
        freelancerId: string;
        amount: number;
    } | null>(null);
    const [payNote, setPayNote] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Receive modal state (for freelancer to view proof and confirm)
    const [receiveModal, setReceiveModal] = useState<{
        agreementId: string;
        milestoneIndex: number;
        proofImage: string | null;
        paidNote: string;
        amount: number;
    } | null>(null);

    // Structured dispute modal
    const [disputeModal, setDisputeModal] = useState<{
        agreementId: string;
        milestoneIndex: number | null;
        type: string;
        title: string;
    } | null>(null);
    const [disputeReason, setDisputeReason] = useState('');
    const [disputeEvidenceFile, setDisputeEvidenceFile] = useState<File | null>(null);
    const [disputeEvidencePreview, setDisputeEvidencePreview] = useState<string | null>(null);
    const disputeFileInputRef = useRef<HTMLInputElement>(null);

    // Review modal state
    const [reviewModal, setReviewModal] = useState<{
        agreementId: string;
        revieweeName: string;
    } | null>(null);

    // View Agreement expanded state
    const [expandedAgreement, setExpandedAgreement] = useState<string | null>(null);

    // Confirm modal state
    const [confirmConfig, setConfirmConfig] = useState<{
        agreementId: string;
        type: 'accept' | 'cancel';
    } | null>(null);

    useEffect(() => {
        if (user) fetchAgreements();
    }, [user?._id, user?.token]);

    const fetchAgreements = async () => {
        try {
            const res = await fetch(`${API_BASE}/contracts`, {
                headers: { Authorization: `Bearer ${user!.token}` },
            });
            const data = await res.json();
            if (res.ok && Array.isArray(data)) {
                setAgreements(data);
                const ids = [...new Set(data.map((a: Agreement) => a.freelancerId))];
                for (const fid of ids) {
                    try {
                        // Fetch payment info securely for each freelancer in an agreement
                        const r = await fetch(`${API_BASE}/auth/${fid}/payment-info`, {
                            headers: { Authorization: `Bearer ${user?.token}` }
                        });
                        const d = await r.json();
                        if (r.ok) setFreelancerInfo(prev => ({ ...prev, [fid as string]: d }));
                    } catch { }
                }
            }
        } catch (err) {
            console.error('Error fetching agreements:', err);
        } finally {
            setLoading(false);
        }
    };

    // ── Task Done ──────────────────────────────────────────────────────────────
    const handleTaskDone = async (agreementId: string, milestoneIndex: number) => {
        if (!user) return;
        setActionLoading(`taskdone-${agreementId}-${milestoneIndex}`);
        try {
            const res = await fetch(
                `${API_BASE}/contracts/${agreementId}/milestone/${milestoneIndex}/task-done`,
                { method: 'PATCH', headers: { Authorization: `Bearer ${user.token}` } }
            );
            if (res.ok) {
                fetchAgreements();
            } else {
                const d = await res.json();
                toast.error(d.message);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    // ── Mark Paid (with proof image) ──────────────────────────────────────────
    const handleMarkPaid = async () => {
        if (!payModal || !user) return;
        setActionLoading(`paid-${payModal.agreementId}-${payModal.milestoneIndex}`);
        try {
            const formData = new FormData();
            if (payNote) formData.append('note', payNote);
            if (proofFile) formData.append('proofImage', proofFile);

            const res = await fetch(
                `${API_BASE}/contracts/${payModal.agreementId}/milestone/${payModal.milestoneIndex}/paid`,
                {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${user.token}` },
                    body: formData,
                }
            );
            if (res.ok) {
                closePayModal();
                fetchAgreements();
            } else {
                const d = await res.json();
                toast.error(d.message);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    // ── Confirm Received ──────────────────────────────────────────────────────
    const handleConfirmReceived = async () => {
        if (!receiveModal || !user) return;
        setActionLoading(`confirm-${receiveModal.agreementId}-${receiveModal.milestoneIndex}`);
        try {
            const res = await fetch(
                `${API_BASE}/contracts/${receiveModal.agreementId}/milestone/${receiveModal.milestoneIndex}/confirm`,
                { method: 'PATCH', headers: { Authorization: `Bearer ${user.token}` } }
            );
            if (res.ok) {
                setReceiveModal(null);
                fetchAgreements();
            } else {
                const d = await res.json();
                toast.error(d.message);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    const closeDisputeModal = () => {
        setDisputeModal(null);
        setDisputeReason('');
        setDisputeEvidenceFile(null);
        setDisputeEvidencePreview(null);
    };

    const onDisputeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setDisputeEvidenceFile(file);
        const reader = new FileReader();
        reader.onload = ev => setDisputeEvidencePreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleRaiseDispute = async () => {
        if (!disputeModal || !user) return;
        if (disputeReason.trim().length < 10) {
            toast.error('Please describe the dispute in at least 10 characters.');
            return;
        }

        setActionLoading(`dispute-${disputeModal.agreementId}`);
        try {
            const formData = new FormData();
            formData.append('reason', disputeReason.trim());
            formData.append('type', disputeModal.type);
            if (disputeModal.milestoneIndex !== null) {
                formData.append('milestoneIndex', String(disputeModal.milestoneIndex));
            }
            if (disputeEvidenceFile) formData.append('evidenceImage', disputeEvidenceFile);

            const res = await fetch(`${API_BASE}/contracts/${disputeModal.agreementId}/dispute`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${user.token}` },
                body: formData
            });

            if (res.ok) {
                closeDisputeModal();
                setReceiveModal(null);
                fetchAgreements();
            } else {
                const data = await res.json();
                toast.error(data.message || 'Failed to raise dispute');
            }
        } catch (err) {
            console.error(err);
            toast.error('Could not raise dispute. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    // ── Accept Agreement ─────────────────────────────────────────────────────────
    const handleAcceptAgreement = async (agreementId: string) => {
        if (!user) return;
        if (!confirmConfig) {
            setConfirmConfig({ agreementId, type: 'accept' });
            return;
        }
        setConfirmConfig(null);

        setActionLoading(`accept-${agreementId}`);
        try {
            const res = await fetch(`${API_BASE}/contracts/${agreementId}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
                body: JSON.stringify({ action: 'accept' }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Agreement accepted! The project is now underway.');
                fetchAgreements();
            } else if (res.status === 402 && data.needsCredits) {
                toast.error(data.message);
            } else {
                toast.error(data.message || 'Failed to accept agreement');
            }
        } catch (err) {
            console.error(err);
            toast.error('Could not accept agreement. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    // ── Cancel Agreement ─────────────────────────────────────────────────────────
    const handleCancelAgreement = async (agreementId: string) => {
        if (!user) return;
        if (!confirmConfig) {
            setConfirmConfig({ agreementId, type: 'cancel' });
            return;
        }
        setConfirmConfig(null);

        setActionLoading(`cancel-${agreementId}`);
        try {
            const res = await fetch(`${API_BASE}/contracts/${agreementId}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
                body: JSON.stringify({ action: 'cancel' }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || 'Agreement cancelled.');
                fetchAgreements();
            } else {
                toast.error(data.message || 'Failed to cancel agreement');
            }
        } catch (err) {
            console.error(err);
            toast.error('Could not cancel agreement. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const closePayModal = () => {
        setPayModal(null);
        setPayNote('');
        setProofFile(null);
        setProofPreview(null);
    };

    const onProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setProofFile(file);
        const reader = new FileReader();
        reader.onload = ev => setProofPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    // ── Milestone step indicator ───────────────────────────────────────────────
    const getMilestoneState = (m: Milestone, isEmployer: boolean) => {
        if (m.status === 'confirmed') return 'completed';
        if (m.status === 'paid') return isEmployer ? 'awaiting_confirm' : 'needs_confirm';
        if (m.taskConfirmed) return isEmployer ? 'pay_now' : 'awaiting_payment';
        const myDone = isEmployer ? m.taskDoneByEmployer : m.taskDoneByFreelancer;
        const otherDone = isEmployer ? m.taskDoneByFreelancer : m.taskDoneByEmployer;
        if (myDone && !otherDone) return 'waiting_other';
        if (!myDone) return 'mark_done';
        return 'mark_done';
    };

    const buildProtectedUploadUrl = (relativePath: string | null) => {
        if (!relativePath) return '';
        const tokenParam = user?.token ? `?token=${encodeURIComponent(user.token)}` : '';
        return `${SERVER_BASE}${relativePath}${tokenParam}`;
    };

    if (!user) return (
        <div className="container mx-auto px-4 py-20 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Payments Dashboard</h2>
            <p className="text-gray-400 mb-6">Log in to view your payment agreements.</p>
            <Link to="/login" className="btn-primary">Log In</Link>
        </div>
    );

    if (loading) return (
        <div className="container mx-auto px-4 py-20 text-center text-gray-400">Loading...</div>
    );

    return (
        <div className="container mx-auto px-4 py-10">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">💳 Payments Dashboard</h1>
                <p className="text-gray-400 text-sm">Track milestone payments for your projects. All payments are made directly via UPI/QR.</p>
            </div>

            {/* Notice */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-8 flex items-start gap-3">
                <span className="text-amber-400 text-lg mt-0.5">⚠️</span>
                <div>
                    <p className="text-amber-400/90 text-sm font-medium">Important Notice</p>
                    <p className="text-gray-400 text-xs mt-1">
                        We do not hold, manage, or process any payments. All payments are made directly between client and freelancer via UPI/QR.
                        <Link to="/terms" className="text-amber-400 underline ml-1">Read full Terms &amp; Conditions</Link>
                    </p>
                </div>
            </div>

            {/* Step Guide */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 mb-8">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">How it works</p>
                <div className="flex flex-wrap gap-4 items-center">
                    {[
                        { step: '1', label: 'Both confirm task done', icon: '✅' },
                        { step: '2', label: 'Client pays via UPI/QR', icon: '💸' },
                        { step: '3', label: 'Client uploads proof', icon: '📸' },
                        { step: '4', label: 'Freelancer confirms receipt', icon: '🤝' },
                        { step: '5', label: 'Milestone complete!', icon: '🎉' },
                    ].map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 text-[10px] font-black flex items-center justify-center">{s.step}</div>
                            <span className="text-gray-400 text-xs">{s.icon} {s.label}</span>
                            {i < 4 && <span className="text-gray-600 text-xs hidden sm:block">→</span>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Pending Agreements Section */}
            {agreements.filter(a => a.agreementStatus === 'pending').length > 0 && (
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        ⏳ Pending Agreements
                        <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
                            {agreements.filter(a => a.agreementStatus === 'pending').length}
                        </span>
                    </h2>
                    <div className="space-y-4">
                        {agreements.filter(a => a.agreementStatus === 'pending').map(agreement => {
                            const isEmployer = agreement.employerId === user._id;
                            const isFreelancer = agreement.freelancerId === user._id;
                            const totalAmount = agreement.milestones.reduce((sum, m) => sum + m.amount, 0);

                            return (
                                <div key={agreement._id} className="card border-amber-500/30 bg-amber-500/5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-white">{agreement.projectTitle}</h3>
                                            <p className="text-gray-400 text-sm mt-1">
                                                {isEmployer
                                                    ? `Sent to freelancer: ${agreement.freelancerName}`
                                                    : `From client: ${agreement.employerName}`}
                                            </p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <span className="text-emerald-400 font-bold">₹{totalAmount}</span>
                                                <span className="text-gray-500">•</span>
                                                <span className="text-gray-400 text-sm">{agreement.milestones.length} milestones</span>
                                            </div>

                                            {/* Show milestones preview */}
                                            <div className="mt-3 space-y-1">
                                                {agreement.milestones.map((m, idx) => (
                                                    <div key={idx} className="flex justify-between text-xs text-gray-400 max-w-xs">
                                                        <span>{m.title}</span>
                                                        <span className="text-gray-400">₹{m.amount}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Agreement details for freelancer to review before accepting */}
                                            {isFreelancer && (
                                                <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/5 overflow-hidden">
                                                    <div className="flex items-center gap-2 px-4 py-3 border-b border-violet-500/20">
                                                        <span className="text-violet-400 text-base">📄</span>
                                                        <h4 className="text-white text-sm font-bold">Agreement Terms — Please Read Before Accepting</h4>
                                                    </div>
                                                    <div className="p-4 space-y-4">
                                                        {agreement.projectDescription ? (
                                                            <div>
                                                                <span className="text-violet-300 text-xs font-bold uppercase tracking-wider">🎯 Project Description & Requirements</span>
                                                                <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap leading-relaxed">{agreement.projectDescription}</p>
                                                            </div>
                                                        ) : null}
                                                        {agreement.projectRules ? (
                                                            <div>
                                                                <span className="text-violet-300 text-xs font-bold uppercase tracking-wider">📋 Rules & Terms</span>
                                                                <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap leading-relaxed">{agreement.projectRules}</p>
                                                            </div>
                                                        ) : null}
                                                        {agreement.projectTimeline ? (
                                                            <div>
                                                                <span className="text-violet-300 text-xs font-bold uppercase tracking-wider">⏰ Timeline & Deadlines</span>
                                                                <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap leading-relaxed">{agreement.projectTimeline}</p>
                                                            </div>
                                                        ) : null}
                                                        {agreement.additionalTerms ? (
                                                            <div>
                                                                <span className="text-violet-300 text-xs font-bold uppercase tracking-wider">📝 Additional Terms</span>
                                                                <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap leading-relaxed">{agreement.additionalTerms}</p>
                                                            </div>
                                                        ) : null}
                                                        {!agreement.projectDescription && !agreement.projectRules && !agreement.projectTimeline && !agreement.additionalTerms && (
                                                            <p className="text-gray-400 text-sm italic">No additional terms specified by the client.</p>
                                                        )}
                                                        <div className="pt-2 border-t border-violet-500/20">
                                                            <p className="text-amber-400 text-xs">
                                                                ⚠️ By accepting, you agree to all terms above. These will be binding in case of any dispute.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {/* Employer view: show what was sent */}
                                            {isEmployer && (agreement.projectDescription || agreement.projectRules || agreement.projectTimeline || agreement.additionalTerms) && (
                                                <div className="mt-4 rounded-xl border border-gray-700 bg-gray-800/40 overflow-hidden">
                                                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-700">
                                                        <span className="text-gray-400 text-sm">📄</span>
                                                        <h4 className="text-gray-300 text-sm font-semibold">Agreement Terms You Sent</h4>
                                                    </div>
                                                    <div className="p-4 space-y-3">
                                                        {agreement.projectDescription && <div><span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Project Description</span><p className="text-gray-400 text-xs mt-1 whitespace-pre-wrap">{agreement.projectDescription}</p></div>}
                                                        {agreement.projectRules && <div><span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Rules & Terms</span><p className="text-gray-400 text-xs mt-1 whitespace-pre-wrap">{agreement.projectRules}</p></div>}
                                                        {agreement.projectTimeline && <div><span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Timeline</span><p className="text-gray-400 text-xs mt-1 whitespace-pre-wrap">{agreement.projectTimeline}</p></div>}
                                                        {agreement.additionalTerms && <div><span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Additional Terms</span><p className="text-gray-400 text-xs mt-1 whitespace-pre-wrap">{agreement.additionalTerms}</p></div>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            {isFreelancer && (
                                                <>
                                                    <button
                                                        onClick={() => handleAcceptAgreement(agreement._id)}
                                                        disabled={actionLoading === `accept-${agreement._id}`}
                                                        className="bg-emerald-500 text-gray-950 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-400 transition-all disabled:opacity-50"
                                                    >
                                                        {actionLoading === `accept-${agreement._id}` ? 'Accepting...' : '✓ Accept Agreement'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancelAgreement(agreement._id)}
                                                        disabled={actionLoading === `cancel-${agreement._id}`}
                                                        className="bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-600 transition-all disabled:opacity-50"
                                                    >
                                                        {actionLoading === `cancel-${agreement._id}` ? 'Cancelling...' : '✕ Cancel'}
                                                    </button>
                                                </>
                                            )}
                                            {isEmployer && (
                                                <button
                                                    onClick={() => handleCancelAgreement(agreement._id)}
                                                    disabled={actionLoading === `cancel-${agreement._id}`}
                                                    className="bg-red-600/20 text-red-400 border border-red-600/30 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-600/30 transition-all disabled:opacity-50"
                                                >
                                                    {actionLoading === `cancel-${agreement._id}` ? 'Cancelling...' : '✕ Cancel Agreement'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Agreements - only show accepted agreements in payments section */}
            {agreements.filter(a => a.agreementStatus === 'accepted').length === 0 && agreements.filter(a => a.agreementStatus === 'pending').length === 0 ? (
                <div className="card text-center py-16">
                    <p className="text-4xl mb-4">📋</p>
                    <h3 className="text-xl font-bold text-white mb-2">No Agreements Yet</h3>
                    <p className="text-gray-400 mb-6">When you award or get awarded a project, it will appear here.</p>
                    <Link to="/projects" className="btn-primary">Browse Projects</Link>
                </div>
            ) : (
                <div className="space-y-6">
                    {agreements.filter(a => a.agreementStatus === 'accepted').map(agreement => {
                        const isEmployer = agreement.employerId === user._id;
                        const isFreelancer = agreement.freelancerId === user._id;
                        const fInfo = freelancerInfo[agreement.freelancerId];
                        const confirmedCount = agreement.milestones.filter(m => m.status === 'confirmed').length;
                        const total = agreement.milestones.length;
                        const progress = total > 0 ? (confirmedCount / total) * 100 : 0;

                        return (
                            <div key={agreement._id} className="card">
                                {/* Card Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-800">
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{agreement.projectTitle}</h3>
                                        <p className="text-gray-400 text-sm mt-1">
                                            {isEmployer ? 'Freelancer' : 'Client'}: <span className="text-gray-300 font-medium">{isEmployer ? agreement.freelancerName : agreement.employerName}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <span className="text-emerald-400 font-bold text-lg">₹{agreement.amount}</span>
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${agreement.status === 'completed'
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : agreement.status === 'disputed'
                                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                            }`}>
                                            {agreement.status === 'completed' ? '✓ Completed' : agreement.status === 'disputed' ? '⚠ Disputed' : '● Active'}
                                        </span>
                                    </div>
                                </div>

                                {/* Progress */}
                                <div className="mb-6">
                                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                                        <span>Progress</span>
                                        <span>{confirmedCount}/{total} milestones completed</span>
                                    </div>
                                    <div className="w-full bg-gray-800 rounded-full h-2">
                                        <div className="bg-emerald-500 h-2 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                                    </div>
                                </div>

                                {agreement.status === 'disputed' && agreement.dispute && (
                                    <div className="mb-6 bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                                        <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-2">Dispute Summary</p>
                                        <p className="text-gray-300 text-sm">
                                            Raised by <span className="font-semibold">{agreement.dispute.raisedByName}</span>
                                            {' '}({agreement.dispute.raisedByRole}) on {new Date(agreement.dispute.createdAt).toLocaleString()}
                                        </p>
                                        <p className="text-gray-400 text-sm mt-1">{agreement.dispute.reason}</p>
                                        {agreement.dispute.milestoneIndex !== null && (
                                            <p className="text-gray-400 text-xs mt-1">Related milestone: #{agreement.dispute.milestoneIndex + 1}</p>
                                        )}
                                    </div>
                                )}

                                {/* Freelancer payment info — always show to employer */}
                                {isEmployer && fInfo && (fInfo.upiId || fInfo.qrImage) && (
                                    <div className="bg-gray-800/50 rounded-xl p-4 mb-6 border border-gray-700/50">
                                        <h4 className="text-sm font-bold text-gray-300 mb-3">💳 Freelancer's Payment Details</h4>
                                        <div className="flex flex-col sm:flex-row gap-4 items-start">
                                            {fInfo.upiId && (
                                                <div className="flex-1">
                                                    <span className="text-gray-400 text-xs block mb-1">UPI ID</span>
                                                    <button
                                                        onClick={() => { navigator.clipboard.writeText(fInfo.upiId); }}
                                                        className="text-white font-mono text-sm bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-700 inline-flex items-center gap-2 hover:border-emerald-500/50 transition-colors"
                                                    >
                                                        {fInfo.upiId}
                                                        <span className="text-gray-400 text-xs">📋</span>
                                                    </button>
                                                </div>
                                            )}
                                            {fInfo.qrImage && (
                                                <div className="flex-shrink-0">
                                                    <span className="text-gray-400 text-xs block mb-1">QR Code</span>
                                                    <img src={`${SERVER_BASE}${fInfo.qrImage}`} alt="Payment QR" width="128" height="128" className="w-32 h-32 rounded-lg border border-gray-700 object-contain bg-white" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Milestones */}
                                <div className="space-y-3">
                                    {agreement.milestones.map((milestone, mIdx) => {
                                        const state = getMilestoneState(milestone, isEmployer);
                                        const isLoading = actionLoading?.startsWith(`taskdone-${agreement._id}-${mIdx}`) ||
                                            actionLoading?.startsWith(`paid-${agreement._id}-${mIdx}`) ||
                                            actionLoading?.startsWith(`confirm-${agreement._id}-${mIdx}`);

                                        let borderColor = 'border-gray-700/50';
                                        let bgColor = 'bg-gray-800/30';
                                        if (state === 'completed') { borderColor = 'border-emerald-500/30'; bgColor = 'bg-emerald-500/5'; }
                                        else if (state === 'pay_now') { borderColor = 'border-violet-500/30'; bgColor = 'bg-violet-500/5'; }
                                        else if (state === 'needs_confirm') { borderColor = 'border-blue-500/30'; bgColor = 'bg-blue-500/5'; }
                                        else if (state === 'awaiting_payment' || state === 'awaiting_confirm') { borderColor = 'border-amber-500/30'; bgColor = 'bg-amber-500/5'; }

                                        return (
                                            <div key={mIdx} className={`rounded-xl border p-4 transition-all ${borderColor} ${bgColor}`}>
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                                            <span className="text-white font-semibold text-sm">{milestone.title}</span>
                                                            {/* Status badge */}
                                                            {state === 'completed' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">✅ Payment Confirmed</span>}
                                                            {state === 'awaiting_payment' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">⏳ Awaiting Payment</span>}
                                                            {state === 'awaiting_confirm' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">⏳ Awaiting Confirmation</span>}
                                                            {state === 'needs_confirm' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">💸 Payment Received</span>}
                                                            {state === 'pay_now' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/30">🎯 Ready to Pay</span>}
                                                            {state === 'waiting_other' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-700 text-gray-400 border border-gray-600">⏳ Waiting for other party</span>}
                                                            {state === 'mark_done' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-700 text-gray-400 border border-gray-600">Pending</span>}
                                                        </div>
                                                        <span className="text-emerald-400 font-bold text-sm">₹{milestone.amount}</span>

                                                        {/* Task done indicators */}
                                                        {milestone.status === 'pending' && (
                                                            <div className="flex gap-3 mt-2">
                                                                <span className={`text-[10px] flex items-center gap-1 ${milestone.taskDoneByEmployer ? 'text-emerald-400' : 'text-gray-500'}`}>
                                                                    {milestone.taskDoneByEmployer ? '✓' : '○'} Client confirmed
                                                                </span>
                                                                <span className={`text-[10px] flex items-center gap-1 ${milestone.taskDoneByFreelancer ? 'text-emerald-400' : 'text-gray-500'}`}>
                                                                    {milestone.taskDoneByFreelancer ? '✓' : '○'} Freelancer confirmed
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Payment note */}
                                                        {milestone.paidNote && (
                                                            <p className="text-gray-400 text-xs mt-1.5">📝 {milestone.paidNote}</p>
                                                        )}
                                                        {milestone.paidAt && (
                                                            <p className="text-gray-500 text-[10px] mt-0.5">Paid: {new Date(milestone.paidAt).toLocaleString()}</p>
                                                        )}
                                                        {milestone.confirmedAt && (
                                                            <p className="text-gray-500 text-[10px]">Confirmed: {new Date(milestone.confirmedAt).toLocaleString()}</p>
                                                        )}
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex gap-2 flex-shrink-0 flex-wrap">

                                                        {/* BOTH: Mark task done */}
                                                        {state === 'mark_done' && (
                                                            <button
                                                                onClick={() => handleTaskDone(agreement._id, mIdx)}
                                                                disabled={!!isLoading}
                                                                className="bg-violet-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-violet-400 transition-all disabled:opacity-50 active:scale-95 whitespace-nowrap"
                                                            >
                                                                {isLoading ? 'Saving...' : '✅ Mark Task Done'}
                                                            </button>
                                                        )}

                                                        {/* Waiting for other */}
                                                        {state === 'waiting_other' && (
                                                            <span className="text-gray-400 text-xs italic px-3 py-2">Waiting for {isEmployer ? 'freelancer' : 'client'}…</span>
                                                        )}

                                                        {/* CLIENT: Pay now */}
                                                        {state === 'pay_now' && isEmployer && (
                                                            <button
                                                                onClick={() => setPayModal({
                                                                    agreementId: agreement._id,
                                                                    milestoneIndex: mIdx,
                                                                    freelancerName: agreement.freelancerName,
                                                                    freelancerId: agreement.freelancerId,
                                                                    amount: milestone.amount,
                                                                })}
                                                                disabled={!!isLoading}
                                                                className="bg-emerald-500 text-gray-950 px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-400 transition-all disabled:opacity-50 active:scale-95 whitespace-nowrap shadow-lg shadow-emerald-500/20"
                                                            >
                                                                💸 Pay Now
                                                            </button>
                                                        )}

                                                        {/* FREELANCER: Awaiting payment label */}
                                                        {state === 'awaiting_payment' && (
                                                            <span className="text-amber-400 text-xs italic px-3 py-2">Awaiting client payment…</span>
                                                        )}

                                                        {/* CLIENT: Payment sent, awaiting confirmation */}
                                                        {state === 'awaiting_confirm' && (
                                                            <span className="text-amber-400 text-xs italic px-3 py-2">Awaiting freelancer confirmation…</span>
                                                        )}

                                                        {/* FREELANCER: I Received (opens modal with proof) */}
                                                        {state === 'needs_confirm' && isFreelancer && (
                                                            <button
                                                                onClick={() => setReceiveModal({
                                                                    agreementId: agreement._id,
                                                                    milestoneIndex: mIdx,
                                                                    proofImage: milestone.proofImage,
                                                                    paidNote: milestone.paidNote,
                                                                    amount: milestone.amount,
                                                                })}
                                                                disabled={!!isLoading}
                                                                className="bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-400 transition-all disabled:opacity-50 active:scale-95 whitespace-nowrap"
                                                            >
                                                                👁 View Proof &amp; Confirm
                                                            </button>
                                                        )}

                                                        {/* Completed */}
                                                        {state === 'completed' && (
                                                            <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                                                                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px]">✓</span>
                                                                Done
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* View Agreement Panel */}
                                {(agreement.projectDescription || agreement.projectRules || agreement.projectTimeline || agreement.additionalTerms) && (
                                    <div className="mt-5">
                                        <button
                                            onClick={() => setExpandedAgreement(expandedAgreement === agreement._id ? null : agreement._id)}
                                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-700 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/60 transition-all text-sm font-semibold text-gray-300"
                                        >
                                            <span className="flex items-center gap-2">
                                                <span>📄</span> View Agreement Terms
                                            </span>
                                            <span className={`text-gray-400 transition-transform duration-200 ${expandedAgreement === agreement._id ? 'rotate-180' : ''}`}>▾</span>
                                        </button>
                                        {expandedAgreement === agreement._id && (
                                            <div className="mt-2 rounded-xl border border-gray-700 bg-gray-900/60 overflow-hidden" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                                                <div className="p-4 space-y-4">
                                                    {agreement.projectDescription ? (
                                                        <div>
                                                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">🎯 Project Description & Requirements</span>
                                                            <p className="text-gray-300 text-sm mt-1.5 whitespace-pre-wrap leading-relaxed">{agreement.projectDescription}</p>
                                                        </div>
                                                    ) : null}
                                                    {agreement.projectRules ? (
                                                        <div>
                                                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">📋 Rules & Terms</span>
                                                            <p className="text-gray-300 text-sm mt-1.5 whitespace-pre-wrap leading-relaxed">{agreement.projectRules}</p>
                                                        </div>
                                                    ) : null}
                                                    {agreement.projectTimeline ? (
                                                        <div>
                                                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">⏰ Timeline & Deadlines</span>
                                                            <p className="text-gray-300 text-sm mt-1.5 whitespace-pre-wrap leading-relaxed">{agreement.projectTimeline}</p>
                                                        </div>
                                                    ) : null}
                                                    {agreement.additionalTerms ? (
                                                        <div>
                                                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">📝 Additional Terms</span>
                                                            <p className="text-gray-300 text-sm mt-1.5 whitespace-pre-wrap leading-relaxed">{agreement.additionalTerms}</p>
                                                        </div>
                                                    ) : null}
                                                    <div className="pt-3 border-t border-gray-800 flex items-center justify-between">
                                                        <p className="text-gray-500 text-xs">Agreement created: {new Date(agreement.createdAt).toLocaleDateString()}</p>
                                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ Accepted</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Dispute & Review Actions */}
                                {(agreement.status === 'active' || (agreement.status === 'completed' && !(isEmployer ? agreement.reviewedByEmployer : agreement.reviewedByFreelancer))) && (
                                    <div className="mt-4 pt-4 border-t border-gray-800 flex justify-end gap-3">
                                        {agreement.status === 'active' && (
                                            <button
                                                onClick={() => {
                                                    setDisputeModal({
                                                        agreementId: agreement._id,
                                                        milestoneIndex: null,
                                                        type: 'general',
                                                        title: 'Raise Dispute'
                                                    });
                                                }}
                                                className="flex-1 sm:flex-none text-red-400/60 hover:text-red-400 text-xs font-semibold py-2 transition-colors text-right"
                                            >
                                                ⚠ Raise Dispute
                                            </button>
                                        )}
                                        {agreement.status === 'completed' && !(isEmployer ? agreement.reviewedByEmployer : agreement.reviewedByFreelancer) && (
                                            <button
                                                onClick={() => setReviewModal({
                                                    agreementId: agreement._id,
                                                    revieweeName: isEmployer ? agreement.freelancerName : agreement.employerName
                                                })}
                                                className="bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-950 px-5 py-2 rounded-lg text-xs font-bold hover:from-amber-400 hover:to-yellow-400 shadow-lg shadow-amber-500/20 transition-all active:scale-95 flex items-center gap-2"
                                            >
                                                ⭐ Leave a Review
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── PAY MODAL ─────────────────────────────────────────────────────────── */}
            {payModal && (() => {
                const fInfo = freelancerInfo[payModal.freelancerId];
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-xl font-bold text-white">💸 Pay {payModal.freelancerName}</h3>
                                    <button onClick={closePayModal} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
                                </div>
                                <p className="text-gray-400 text-sm mb-6">
                                    Send <span className="text-emerald-400 font-semibold">₹{payModal.amount}</span> via UPI and upload your payment screenshot below.
                                </p>

                                {/* UPI + QR */}
                                {fInfo && (fInfo.upiId || fInfo.qrImage) ? (
                                    <div className="bg-gray-800/60 rounded-xl p-4 mb-5 border border-gray-700/50">
                                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Payment Details</p>
                                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                                            {fInfo.upiId && (
                                                <div className="flex-1 w-full">
                                                    <p className="text-gray-400 text-xs mb-1">UPI ID — tap to copy</p>
                                                    <button
                                                        onClick={() => { navigator.clipboard.writeText(fInfo.upiId); }}
                                                        className="w-full text-left text-white font-mono text-sm bg-gray-900 px-3 py-2.5 rounded-lg border border-gray-700 hover:border-emerald-500/50 transition-colors flex items-center justify-between group"
                                                    >
                                                        <span>{fInfo.upiId}</span>
                                                        <span className="text-gray-500 group-hover:text-emerald-400 text-xs transition-colors">📋 Copy</span>
                                                    </button>
                                                </div>
                                            )}
                                            {fInfo.qrImage && (
                                                <div className="flex-shrink-0 text-center">
                                                    <p className="text-gray-400 text-xs mb-1">Scan QR</p>
                                                    <img
                                                        src={`${SERVER_BASE}${fInfo.qrImage}`}
                                                        alt="QR Code"
                                                        width="144"
                                                        height="144"
                                                        className="w-36 h-36 rounded-xl border-2 border-gray-700 object-contain bg-white shadow-lg"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-5">
                                        <p className="text-amber-400 text-sm">⚠️ Freelancer hasn't added UPI/QR yet. Contact them directly.</p>
                                    </div>
                                )}

                                {/* Proof Upload */}
                                <div className="mb-4">
                                    <label className="block text-gray-400 text-sm font-medium mb-2">📸 Upload Payment Screenshot <span className="text-gray-500 text-xs font-normal">(optional but recommended)</span></label>
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${proofPreview ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'}`}
                                    >
                                        {proofPreview ? (
                                            <div>
                                                <img src={proofPreview} alt="Proof" width="300" height="160" className="max-h-40 mx-auto rounded-lg object-contain mb-2" />
                                                <p className="text-emerald-400 text-xs font-medium">{proofFile?.name}</p>
                                                <p className="text-gray-500 text-xs mt-1">Click to change</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-4xl mb-2">📷</p>
                                                <p className="text-gray-400 text-sm">Click to upload screenshot</p>
                                                <p className="text-gray-500 text-xs mt-1">JPG, PNG, GIF up to 10MB</p>
                                            </div>
                                        )}
                                    </div>
                                    <input ref={fileInputRef} type="file" accept="image/*" onChange={onProofFileChange} className="hidden" />
                                </div>

                                {/* Note */}
                                <div className="mb-6">
                                    <label className="block text-gray-400 text-sm font-medium mb-2">Transaction Note <span className="text-gray-500 text-xs font-normal">(optional)</span></label>
                                    <input
                                        type="text"
                                        value={payNote}
                                        onChange={e => setPayNote(e.target.value)}
                                        className="input-field text-sm"
                                        placeholder="e.g. UPI Ref: 1234567890"
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={closePayModal} className="flex-1 btn-secondary !py-2.5 text-sm">Cancel</button>
                                    <button
                                        onClick={handleMarkPaid}
                                        disabled={actionLoading !== null}
                                        className="flex-1 bg-emerald-500 text-gray-950 font-bold py-2.5 rounded-lg text-sm hover:bg-emerald-400 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                                    >
                                        {actionLoading ? 'Submitting...' : '✅ I Have Paid'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── RECEIVE MODAL (Freelancer views proof) ────────────────────────────── */}
            {receiveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-xl font-bold text-white">🤝 Confirm Receipt</h3>
                                <button onClick={() => setReceiveModal(null)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
                            </div>
                            <p className="text-gray-400 text-sm mb-6">
                                Client has marked <span className="text-emerald-400 font-semibold">₹{receiveModal.amount}</span> as paid. Review the proof below and confirm if you received it.
                            </p>

                            {/* Proof image */}
                            {receiveModal.proofImage ? (
                                <div className="mb-5">
                                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Payment Proof Screenshot</p>
                                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                                        <img
                                            src={buildProtectedUploadUrl(receiveModal.proofImage)}
                                            alt="Payment proof"
                                            width="400"
                                            height="256"
                                            className="w-full max-h-64 object-contain"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-5 text-center">
                                    <p className="text-gray-400 text-sm">No screenshot uploaded by client.</p>
                                </div>
                            )}

                            {/* Note */}
                            {receiveModal.paidNote && (
                                <div className="bg-gray-800/50 rounded-lg p-3 mb-5 border border-gray-700">
                                    <p className="text-gray-400 text-xs font-bold mb-1">Transaction Note</p>
                                    <p className="text-white text-sm">{receiveModal.paidNote}</p>
                                </div>
                            )}

                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-6">
                                <p className="text-amber-400 text-xs">⚠️ Only confirm if you have actually received the payment. This action cannot be undone.</p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setDisputeModal({
                                            agreementId: receiveModal.agreementId,
                                            milestoneIndex: receiveModal.milestoneIndex,
                                            type: 'payment_not_received',
                                            title: 'I Have Not Received Payment'
                                        });
                                        setReceiveModal(null);
                                    }}
                                    className="flex-1 bg-red-500/10 text-red-400 border border-red-500/30 font-bold py-2.5 rounded-lg text-sm hover:bg-red-500/20 transition-all"
                                >
                                    ⚠ I Have Not Received Payment
                                </button>
                                <button
                                    onClick={handleConfirmReceived}
                                    disabled={actionLoading !== null}
                                    className="flex-1 bg-blue-500 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-blue-400 transition-all disabled:opacity-50"
                                >
                                    {actionLoading ? 'Confirming...' : '✅ I Have Received Payment'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── REVIEW MODAL ────────────────────────────── */}
            {disputeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xl font-bold text-white">⚠ {disputeModal.title}</h3>
                                <button onClick={closeDisputeModal} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
                            </div>
                            <p className="text-gray-400 text-sm mb-5">
                                Share the exact issue so admin can verify both sides fairly.
                            </p>

                            <div className="mb-4">
                                <label className="block text-gray-400 text-sm font-medium mb-2">Dispute reason <span className="text-red-400">*</span></label>
                                <textarea
                                    value={disputeReason}
                                    onChange={(e) => setDisputeReason(e.target.value)}
                                    className="input-field h-28 resize-none text-sm"
                                    placeholder="Include transaction details, timeline, and what is incorrect."
                                />
                            </div>

                            <div className="mb-5">
                                <label className="block text-gray-400 text-sm font-medium mb-2">Evidence (optional)</label>
                                <div
                                    onClick={() => disputeFileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${disputeEvidencePreview ? 'border-red-500/40 bg-red-500/5' : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'}`}
                                >
                                    {disputeEvidencePreview ? (
                                        <div>
                                            <img src={disputeEvidencePreview} alt="Dispute evidence preview" width="300" height="160" className="max-h-40 mx-auto rounded-lg object-contain mb-2" />
                                            <p className="text-red-400 text-xs font-medium">{disputeEvidenceFile?.name}</p>
                                            <p className="text-gray-500 text-xs mt-1">Click to change</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-3xl mb-2">📎</p>
                                            <p className="text-gray-400 text-sm">Attach screenshot or PDF</p>
                                        </div>
                                    )}
                                </div>
                                <input
                                    ref={disputeFileInputRef}
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={onDisputeFileChange}
                                    className="hidden"
                                />
                            </div>

                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-6">
                                <p className="text-amber-400 text-xs">False disputes can lead to account action after admin review.</p>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={closeDisputeModal} className="flex-1 btn-secondary !py-2.5 text-sm">Cancel</button>
                                <button
                                    onClick={handleRaiseDispute}
                                    disabled={actionLoading === `dispute-${disputeModal.agreementId}`}
                                    className="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-red-400 transition-all disabled:opacity-50"
                                >
                                    {actionLoading === `dispute-${disputeModal.agreementId}` ? 'Submitting...' : 'Submit Dispute'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {reviewModal && (
                <ReviewModal
                    isOpen={!!reviewModal}
                    onClose={() => setReviewModal(null)}
                    agreementId={reviewModal.agreementId}
                    revieweeName={reviewModal.revieweeName}
                    onSuccess={() => fetchAgreements()}
                />
            )}

            <ConfirmModal
                isOpen={!!confirmConfig}
                title={confirmConfig?.type === 'accept' ? 'Accept Agreement' : 'Cancel Agreement'}
                message={confirmConfig?.type === 'accept'
                    ? 'Are you sure you want to accept this agreement? 1 credit will be deducted from both you and the client.'
                    : 'Are you sure you want to cancel this agreement? No credits will be deducted and the freelancer will be able to bid on this project again.'
                }
                confirmText={confirmConfig?.type === 'accept' ? 'Accept' : 'Cancel'}
                onConfirm={() => {
                    if (confirmConfig?.type === 'accept') handleAcceptAgreement(confirmConfig.agreementId);
                    else if (confirmConfig?.type === 'cancel') handleCancelAgreement(confirmConfig.agreementId);
                }}
                onCancel={() => setConfirmConfig(null)}
                isDanger={confirmConfig?.type === 'cancel'}
            />
        </div>
    );
};
