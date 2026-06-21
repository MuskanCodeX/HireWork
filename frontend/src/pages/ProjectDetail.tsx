import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE } from '../config';
import { openCreditCheckout } from '../utils/razorpayCheckout';
import { ReportModal } from '../components/ReportModal';
import { SEO } from '../components/SEO';
import { OutsideCommWarning } from '../components/OutsideCommWarning';
import { ActionReviewOverlay } from '../components/ActionReviewOverlay';

const CREDIT_PACKS = [
    { id: 'credits_5', label: '5 Credits', price: 49, popular: false },
    { id: 'credits_15', label: '15 Credits', price: 99, popular: true },
    { id: 'credits_30', label: '30 Credits', price: 179, popular: false },
];

const AGREEMENT_TEMPLATES = [
    {
        id: 'custom',
        name: 'Custom Plan',
        description: 'Start from scratch and craft milestones your way.',
        steps: []
    },
    {
        id: 'design_sprint',
        name: 'Design Sprint',
        description: 'Discovery → Wireframes → UI → Handoff',
        steps: [
            { title: 'Discovery & Research', weight: 0.25 },
            { title: 'Wireframes & UX Flow', weight: 0.3 },
            { title: 'Visual Design & Prototypes', weight: 0.3 },
            { title: 'Handoff & Micro-Interactions', weight: 0.15 }
        ]
    },
    {
        id: 'app_build',
        name: 'App Build',
        description: 'Backend → Frontend → QA → Launch support',
        steps: [
            { title: 'Architecture & API Setup', weight: 0.25 },
            { title: 'Frontend Modules', weight: 0.35 },
            { title: 'QA & Polishing', weight: 0.25 },
            { title: 'Launch & Warranty Support', weight: 0.15 }
        ]
    },
    {
        id: 'marketing_launch',
        name: 'Marketing Launch',
        description: 'Strategy → Assets → Campaign → Optimization',
        steps: [
            { title: 'Strategy & Funnel Plan', weight: 0.25 },
            { title: 'Creative & Asset Production', weight: 0.3 },
            { title: 'Campaign Setup & Execution', weight: 0.25 },
            { title: 'Optimization & Reporting', weight: 0.2 }
        ]
    }
];

const formatINR = (value: number) => {
    if (!Number.isFinite(value)) return '0';
    return value.toLocaleString('en-IN');
};

const buildTemplateMilestones = (templateId: string, totalAmount: number) => {
    const template = AGREEMENT_TEMPLATES.find((t) => t.id === templateId);
    if (!template || !template.steps?.length || !Number.isFinite(totalAmount)) return null;
    return template.steps.map((step, index) => ({
        title: step.title,
        amount: Math.max(1, Math.round(step.weight * totalAmount)),
        dueDate: ''
    }));
};

