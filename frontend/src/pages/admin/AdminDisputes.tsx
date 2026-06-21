import { useEffect, useState } from 'react';
import { API_BASE, SERVER_BASE } from '../../config';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { AlertTriangle, CheckCircle, Shield, Ban, MessageSquare, Loader2 } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';

type ChecklistKey = 'milestones' | 'proofs' | 'reason' | 'communication';

interface VerificationDraft {
    checklist: Record<ChecklistKey, boolean>;
    notes: string;
}

interface DisputeMessage {
    _id: string;
    senderRole: 'employer' | 'freelancer';
    senderName: string;
    content: string;
    createdAt: string;
    file?: {
        filename: string;
        originalName?: string;
        mimetype?: string;
        size?: number;
    } | null;
}

interface ConversationPayload {
    count: number;
    messages: DisputeMessage[];
}

const isImagePath = (value: string) => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(value || '');

const createDefaultDraft = (): VerificationDraft => ({
    checklist: {
        milestones: false,
        proofs: false,
        reason: false,
        communication: false
    },
    notes: ''
});

const checklistLabels: Record<ChecklistKey, string> = {
    milestones: 'Checked milestone/payment timeline',
    proofs: 'Reviewed payment proof/evidence files',
    reason: 'Reviewed dispute statement details',
    communication: 'Reviewed communication/context shared by parties'
};