const BuyCreditsModal = ({ onClose, onPurchased, token, userName, userEmail }: {
    onClose: () => void;
    onPurchased: (updatedUser: any) => void;
    token: string;
    userName: string;
    userEmail: string;
}) => {
    const [loading, setLoading] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const handleBuy = async (packId: string) => {
        setLoading(packId);
        await openCreditCheckout({
            packId,
            token,
            userName,
            userEmail,
            onSuccess: (updatedUser) => {
                setDone(true);
                setTimeout(() => onPurchased(updatedUser), 800);
            },
            onError: (msg) => toast.error(`Payment failed: ${msg}`),
        });
        setLoading(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                <div className="p-6">
                    <button onClick={onClose} className="float-right text-gray-600 hover:text-white text-xl leading-none">×</button>
                    <div className="text-3xl mb-2">💳</div>
                    <h3 className="text-xl font-bold text-white mb-1">Buy Credits</h3>
                    <p className="text-gray-400 text-sm mb-5">1 credit is deducted from each party when an agreement is created. New users get 3 free credits.</p>

                    {done ? (
                        <div className="text-center py-4">
                            <div className="text-4xl mb-2">🎉</div>
                            <p className="text-emerald-400 font-bold">Credits added! Creating agreement...</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {CREDIT_PACKS.map(pack => (
                                <button
                                    key={pack.id}
                                    onClick={() => handleBuy(pack.id)}
                                    disabled={loading !== null}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${pack.popular
                                        ? 'border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20'
                                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                                        } disabled:opacity-50`}
                                >
                                    <div className="text-left">
                                        <span className="text-white font-bold text-sm">{pack.label}</span>
                                        {pack.popular && <span className="ml-2 text-[10px] font-bold text-emerald-400 uppercase">popular</span>}
                                    </div>
                                    <div className="text-right">
                                        {loading === pack.id
                                            ? <span className="text-gray-400 text-xs">Processing...</span>
                                            : <span className="text-emerald-400 font-bold">₹{pack.price}</span>
                                        }
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface Bid {
    userId: string;
    userName: string;
    amount: number;
    proposal: string;
    createdAt: string;
    isWaiting?: boolean;
}

interface Project {
    _id: string;
    title: string;
    description: string;
    budget: number;
    user: string;
    userName: string;
    createdAt: string;
    bids: Bid[];
    status?: string;
    awardedTo?: string;
    awardedToName?: string;
    contractId?: string;
    pendingAgreementTo?: string;
    pendingAgreementToName?: string;
    pendingContractId?: string;
    aiScreening?: {
        score?: number;
        severity?: string;
        verdict?: string;
        flags?: string[];
        notes?: string;
    };
}

interface AgreementThreadMessage {
    _id: string;
    userId: string;
    userName: string;
    role: 'employer' | 'freelancer';
    message: string;
    createdAt: string;
}

interface MilestoneDraft { title: string; amount: string; dueDate?: string; }
const toId = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        if (typeof value._id === 'string') return value._id;
        if (typeof value.$oid === 'string') return value.$oid;
        if (value._id && typeof value._id.toString === 'function') return value._id.toString();
        if (typeof value.toString === 'function') return value.toString();
    }
    return String(value);
};

const normalizeBid = (bid: any): Bid | null => {
    if (!bid || typeof bid !== 'object') return null;
    const normalizedUserId = toId(bid.userId);
    if (!normalizedUserId) return null;

    const normalizedAmount = Number(bid.amount);
    return {
        userId: normalizedUserId,
        userName: (typeof bid.userName === 'string' && bid.userName.trim()) ? bid.userName.trim() : 'User',
        amount: Number.isFinite(normalizedAmount) ? normalizedAmount : 0,
        proposal: typeof bid.proposal === 'string' ? bid.proposal : '',
        createdAt: typeof bid.createdAt === 'string' ? bid.createdAt : new Date().toISOString(),
    };
};

export const ProjectDetail = () => {
    const { id } = useParams<{ id: string }>();
    const [project, setProject] = useState<Project | null>(null);
    const [bidAmount, setBidAmount] = useState('');
    const [proposal, setProposal] = useState('');
    const [aiTone, setAiTone] = useState<'professional' | 'confident' | 'friendly'>('professional');
    const [aiLength, setAiLength] = useState<'short' | 'medium' | 'long'>('medium');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiSuggestion, setAiSuggestion] = useState<any | null>(null);
    const [bidWarning, setBidWarning] = useState<{ show: boolean; message?: string; cooldownMs?: number }>({ show: false });
    const { user, login, isLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [awarding, setAwarding] = useState<string | null>(null);
    const [ownerBids, setOwnerBids] = useState<Bid[] | null>(null);
    const navigate = useNavigate();
    const [bidSubmitting, setBidSubmitting] = useState(false);
    const [reviewOverlay, setReviewOverlay] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

    // Milestone modal
    const [milestoneModal, setMilestoneModal] = useState<Bid | null>(null);
    const [milestones, setMilestones] = useState<MilestoneDraft[]>([{ title: '', amount: '', dueDate: '' }]);
    const [projectDescription, setProjectDescription] = useState('');
    const [projectRules, setProjectRules] = useState('');
    const [projectTimeline, setProjectTimeline] = useState('');
    const [additionalTerms, setAdditionalTerms] = useState('');
    const [wizardStep, setWizardStep] = useState(1);
    const [selectedTemplate, setSelectedTemplate] = useState('custom');
    const [currentBidAmount, setCurrentBidAmount] = useState(0);
    const [aiAgreementWarning, setAiAgreementWarning] = useState<any | null>(null);
    const [aiAgreementChecking, setAiAgreementChecking] = useState(false);

    // Credits modal
    const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);
    const [pendingAward, setPendingAward] = useState(false); // retry after purchase



    // AI Bid Scoring
    const [aiBidScoreLoading, setAiBidScoreLoading] = useState(false);
    const [aiBidScoreResult, setAiBidScoreResult] = useState<any | null>(null);
    const [aiBidScoreError, setAiBidScoreError] = useState<string | null>(null);

    // Report modal
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    const [pendingContract, setPendingContract] = useState<any | null>(null);
    const [agreementThread, setAgreementThread] = useState<AgreementThreadMessage[]>([]);
    const [threadInput, setThreadInput] = useState('');
    const [threadSubmitting, setThreadSubmitting] = useState(false);

    // Limit reached modal
    const [limitWarning, setLimitWarning] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

    useEffect(() => {
        if (!isLoading) {
            fetchProject();
        }
    }, [id, user?._id, user?.token, isLoading]);

    useEffect(() => {
        if (!project?.pendingContractId || !user?.token) {
            setPendingContract(null);
            setAgreementThread([]);
            return;
        }
        fetchPendingContract(project.pendingContractId);
    }, [project?.pendingContractId, user?.token]);

    const fetchOwnerBids = async (projectId: string, ownerId: any) => {
        if (!user?.token || toId(user._id) !== toId(ownerId)) {
            setOwnerBids(null);
            return;
        }
        try {
            const bidsRes = await fetch(`${API_BASE}/projects/${projectId}/bids?ts=${Date.now()}`, {
                headers: { Authorization: `Bearer ${user.token}` },
                cache: 'no-store'
            });
            const bidsData = await bidsRes.json();
            if (bidsRes.ok && Array.isArray(bidsData)) {
                const normalizedBids = bidsData
                    .map(normalizeBid)
                    .filter((bid: Bid | null): bid is Bid => !!bid);
                // Never let a transient empty owner fetch hide already visible bids.
                setOwnerBids(normalizedBids.length > 0 ? normalizedBids : null);
            }
        } catch (err) {
            console.error('Error fetching owner bids:', err);
        }
    };

    const fetchProject = async () => {
        try {
            const headers: any = {};
            if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;
            const response = await fetch(`${API_BASE}/projects/${id}?ts=${Date.now()}`, {
                headers,
                cache: 'no-store'
            });
            const data = await response.json();
            if (response.ok) {
                const safeProject: Project = {
                    ...data,
                    _id: typeof data?._id === 'string' ? data._id : String(id || ''),
                    title: (typeof data?.title === 'string' && data.title.trim()) ? data.title : 'Untitled project',
                    description: typeof data?.description === 'string' ? data.description : '',
                    budget: Number.isFinite(Number(data?.budget)) ? Number(data.budget) : 0,
                    user: data?.user ?? '',
                    userName: (typeof data?.userName === 'string' && data.userName.trim()) ? data.userName.trim() : 'User',
                    createdAt: typeof data?.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
                    bids: Array.isArray(data?.bids)
                        ? data.bids.map(normalizeBid).filter((bid: Bid | null): bid is Bid => !!bid)
                        : [],
                };
                setProject(safeProject);
                await fetchOwnerBids(safeProject._id, safeProject.user);
            }
        } catch (error) {
            console.error('Error fetching project:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingContract = async (contractId: string) => {
        if (!user?.token) return;
        try {
            const res = await fetch(`${API_BASE}/contracts/${contractId}`, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            setPendingContract(data);
            fetchAgreementThread(contractId);
        } catch (err) {
            console.error('Error fetching contract:', err);
        }
    };

    const fetchAgreementThread = async (contractId: string) => {
        if (!user?.token) return;
        try {
            const res = await fetch(`${API_BASE}/contracts/${contractId}/thread`, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setAgreementThread(Array.isArray(data.thread) ? data.thread : []);
                setPendingContract((prev: any) => prev ? { ...prev, threadLocked: data.threadLocked } : prev);
            }
        } catch (err) {
            console.error('Error fetching agreement thread:', err);
        }
    };

    const handleGenerateProposal = async () => {
        if (!user || !project) return toast.error('Please login to use the AI assistant.');
        setAiError(null);
        setAiLoading(true);
        try {
            const res = await fetch(`${API_BASE}/ai/bid-suggestion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
                body: JSON.stringify({ projectId: project._id, tone: aiTone, length: aiLength })
            });
            const data = await res.json();
            if (res.ok && data?.suggestion?.proposal) {
                setProposal(data.suggestion.proposal);
                setAiSuggestion(data.suggestion);
            } else {
                setAiError(data.message || 'Unable to draft proposal.');
            }
        } catch (err) {
            console.error('AI proposal error:', err);
            setAiError('Unable to reach the AI copilot. Please try again.');
        } finally {
            setAiLoading(false);
        }
    };

    const handleBidSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return toast.error('Please login to bid');
        if (bidSubmitting) return;

        setBidSubmitting(true);
        setReviewOverlay({ open: true, message: 'AI is reviewing your proposal to keep the marketplace safe.' });
        try {
            const response = await fetch(`${API_BASE}/projects/${id}/bid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                body: JSON.stringify({ amount: Number(bidAmount), proposal }),
            });
            const data = await response.json();
            if (response.ok) {
                const contextVerified = Boolean((user as any)?.isAadhaarVerified || (user as any)?.isPhoneVerified);
                const requiresVerification = typeof data?.requiresVerification === 'boolean' ? data.requiresVerification : !contextVerified;
                toast.success(
                    requiresVerification
                        ? 'Your bid has been placed! It will be visible once you complete verification.'
                        : 'Your bid has been placed successfully!'
                , { duration: 5000 });
                setBidAmount('');
                setProposal('');
                setBidWarning({ show: false });
                setAiBidScoreResult(null);
                fetchProject();
            } else {
                if (data.error_code === 'LIMIT_REACHED') {
                    setLimitWarning({ show: true, message: data.message });
                } else if (data.warning) {
                    setBidWarning({ show: true, message: data.message, cooldownMs: data.cooldownMs });
                } else {
                    toast.error(data.message);
                }
            }
        } catch (error) {
            console.error('Error placing bid:', error);
        } finally {
            setBidSubmitting(false);
            setReviewOverlay({ open: false, message: '' });
        }
    };



    const scoreMyBid = async () => {
        if (!user || !project) return toast.error('Please login to score your bid.');
        if (!bidAmount || !proposal) {
            setAiBidScoreError('Enter bid amount and proposal first.');
            return;
        }
        setAiBidScoreError(null);
        setAiBidScoreLoading(true);
        try {
            const res = await fetch(`${API_BASE}/ai/score-bid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
                body: JSON.stringify({
                    proposal,
                    projectId: project._id,
                    bidAmount: Number(bidAmount)
                })
            });
            const data = await res.json();
            if (res.ok && data.score) {
                setAiBidScoreResult(data.score);
            } else {
                setAiBidScoreError(data.message || 'Unable to score your bid');
            }
        } catch (err) {
            console.error('AI bid score error:', err);
            setAiBidScoreError('Unable to reach AI scoring service. Please try again.');
        } finally {
            setAiBidScoreLoading(false);
        }
    };

    const openMilestoneModal = (bid: Bid) => {
        setMilestoneModal(bid);
        setCurrentBidAmount(bid.amount);
        setWizardStep(1);
        setSelectedTemplate('custom');
        setAiAgreementWarning(null);
        seedTemplateMilestones('custom', bid.amount);
        setProjectDescription('');
        setProjectRules('');
        setProjectTimeline('');
        setAdditionalTerms('');
    };

    const addMilestone = () => {
        setMilestones((prev: any[]) => [...prev, { title: `Part ${prev.length + 1}`, amount: '', dueDate: '' }]);
    };

    const removeMilestone = (idx: number) => {
        if (milestones.length <= 1) return;
        setMilestones((prev: any[]) => prev.filter((_, i) => i !== idx));
    };

    const seedTemplateMilestones = (templateId: string, amount: number) => {
        const templateData = buildTemplateMilestones(templateId, amount);
        if (templateData) {
            setMilestones(templateData.map(m => ({ title: m.title, amount: String(m.amount), dueDate: m.dueDate || '' })));
        } else {
            setMilestones([{ title: 'Kickoff', amount: String(Math.max(1, Math.round(amount || 0))), dueDate: '' }]);
        }
    };

    const updateMilestone = (idx: number, field: 'title' | 'amount' | 'dueDate', value: string) => {
        setMilestones((prev: any[]) => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
    };

    const handleTemplateSelect = (templateId: string) => {
        if (!milestoneModal) return;
        setSelectedTemplate(templateId);
        seedTemplateMilestones(templateId, milestoneModal.amount);
    };

    const runAgreementAiCheck = async () => {
        if (!user || !milestoneModal) return;
        setAiAgreementChecking(true);
        setAiAgreementWarning(null);
        try {
            const res = await fetch(`${API_BASE}/ai/screen-agreement`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
                body: JSON.stringify({
                    projectTitle: project?.title,
                    projectDescription,
                    projectRules,
                    projectTimeline,
                    additionalTerms,
                    milestones
                })
            });
            const data = await res.json();
            if (res.ok) {
                setAiAgreementWarning(data.screening);
            } else {
                toast.error(data.message || 'Unable to run agreement check');
            }
        } catch (err) {
            console.error('Agreement AI check failed:', err);
        } finally {
            setAiAgreementChecking(false);
        }
    };

    const handleAwardWithMilestones = async () => {
        if (!user || !milestoneModal || !project) return;

        const validMilestones = milestones.filter(m => m.title.trim() && Number(m.amount) > 0);
        if (validMilestones.length === 0) return toast.error('Add at least one milestone with a title and amount.');

        const totalAmount = validMilestones.reduce((s, m) => s + Number(m.amount), 0);
        setAwarding(milestoneModal.userId);
        setReviewOverlay({ open: true, message: 'AI is reviewing the agreement before sending it to the freelancer.' });

        try {
            const res = await fetch(`${API_BASE}/contracts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
                body: JSON.stringify({
                    projectId: project._id,
                    freelancerId: milestoneModal.userId,
                    freelancerName: milestoneModal.userName,
                    amount: totalAmount,
                    milestones: validMilestones.map(m => ({ title: m.title, amount: Number(m.amount), dueDate: m.dueDate })),
                    projectDescription,
                    projectRules,
                    projectTimeline,
                    additionalTerms,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || 'Agreement sent!');
                setMilestoneModal(null);
                fetchProject();
            } else {
                toast.error(data.message);
            }
        } catch (err) {
            console.error('Error awarding bid:', err);
        } finally {
            setAwarding(null);
            setReviewOverlay({ open: false, message: '' });
        }
    };

    const handleCreditsPurchased = (updatedUser: any) => {
        login(updatedUser); // update stored user credits
        setBuyCreditsOpen(false);
        if (pendingAward) {
            setPendingAward(false);
            handleAwardWithMilestones(); // retry
        }
    };

    const handleMessageOwner = () => {
        if (!user) return toast.error('Please login to message');
        if (project) navigate(`/messages/${project.user}`);
    };

    const handleThreadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pendingContract || !threadInput.trim() || !user?.token) return;
        setThreadSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/contracts/${pendingContract._id}/thread`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
                body: JSON.stringify({ message: threadInput })
            });
            const data = await res.json();
            if (res.ok) {
                setAgreementThread(Array.isArray(data.thread) ? data.thread : []);
                setThreadInput('');
                setPendingContract((prev: any) => prev ? { ...prev, threadLocked: data.threadLocked } : prev);
            } else {
                toast.error(data.message || 'Unable to add comment');
            }
        } catch (err) {
            console.error('Thread submit failed:', err);
        } finally {
            setThreadSubmitting(false);
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-500">Loading...</div>;
    if (!project) return <div className="p-10 text-center text-red-400">Project not found</div>;

    const isOwner = !!(user && toId(user._id) === toId(project.user));
    const isAwarded = project.status === 'awarded';
    const isCompleted = project.status === 'completed';
    const isClosedToBids = isAwarded || isCompleted;
    const safeTitle = (typeof project.title === 'string' && project.title.trim()) ? project.title : 'Untitled project';
    const safeDescription = typeof project.description === 'string' ? project.description : '';
    const safeOwnerName = (typeof project.userName === 'string' && project.userName.trim()) ? project.userName : 'User';
    const normalizedProjectBids = Array.isArray(project.bids)
        ? project.bids.map(normalizeBid).filter((bid: Bid | null): bid is Bid => !!bid)
        : [];
    const normalizedOwnerBids = Array.isArray(ownerBids)
        ? ownerBids.map(normalizeBid).filter((bid: Bid | null): bid is Bid => !!bid)
        : [];
    const displayBids = isOwner
        ? (normalizedOwnerBids.length > 0 ? normalizedOwnerBids : normalizedProjectBids)
        : normalizedProjectBids;

    const screening = (project as any)?.aiScreening;
    const showScreeningNotice = isOwner && screening && (screening.severity === 'warn' || screening.severity === 'block' || screening.verdict !== 'clear');

    return (
        <div className="container mx-auto px-4 py-12">
            <SEO
                title={`${safeTitle} | Job on HIREWORK`}
                description={safeDescription.slice(0, 160)}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="card">
                        <div className="flex justify-between items-start mb-6">
                            <h1 className="text-2xl font-bold text-white leading-tight">{safeTitle}</h1>
                            <span className="text-2xl font-bold text-emerald-400 ml-4 whitespace-nowrap">₹{project.budget}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 pb-6 border-b border-gray-800">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {safeOwnerName.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-gray-300 font-medium">{safeOwnerName}</span>
                                {(project as any).isOwnerAadhaarVerified && (
                                    <span className="flex items-center gap-1 bg-violet-500/10 text-violet-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-violet-500/20">
                                        ✓ Aadhaar
                                    </span>
                                )}
                            </div>
                            <span className="text-gray-700">•</span>
                            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                            {isCompleted ? (
                                <span className="bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded text-xs font-bold border border-emerald-500/30">Completed</span>
                            ) : isAwarded ? (
                                <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded text-xs font-bold border border-amber-500/20">Awarded</span>
                            ) : (
                                <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-xs font-bold border border-emerald-500/20">Open</span>
                            )}
                        </div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Description</h3>
                        <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">{safeDescription}</div>
                    </div>
                    {showScreeningNotice && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                            <p className="text-sm font-bold text-amber-300 mb-1">AI Trust & Safety</p>
                            <p className="text-xs text-gray-200">{screening.notes || 'Our automated systems detected content that may need moderation. Edit the project if it includes off-platform contact or sensitive info.'}</p>
                            <p className="text-xs text-gray-400 mt-2">Score: {Math.round(screening.score || 0)} / 100 · Flags: {(screening.flags || []).join(', ') || 'None'}</p>
                        </div>
                    )}

                    {/* Agreement card (when awarded) */}
                    {isClosedToBids && project.contractId && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-2xl">📋</span>
                                <h3 className="text-lg font-bold text-white">{isCompleted ? 'Project Completed' : 'Project Agreement Active'}</h3>
                            </div>
                            <p className="text-gray-400 text-sm mb-4">
                                {isCompleted
                                    ? <>All milestones for this project have been marked as complete. You can review the final agreement below.</>
                                    : <>This project has been awarded to <span className="text-emerald-400 font-semibold">{project.awardedToName}</span>. Payments are made directly via UPI/QR.</>}
                            </p>
                            <Link to="/contract" className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-500/20 transition-all">
                                View Payments Dashboard →
                            </Link>
                        </div>
                    )}

                    {/* Bids */}
                    <div className="card">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            Proposals
                            <span className="bg-gray-800 text-gray-400 text-sm py-0.5 px-2 rounded-md">{displayBids.length}</span>
                        </h3>
                        {displayBids.length === 0 ? (
                            <div className="text-center py-10 border border-dashed border-gray-700 rounded-lg">
                                <p className="text-gray-500">No proposals yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {displayBids.map((bid, index) => {
                                    const isBidAwarded = isAwarded && toId(project.awardedTo) === toId(bid.userId);
                                    const isPendingAgreement = project.pendingAgreementTo && toId(project.pendingAgreementTo) === toId(bid.userId);
                                    const bidderName = (typeof bid.userName === 'string' && bid.userName.trim()) ? bid.userName : 'User';
                                    return (
                                        <div key={`${toId(bid.userId)}-${index}`} className={`p-4 rounded-lg border transition-colors ${isBidAwarded ? 'bg-emerald-500/5 border-emerald-500/30' : isPendingAgreement ? 'bg-amber-500/5 border-amber-500/30' : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'}`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-gray-300">{bidderName.charAt(0).toUpperCase()}</div>
                                                    <Link to={`/profile/${bid.userId}`} className="font-semibold text-white text-sm hover:text-emerald-400 transition-colors">
                                                        {bidderName}
                                                    </Link>
                                                    {isBidAwarded && (
                                                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                            ✓ AWARDED
                                                        </span>
                                                    )}
                                                    {isPendingAgreement && !isBidAwarded && (
                                                        <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
                                                            ⏳ Agreement Sent
                                                        </span>
                                                    )}
                                                    {bid.isWaiting && (
                                                        <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
                                                            ⏳ Waiting for Verification
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="font-bold text-emerald-400">₹{bid.amount}</span>
                                            </div>
                                            <p className="text-gray-400 text-sm">{bid.proposal}</p>
                                            <div className="flex items-center gap-2 mt-3">
                                                {isOwner && bid.userId && (
                                                    <button
                                                        onClick={() => navigate(`/profile/${bid.userId}`)}
                                                        className="text-cyan-400 text-xs font-semibold hover:text-cyan-300 transition-colors"
                                                    >
                                                        View Profile
                                                    </button>
                                                )}
                                                {user && bid.userId && (
                                                    <button onClick={() => navigate(`/messages/${bid.userId}`)} className="text-emerald-400 text-xs font-semibold hover:text-emerald-300 transition-colors">
                                                        💬 Message
                                                    </button>
                                                )}
                                                {isOwner && !isClosedToBids && (
                                                    <button
                                                        onClick={() => openMilestoneModal(bid)}
                                                        disabled={!!project.pendingAgreementTo && toId(project.pendingAgreementTo) !== toId(bid.userId)}
                                                        title={project.pendingAgreementTo && toId(project.pendingAgreementTo) !== toId(bid.userId) ? 'Another agreement is pending' : ''}
                                                        className="ml-auto bg-emerald-500 text-gray-950 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-400 transition-all disabled:opacity-50 active:scale-95"
                                                    >
                                                        {project.pendingAgreementTo && toId(project.pendingAgreementTo) === toId(bid.userId) ? '⏳ Agreement Sent' : '📋 Send Agreement'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    {user && toId(user._id) !== toId(project.user) && (
                        <div className="card">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Contact</h3>
                            <button onClick={handleMessageOwner} className="btn-secondary w-full mb-3">
                                💬 Message {safeOwnerName}
                            </button>
                            <button
                                onClick={() => setIsReportModalOpen(true)}
                                className="w-full flex justify-center items-center gap-2 text-red-500/80 hover:text-red-400 text-xs font-bold py-2 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                </svg>
                                Report Project
                            </button>
                        </div>
                    )}

                    {user && !isOwner && !isClosedToBids ? (
                        <div className="card lg:sticky lg:top-24">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-white">Place a Bid</h3>
                                <span className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2.5 py-1 rounded-full">
                                    💳 {(user as any).credits ?? 0} credits
                                </span>
                            </div>
                            <OutsideCommWarning show={bidWarning.show} message={bidWarning.message} cooldownMs={bidWarning.cooldownMs} />
                            {normalizedProjectBids.some((b) => toId(b.userId) === toId(user._id)) ? (
                                <div className="text-center py-6 border border-dashed border-emerald-500/30 rounded-lg bg-emerald-500/5">
                                    <h4 className="text-emerald-400 font-bold mb-1">Proposal Submitted</h4>
                                    <p className="text-gray-500 text-sm">You have already placed a bid on this project.</p>
                                </div>
                            ) : (
                                <form onSubmit={handleBidSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-gray-400 text-sm font-medium mb-2">Bid Amount (₹)</label>
                                        <input type="number" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} className="input-field" required placeholder="500" />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 text-sm font-medium mb-2">Proposal</label>
                                        <textarea value={proposal} onChange={(e) => setProposal(e.target.value)} className="input-field h-32 resize-none" required placeholder="Why are you the best fit?" />
                                    </div>
                                    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <p className="text-xs uppercase tracking-[0.3em] text-gray-500 font-semibold">AI Copilot</p>
                                                <p className="text-sm text-white font-bold">Generate draft</p>
                                            </div>
                                            <button type="button" onClick={handleGenerateProposal} className="btn-secondary text-xs px-3 py-2" disabled={aiLoading}>{aiLoading ? 'Generating...' : 'Draft with AI'}</button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <label className="flex flex-col gap-1 text-gray-400">
                                                Tone
                                                <select value={aiTone} onChange={(e) => setAiTone(e.target.value as any)} className="input-field text-xs">
                                                    <option value="professional">Professional</option>
                                                    <option value="confident">Confident</option>
                                                    <option value="friendly">Friendly</option>
                                                </select>
                                            </label>
                                            <label className="flex flex-col gap-1 text-gray-400">
                                                Length
                                                <select value={aiLength} onChange={(e) => setAiLength(e.target.value as any)} className="input-field text-xs">
                                                    <option value="short">Short</option>
                                                    <option value="medium">Medium</option>
                                                    <option value="long">Detailed</option>
                                                </select>
                                            </label>
                                        </div>
                                        {aiError && <p className="text-xs text-red-400">{aiError}</p>}
                                        {aiSuggestion && (
                                            <div className="bg-gray-800/60 border border-emerald-500/20 rounded-lg p-3 text-xs text-gray-300 space-y-2">
                                                <p className="text-emerald-400 font-semibold">Hook: {aiSuggestion.hook}</p>
                                                {Array.isArray(aiSuggestion.milestones) && aiSuggestion.milestones.length > 0 && (
                                                    <div>
                                                        <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">Milestones</p>
                                                        <ul className="list-disc list-inside space-y-1">
                                                            {aiSuggestion.milestones.map((m: string, idx: number) => (
                                                                <li key={idx}>{m}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>



                                    {/* AI Bid Quality Score */}
                                    {bidAmount && proposal && (
                                        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500 font-semibold">AI Bid Quality</p>
                                                    <p className="text-sm text-white font-bold">Score your proposal</p>
                                                </div>
                                                <button type="button" onClick={scoreMyBid} className="btn-secondary text-xs px-3 py-2" disabled={aiBidScoreLoading}>
                                                    {aiBidScoreLoading ? 'Scoring...' : '⭐ Score My Bid'}
                                                </button>
                                            </div>
                                            {aiBidScoreError && <p className="text-xs text-red-400">{aiBidScoreError}</p>}
                                            {aiBidScoreResult && (
                                                <div className="bg-gray-800/60 border border-amber-500/20 rounded-lg p-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-2xl font-black text-white">{aiBidScoreResult.score}</span>
                                                            <span className="text-amber-400 font-bold">/100</span>
                                                        </div>
                                                        <span className={`text-xs font-bold px-2 py-1 rounded ${aiBidScoreResult.grade === 'A' || aiBidScoreResult.grade === 'B' ? 'bg-emerald-500/20 text-emerald-400' :
                                                            aiBidScoreResult.grade === 'C' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            Grade: {aiBidScoreResult.grade}
                                                        </span>
                                                    </div>
                                                    {aiBidScoreResult.strengths && aiBidScoreResult.strengths.length > 0 && (
                                                        <div className="mb-2">
                                                            <p className="text-[10px] uppercase tracking-widest text-emerald-500 mb-1">Strengths</p>
                                                            <ul className="text-xs text-gray-300 space-y-1">
                                                                {aiBidScoreResult.strengths.map((s: string, i: number) => (
                                                                    <li key={i} className="flex items-start gap-1">
                                                                        <span className="text-emerald-400">✓</span>
                                                                        <span>{s}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {aiBidScoreResult.improvements && aiBidScoreResult.improvements.length > 0 && (
                                                        <div>
                                                            <p className="text-[10px] uppercase tracking-widest text-amber-500 mb-1">Improvements</p>
                                                            <ul className="text-xs text-gray-300 space-y-1">
                                                                {aiBidScoreResult.improvements.map((s: string, i: number) => (
                                                                    <li key={i} className="flex items-start gap-1">
                                                                        <span className="text-amber-400">→</span>
                                                                        <span>{s}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <p className="text-gray-600 text-xs">💡 Bidding is free. 1 credit is only used when both parties agree.</p>
                                    <button type="submit" className="btn-primary w-full py-3" disabled={bidSubmitting}>
                                        {bidSubmitting ? 'Submitting…' : 'Submit Proposal'}
                                    </button>
                                </form>
                            )}
                        </div>
                    ) : user && !isOwner && isClosedToBids ? (
                        <div className="card lg:sticky lg:top-24 text-center py-6">
                            <p className="text-gray-500">{isCompleted ? 'This project has been completed.' : 'This project has been awarded.'}</p>
                            {toId(project.awardedTo) === toId(user._id) && (
                                <Link to="/contract" className="btn-primary mt-4 inline-block">View Payment</Link>
                            )}
                        </div>
                    ) : !user ? (
                        <div className="card text-center py-8">
                            <p className="text-gray-500 mb-4">Log in to bid or message.</p>
                            <Link to="/login" className="btn-primary w-full">Log In</Link>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Milestone Creation Modal */}
            {milestoneModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[85vh] overflow-y-auto" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                        <h3 className="text-xl font-bold text-white mb-1">Create Agreement</h3>
                        <p className="text-gray-500 text-sm mb-4">
                            Sending to <span className="text-emerald-400 font-semibold">{milestoneModal.userName}</span>
                        </p>
                        <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-3 mb-5">
                            <p className="text-violet-300 text-xs font-semibold mb-1">📄 The freelancer will read everything below before deciding to accept or cancel.</p>
                            <p className="text-gray-500 text-xs">Fill in the terms clearly. Credits are only deducted when the freelancer accepts.</p>
                        </div>

                        <div className="space-y-3 mb-4">
                            {milestones.map((m, i) => (
                                <div key={i} className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={m.title}
                                        onChange={(e) => updateMilestone(i, 'title', e.target.value)}
                                        placeholder={`Part ${i + 1} title`}
                                        className="input-field flex-1 !py-2 text-sm"
                                    />
                                    <input
                                        type="number"
                                        value={m.amount}
                                        onChange={(e) => updateMilestone(i, 'amount', e.target.value)}
                                        placeholder="₹ Amount"
                                        className="input-field w-28 !py-2 text-sm"
                                    />
                                    {milestones.length > 1 && (
                                        <button type="button" onClick={() => removeMilestone(i)} className="text-red-400 hover:text-red-300 text-lg px-1">×</button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button type="button" onClick={addMilestone} className="text-emerald-400 text-xs font-bold hover:text-emerald-300 transition-colors mb-2 flex items-center gap-1">
                            + Add Milestone
                        </button>

                        <div className="bg-gray-800/50 rounded-lg p-3 mb-6">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Total Amount (₹):</span>
                                <span className="text-emerald-400 font-bold">
                                    ₹{milestones.reduce((s, m) => s + (Number(m.amount) || 0), 0)}
                                </span>
                            </div>
                        </div>

                        {/* Project Description */}
                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm font-medium mb-1 flex items-center gap-1">
                                <span className="text-indigo-400">🎯</span> Project Description & Requirements
                            </label>
                            <textarea
                                value={projectDescription}
                                onChange={(e) => setProjectDescription(e.target.value)}
                                placeholder="Describe the full scope of work. What exactly does the freelancer need to do? What are the deliverables?"
                                className="input-field h-32 resize-none text-sm border-indigo-500/30 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                                required
                            />
                        </div>

                        {/* Project Rules */}
                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm font-medium mb-1">
                                📋 Rules & Terms <span className="text-gray-600 font-normal text-xs">(the freelancer must follow these)</span>
                            </label>
                            <textarea
                                value={projectRules}
                                onChange={(e) => setProjectRules(e.target.value)}
                                placeholder="e.g. Use React + TypeScript only. Provide clean, commented code. Daily updates required."
                                className="input-field h-24 resize-none text-sm"
                            />
                        </div>

                        {/* Project Timeline */}
                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm font-medium mb-1">
                                ⏰ Timeline & Deadlines <span className="text-gray-600 font-normal text-xs">(when each part should be done)</span>
                            </label>
                            <textarea
                                value={projectTimeline}
                                onChange={(e) => setProjectTimeline(e.target.value)}
                                placeholder="e.g. Part 1 — within 3 days. Part 2 — within 7 days from Part 1. Full project by March 20."
                                className="input-field h-20 resize-none text-sm"
                            />
                        </div>

                        {/* Additional Terms / Description */}
                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm font-medium mb-1">
                                📝 Agreement Description <span className="text-gray-600 font-normal text-xs">(any extra details or conditions)</span>
                            </label>
                            <textarea
                                value={additionalTerms}
                                onChange={(e) => setAdditionalTerms(e.target.value)}
                                placeholder="e.g. Ownership of all code transfers to client upon full payment. Revisions included up to 2 rounds."
                                className="input-field h-20 resize-none text-sm"
                            />
                        </div>

                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 mb-4">
                            <p className="text-blue-400/80 text-xs">
                                ℹ️ All the details above (rules, timeline, additional terms) will be included in the agreement. In case of any dispute, only the details mentioned in this agreement will be considered for resolution.
                            </p>
                        </div>

                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-6">
                            <p className="text-amber-400/80 text-xs">
                                ⚠️ Payments are made directly between you and the freelancer via UPI/QR. We do not hold or process any payments. <Link to="/terms" className="underline">Read our Terms</Link>.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setMilestoneModal(null)} className="flex-1 btn-secondary !py-2.5 text-sm">
                                Cancel
                            </button>
                            <button
                                onClick={handleAwardWithMilestones}
                                disabled={awarding === milestoneModal.userId}
                                className="flex-1 bg-emerald-500 text-gray-950 font-bold py-2.5 rounded-lg text-sm hover:bg-emerald-400 transition-all disabled:opacity-50"
                            >
                                {awarding === milestoneModal.userId ? 'Sending...' : '📋 Send Agreement'}
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            {/* Buy Credits Modal */}
            {
                buyCreditsOpen && user && (
                    <BuyCreditsModal
                        token={user.token}
                        userName={user.name}
                        userEmail={(user as any).email || ''}
                        onClose={() => { setBuyCreditsOpen(false); setPendingAward(false); }}
                        onPurchased={handleCreditsPurchased}
                    />
                )
            }

            {/* Report Modal */}
            {
                project && (
                    <ReportModal
                        isOpen={isReportModalOpen}
                        onClose={() => setIsReportModalOpen(false)}
                        reportedId={project._id}
                        reportedType="project"
                    />
                )
            }

            {/* Application Limit Modal */}
            {limitWarning.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl text-center" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                        <div className="text-4xl mb-4">🚫</div>
                        <h3 className="text-xl font-bold text-white mb-2">Limit Reached</h3>
                        <p className="text-gray-400 text-sm mb-6">{limitWarning.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setLimitWarning({ show: false, message: '' })} className="flex-1 btn-secondary !py-2.5 text-sm">
                                Close
                            </button>
                            <Link to="/settings" className="flex-1 btn-primary !py-2.5 text-sm">
                                Upgrade Plan
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            <ActionReviewOverlay open={reviewOverlay.open} message={reviewOverlay.message} />
        </div >
    );
};