export const AdminDisputes = () => {
    const { user } = useAuth();
    const [disputes, setDisputes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [confirmConfig, setConfirmConfig] = useState<{ id: string, outcome: string } | null>(null);
    const [verificationDrafts, setVerificationDrafts] = useState<Record<string, VerificationDraft>>({});
    const [conversationByContract, setConversationByContract] = useState<Record<string, ConversationPayload>>({});
    const [conversationOpen, setConversationOpen] = useState<Record<string, boolean>>({});
    const [conversationLoading, setConversationLoading] = useState<Record<string, boolean>>({});
    const [agreementOpen, setAgreementOpen] = useState<Record<string, boolean>>({});

    const fetchDisputes = async () => {
        try {
            const res = await fetch(`${API_BASE}/admin/disputes`, {
                headers: { Authorization: `Bearer ${user?.token}` },
                cache: 'no-store'
            });
            if (res.ok) {
                const data = await res.json();
                setDisputes(data);
                setVerificationDrafts(prev => {
                    const next = { ...prev };
                    data.forEach((contract: any) => {
                        if (!next[contract._id]) {
                            next[contract._id] = createDefaultDraft();
                        }
                    });
                    return next;
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.token) fetchDisputes();
    }, [user?._id, user?.token]);

    const updateDraft = (contractId: string, updater: (draft: VerificationDraft) => VerificationDraft) => {
        setVerificationDrafts(prev => ({
            ...prev,
            [contractId]: updater(prev[contractId] || createDefaultDraft())
        }));
    };

    const getProtectedUploadUrl = (pathOrFilename: string) => {
        if (!pathOrFilename) return '';
        if (/^https?:\/\//i.test(pathOrFilename)) return pathOrFilename;
        const tokenParam = encodeURIComponent(user?.token || '');
        if (pathOrFilename.startsWith('/uploads/')) {
            return `${SERVER_BASE}${pathOrFilename}?token=${tokenParam}`;
        }
        if (pathOrFilename.startsWith('uploads/')) {
            return `${SERVER_BASE}/${pathOrFilename}?token=${tokenParam}`;
        }
        return `${SERVER_BASE}/uploads/${pathOrFilename}?token=${tokenParam}`;
    };

    const fetchConversation = async (contractId: string) => {
        setConversationLoading(prev => ({ ...prev, [contractId]: true }));
        try {
            const res = await fetch(`${API_BASE}/admin/disputes/${contractId}/conversation`, {
                headers: { Authorization: `Bearer ${user?.token}` },
                cache: 'no-store'
            });
            const data = await res.json();
            if (res.ok) {
                setConversationByContract(prev => ({
                    ...prev,
                    [contractId]: {
                        count: data.count || 0,
                        messages: Array.isArray(data.messages) ? data.messages : []
                    }
                }));
            } else {
                toast.error(data.message || 'Failed to load conversation');
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to load conversation');
        } finally {
            setConversationLoading(prev => ({ ...prev, [contractId]: false }));
        }
    };

    const toggleConversation = async (contractId: string) => {
        const currentlyOpen = !!conversationOpen[contractId];
        if (currentlyOpen) {
            setConversationOpen(prev => ({ ...prev, [contractId]: false }));
            return;
        }

        setConversationOpen(prev => ({ ...prev, [contractId]: true }));
        if (!conversationByContract[contractId] && !conversationLoading[contractId]) {
            await fetchConversation(contractId);
        }
    };

    const handleResolve = async (contractId: string, outcome: string) => {
        const draft = verificationDrafts[contractId] || createDefaultDraft();
        const selectedChecklist = (Object.keys(draft.checklist) as ChecklistKey[])
            .filter((key) => draft.checklist[key])
            .map((key) => checklistLabels[key]);
        const notes = draft.notes.trim();

        if (selectedChecklist.length < 2 || notes.length < 20) {
            toast.error('Please complete verification: select at least 2 checklist items and add detailed notes (min 20 chars).');
            return;
        }

        if (!confirmConfig) {
            setConfirmConfig({ id: contractId, outcome });
            return;
        }

        setConfirmConfig(null);

        setResolvingId(contractId);
        try {
            const res = await fetch(`${API_BASE}/admin/disputes/${contractId}/resolve`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${user?.token}`
                },
                body: JSON.stringify({
                    outcome,
                    verificationChecklist: selectedChecklist,
                    verificationNotes: notes
                })
            });

            if (res.ok) {
                setDisputes(prev => prev.filter(c => c._id !== contractId));
            } else {
                const data = await res.json();
                toast.error(data.message || 'Error resolving dispute');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setResolvingId(null);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        Dispute Resolution Center
                    </h1>
                    <p className="text-gray-400 mt-1">Verify evidence and milestone facts before issuing admin rulings.</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 flex items-center gap-2">
                    <AlertTriangle className="text-red-400" size={20} />
                    <span className="text-white font-bold">{disputes.length}</span>
                    <span className="text-gray-500 text-sm">Active Disputes</span>
                </div>
            </div>

            {loading ? (
                <div className="animate-pulse space-y-4 pt-4">
                    <div className="h-10 bg-gray-800 rounded w-1/4"></div>
                    <div className="h-64 bg-gray-900 rounded-xl border border-gray-800"></div>
                </div>
            ) : disputes.length === 0 ? (
                <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-xl">
                    <Shield className="w-16 h-16 text-emerald-500/50 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Platform is Secure</h3>
                    <p className="text-gray-500">There are no active contract disputes at this time.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {disputes.map((contract) => {
                        const draft = verificationDrafts[contract._id] || createDefaultDraft();
                        const dispute = contract.dispute || null;
                        const disputeEvidenceUrl = dispute?.evidenceImage ? getProtectedUploadUrl(dispute.evidenceImage) : null;
                        const milestoneEvidencePath = dispute && dispute.milestoneIndex !== null && dispute.milestoneIndex !== undefined
                            ? contract.milestones?.[Number(dispute.milestoneIndex)]?.proofImage || null
                            : null;
                        const milestoneEvidenceUrl = milestoneEvidencePath ? getProtectedUploadUrl(milestoneEvidencePath) : null;
                        const primaryEvidenceUrl = disputeEvidenceUrl || milestoneEvidenceUrl;

                        return (
                            <div key={contract._id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
                                <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-800/30">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-xl font-bold text-white">{contract.projectTitle}</h3>
                                            <span className="px-2 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded">
                                                DISPUTED
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">Contract ID: {contract._id}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-emerald-400">₹{contract.amount.toLocaleString()}</p>
                                        <p className="text-xs text-gray-400">Total Value</p>
                                    </div>
                                </div>

                                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">The Parties</h4>
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-4 bg-gray-950 p-4 rounded-lg border border-gray-800">
                                                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/20">C</div>
                                                <div>
                                                    <p className="text-sm text-gray-500">Client / Employer</p>
                                                    <p className="text-white font-bold">{contract.employerName}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 bg-gray-950 p-4 rounded-lg border border-gray-800">
                                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/20">F</div>
                                                <div>
                                                    <p className="text-sm text-gray-500">Freelancer</p>
                                                    <p className="text-white font-bold">{contract.freelancerName}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {dispute && (
                                            <div className="mt-5 bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-red-400 mb-2">Dispute Statement</h4>
                                                <p className="text-gray-300 text-sm">
                                                    Raised by <span className="font-semibold">{dispute.raisedByName}</span> ({dispute.raisedByRole})
                                                </p>
                                                {dispute.createdAt && <p className="text-gray-500 text-xs mt-1">{new Date(dispute.createdAt).toLocaleString()}</p>}
                                                {dispute.reason && <p className="text-gray-400 text-sm mt-2">{dispute.reason}</p>}
                                                {dispute.milestoneIndex !== null && dispute.milestoneIndex !== undefined && (
                                                    <p className="text-gray-500 text-xs mt-2">Related milestone: #{Number(dispute.milestoneIndex) + 1}</p>
                                                )}
                                                {primaryEvidenceUrl && (
                                                    <div className="mt-3">
                                                        <p className="text-[11px] text-gray-500 mb-1">Submitted evidence</p>
                                                        {isImagePath(primaryEvidenceUrl) ? (
                                                            <a href={primaryEvidenceUrl} target="_blank" rel="noopener noreferrer">
                                                                <img
                                                                    src={primaryEvidenceUrl}
                                                                    alt="Dispute evidence"
                                                                    className="w-full max-w-xs max-h-44 object-cover rounded-lg border border-gray-700"
                                                                />
                                                            </a>
                                                        ) : (
                                                            <a
                                                                href={primaryEvidenceUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex text-xs font-semibold text-cyan-400 hover:text-cyan-300 underline"
                                                            >
                                                                Open uploaded file
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">Milestone Status</h4>
                                        <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                            {contract.milestones.map((m: any, idx: number) => (
                                                <div key={idx} className="bg-gray-950 border border-gray-800 p-3 rounded-lg">
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-300">{m.title}</p>
                                                            <p className="text-xs text-emerald-400 mt-0.5">₹{m.amount.toLocaleString()}</p>
                                                        </div>
                                                        <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${m.status === 'confirmed'
                                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                            : m.status === 'paid'
                                                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                                : 'bg-gray-800 text-gray-400'
                                                            }`}>
                                                            {m.status}
                                                        </span>
                                                    </div>
                                                    <div className="mt-2 text-[11px] text-gray-500 flex flex-wrap gap-3">
                                                        <span>Client done: {m.taskDoneByEmployer ? 'Yes' : 'No'}</span>
                                                        <span>Freelancer done: {m.taskDoneByFreelancer ? 'Yes' : 'No'}</span>
                                                        <span>Proof: {m.proofImage ? 'Uploaded' : 'None'}</span>
                                                    </div>
                                                    {m.proofImage && (
                                                        <div className="mt-2">
                                                            {isImagePath(m.proofImage) ? (
                                                                <a href={getProtectedUploadUrl(m.proofImage)} target="_blank" rel="noopener noreferrer">
                                                                    <img
                                                                        src={getProtectedUploadUrl(m.proofImage)}
                                                                        alt={`Milestone ${idx + 1} proof`}
                                                                        className="w-28 h-20 object-cover rounded border border-gray-700"
                                                                    />
                                                                </a>
                                                            ) : (
                                                                <a
                                                                    href={getProtectedUploadUrl(m.proofImage)}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 underline"
                                                                >
                                                                    Open milestone proof file
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-950 p-6 border-t border-gray-800">
                                    <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">Admin Verification & Ruling</h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                        {(Object.keys(checklistLabels) as ChecklistKey[]).map((key) => (
                                            <label key={key} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300">
                                                <input
                                                    type="checkbox"
                                                    checked={draft.checklist[key]}
                                                    onChange={(e) => updateDraft(contract._id, (old) => ({
                                                        ...old,
                                                        checklist: { ...old.checklist, [key]: e.target.checked }
                                                    }))}
                                                    className="accent-emerald-500"
                                                />
                                                {checklistLabels[key]}
                                            </label>
                                        ))}
                                    </div>

                                    <textarea
                                        value={draft.notes}
                                        onChange={(e) => updateDraft(contract._id, (old) => ({ ...old, notes: e.target.value }))}
                                        placeholder="Verification notes (required): include what evidence you reviewed and why this ruling is correct."
                                        className="w-full h-24 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 mb-4"
                                    />

                                    <div className="flex flex-wrap gap-4">
                                        <button
                                            onClick={() => setAgreementOpen(prev => ({ ...prev, [contract._id]: !prev[contract._id] }))}
                                            className="flex items-center justify-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 px-4 py-3 rounded-lg font-bold transition-all"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            {agreementOpen[contract._id] ? 'Hide Agreement' : 'View Agreement'}
                                        </button>
                                        <button
                                            onClick={() => toggleConversation(contract._id)}
                                            className="flex items-center justify-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 px-4 py-3 rounded-lg font-bold transition-all"
                                        >
                                            <MessageSquare size={18} />
                                            {conversationOpen[contract._id] ? 'Hide Conversation' : 'View Conversation'}
                                        </button>
                                        <button
                                            onClick={() => handleResolve(contract._id, 'refund_employer')}
                                            disabled={resolvingId === contract._id}
                                            className="flex-1 flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500 border border-indigo-500/20 text-indigo-400 hover:text-white px-4 py-3 rounded-lg font-bold transition-all disabled:opacity-50"
                                        >
                                            <Ban size={18} />
                                            Rule for Client (Refund / Cancel)
                                        </button>
                                        <button
                                            onClick={() => handleResolve(contract._id, 'pay_freelancer')}
                                            disabled={resolvingId === contract._id}
                                            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 text-emerald-400 hover:text-white px-4 py-3 rounded-lg font-bold transition-all disabled:opacity-50"
                                        >
                                            <CheckCircle size={18} />
                                            Rule for Freelancer (Force Complete)
                                        </button>
                                    </div>

                                    {/* Agreement Viewer */}
                                    {agreementOpen[contract._id] && (
                                        <div className="mt-5 bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 space-y-4">
                                            <h5 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                Signed Contract Agreement
                                            </h5>

                                            {contract.agreementFullText ? (
                                                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                                                    <p className="text-[10px] text-amber-500/70 uppercase tracking-wider font-bold mb-2">Full Agreement Text</p>
                                                    <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{contract.agreementFullText}</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {contract.projectDescription && (
                                                        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                                                            <p className="text-[10px] text-amber-500/70 uppercase tracking-wider font-bold mb-2">Project Description</p>
                                                            <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{contract.projectDescription}</p>
                                                        </div>
                                                    )}
                                                    {contract.projectRules && (
                                                        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                                                            <p className="text-[10px] text-amber-500/70 uppercase tracking-wider font-bold mb-2">Rules & Terms</p>
                                                            <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{contract.projectRules}</p>
                                                        </div>
                                                    )}
                                                    {contract.projectTimeline && (
                                                        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                                                            <p className="text-[10px] text-amber-500/70 uppercase tracking-wider font-bold mb-2">Timeline & Deadlines</p>
                                                            <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{contract.projectTimeline}</p>
                                                        </div>
                                                    )}
                                                    {contract.additionalTerms && (
                                                        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                                                            <p className="text-[10px] text-amber-500/70 uppercase tracking-wider font-bold mb-2">Additional Terms</p>
                                                            <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{contract.additionalTerms}</p>
                                                        </div>
                                                    )}
                                                    {!contract.projectDescription && !contract.projectRules && !contract.projectTimeline && !contract.additionalTerms && (
                                                        <p className="text-gray-500 text-sm col-span-2 italic">No agreement text was recorded for this contract.</p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Agreement thread (negotiation messages) */}
                                            {contract.thread && contract.thread.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] text-amber-500/70 uppercase tracking-wider font-bold mb-3">Agreement Negotiation Thread ({contract.thread.length} messages)</p>
                                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                                        {contract.thread.map((msg: any) => (
                                                            <div
                                                                key={msg._id}
                                                                className={`rounded-lg border p-3 ${msg.role === 'employer'
                                                                    ? 'bg-indigo-500/5 border-indigo-500/20'
                                                                    : 'bg-emerald-500/5 border-emerald-500/20'
                                                                    }`}
                                                            >
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className={`text-xs font-bold ${msg.role === 'employer' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                                                        {msg.userName} ({msg.role})
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-500">
                                                                        {new Date(msg.createdAt).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">{msg.message}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Milestone breakdown */}
                                            <div>
                                                <p className="text-[10px] text-amber-500/70 uppercase tracking-wider font-bold mb-3">Agreed Milestone Breakdown</p>
                                                <div className="space-y-2">
                                                    {contract.milestones.map((m: any, idx: number) => (
                                                        <div key={idx} className="flex items-center justify-between bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold">{idx + 1}</div>
                                                                <div>
                                                                    <p className="text-sm font-semibold text-gray-200">{m.title}</p>
                                                                    {m.dueDate && <p className="text-[10px] text-gray-500">Due: {m.dueDate}</p>}
                                                                </div>
                                                            </div>
                                                            <p className="text-emerald-400 font-bold text-sm">₹{m.amount.toLocaleString()}</p>
                                                        </div>
                                                    ))}
                                                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-amber-500/20 mt-1">
                                                        <p className="text-sm font-bold text-gray-300">Total Contract Value</p>
                                                        <p className="text-emerald-400 font-black text-base">₹{contract.amount.toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Conversation viewer */}
                                    {conversationOpen[contract._id] && (
                                        <div className="mt-5 bg-gray-900 border border-gray-800 rounded-xl p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <h5 className="text-sm font-bold text-white flex items-center gap-2">
                                                    <MessageSquare size={16} className="text-cyan-400" />
                                                    Dispute Conversation
                                                </h5>
                                                <button
                                                    onClick={() => fetchConversation(contract._id)}
                                                    className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                                                >
                                                    Refresh
                                                </button>
                                            </div>

                                            {conversationLoading[contract._id] ? (
                                                <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                                                    <Loader2 size={16} className="animate-spin" />
                                                    Loading conversation...
                                                </div>
                                            ) : (conversationByContract[contract._id]?.messages?.length || 0) === 0 ? (
                                                <p className="text-gray-500 text-sm py-2">No messages found between these users.</p>
                                            ) : (
                                                <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                                                    {conversationByContract[contract._id].messages.map((msg) => (
                                                        <div
                                                            key={msg._id}
                                                            className={`rounded-lg border p-3 ${msg.senderRole === 'employer'
                                                                ? 'bg-indigo-500/5 border-indigo-500/20'
                                                                : 'bg-emerald-500/5 border-emerald-500/20'
                                                                }`}
                                                        >
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className={`text-xs font-bold ${msg.senderRole === 'employer' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                                                    {msg.senderName} ({msg.senderRole})
                                                                </span>
                                                                <span className="text-[10px] text-gray-500">
                                                                    {new Date(msg.createdAt).toLocaleString()}
                                                                </span>
                                                            </div>
                                                            {msg.content && (
                                                                <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">{msg.content}</p>
                                                            )}
                                                            {msg.file?.filename && (
                                                                <a
                                                                    href={getProtectedUploadUrl(msg.file.filename)}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex mt-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300 underline"
                                                                >
                                                                    Attachment: {msg.file.originalName || msg.file.filename}
                                                                </a>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <ConfirmModal
                isOpen={!!confirmConfig}
                title="Confirm Ruling"
                message="Are you sure you want to confirm this ruling? This action is permanent and will be visible in dispute history."
                confirmText="Confirm Ruling"
                onConfirm={() => confirmConfig && handleResolve(confirmConfig.id, confirmConfig.outcome)}
                onCancel={() => setConfirmConfig(null)}
                isDanger={true}
            />
        </div>
    );
};
