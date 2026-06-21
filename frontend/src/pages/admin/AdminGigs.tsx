import { useEffect, useState } from 'react';
import { API_BASE, SERVER_BASE } from '../../config';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const RUPEE = '₹';

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'all';

const statusStyle: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
};

function PackageCard({ pkg, label, accent }: { pkg: any; label: string; accent: string }) {
    if (!pkg) return null;
    const border = accent === 'violet' ? 'border-violet-500/20' : accent === 'blue' ? 'border-blue-500/20' : 'border-emerald-500/20';
    const text = accent === 'violet' ? 'text-violet-400' : accent === 'blue' ? 'text-blue-400' : 'text-emerald-400';
    return (
        <div className={`bg-gray-800/60 border ${border} rounded-xl p-4`}>
            <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-black uppercase tracking-wider ${text}`}>{label}</span>
                <span className={`text-lg font-black ${text}`}>{RUPEE}{pkg.price?.toLocaleString()}</span>
            </div>
            {pkg.description && <p className="text-gray-300 text-sm mb-2">{pkg.description}</p>}
            <div className="flex gap-3 text-xs text-gray-500 mb-2">
                <span>⏱ {pkg.deliveryDays} day{pkg.deliveryDays !== 1 ? 's' : ''}</span>
                <span>🔄 {pkg.revisions} revision{pkg.revisions !== '1' ? 's' : ''}</span>
            </div>
            {pkg.features?.length > 0 && (
                <ul className="space-y-1">
                    {pkg.features.map((f: string, i: number) => (
                        <li key={i} className="text-xs text-gray-400 flex items-center gap-1.5">
                            <span className="text-emerald-500">✓</span> {f}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function GigDetailModal({ gig, onClose, onApprove, onReject, actionLoading }: {
    gig: any;
    onClose: () => void;
    onApprove: (id: string) => void;
    onReject: (gig: { id: string; title: string }) => void;
    actionLoading: string | null;
}) {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto"
            onClick={onClose}>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full my-6 shadow-2xl"
                onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-gray-800">
                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h2 className="text-xl font-black text-white">{gig.title}</h2>
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusStyle[gig.approvalStatus] || ''}`}>
                                {gig.approvalStatus?.toUpperCase()}
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm">
                            by <span className="text-gray-300 font-semibold">{gig.sellerName}</span>
                            · {gig.category}
                            · Submitted {new Date(gig.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                    </div>
                    <button onClick={onClose} className="shrink-0 text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg p-2 transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Cover Image */}
                    {gig.coverImage && (
                        <img src={`${SERVER_BASE}${gig.coverImage}`} alt="Gig cover"
                            className="w-full h-48 object-cover rounded-xl border border-gray-700" />
                    )}

                    {/* Description */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</h3>
                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap bg-gray-800/40 rounded-xl p-4 border border-gray-700">
                            {gig.description}
                        </p>
                    </div>

                    {/* Tags */}
                    {gig.tags?.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tags</h3>
                            <div className="flex flex-wrap gap-2">
                                {gig.tags.map((tag: string, i: number) => (
                                    <span key={i} className="text-xs bg-gray-800 text-gray-300 border border-gray-700 px-3 py-1 rounded-full">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Packages */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Pricing Packages</h3>
                        <div className="space-y-3">
                            <PackageCard pkg={gig.packages?.basic} label="Basic" accent="emerald" />
                            <PackageCard pkg={gig.packages?.standard} label="Standard" accent="blue" />
                            <PackageCard pkg={gig.packages?.premium} label="Premium" accent="violet" />
                        </div>
                    </div>

                    {/* Rejection reason if rejected */}
                    {gig.rejectionReason && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                            <p className="text-xs font-bold text-red-400 uppercase mb-1">Previous Rejection Reason</p>
                            <p className="text-red-300 text-sm">{gig.rejectionReason}</p>
                        </div>
                    )}

                    {/* Admin checklist hint */}
                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
                        <p className="text-xs font-bold text-amber-400/80 uppercase mb-2">Admin Review Checklist</p>
                        <ul className="text-xs text-gray-500 space-y-1">
                            <li>☐ Single service offered (not multiple unrelated services)</li>
                            <li>☐ Description is clear, professional and not misleading</li>
                            <li>☐ Pricing is reasonable and appropriate</li>
                            <li>☐ Cover image (if any) is relevant and appropriate</li>
                            <li>☐ No spam, duplicate, or prohibited content</li>
                        </ul>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-800 flex gap-3">
                    {(gig.approvalStatus === 'pending' || gig.approvalStatus === 'rejected') && (
                        <button onClick={() => { onApprove(gig._id); onClose(); }}
                            disabled={!!actionLoading}
                            className="flex-1 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-gray-950 border border-emerald-500/20 font-bold py-3 rounded-xl transition-all disabled:opacity-50 text-sm">
                            ✓ Approve & Publish
                        </button>
                    )}
                    {(gig.approvalStatus === 'pending' || gig.approvalStatus === 'approved') && (
                        <button onClick={() => { onReject({ id: gig._id, title: gig.title }); onClose(); }}
                            className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold py-3 rounded-xl transition-all text-sm">
                            ✕ Reject
                        </button>
                    )}
                    <button onClick={onClose}
                        className="px-5 bg-gray-800 text-gray-400 hover:bg-gray-700 font-semibold py-3 rounded-xl transition-all text-sm">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

export function AdminGigs() {
    const { user } = useAuth();
    const [tab, setTab] = useState<ApprovalStatus>('pending');
    const [gigs, setGigs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedGig, setSelectedGig] = useState<any | null>(null);
    const [rejectModal, setRejectModal] = useState<{ id: string; title: string } | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchGigs = async (status: ApprovalStatus = tab) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/gigs/admin/pending?status=${status}&limit=50`, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            const data = await res.json();
            setGigs(data.gigs || []);
        } catch (e) { console.error(e); toast.error('Failed to fetch gigs.'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchGigs(tab); }, [tab]);

    const approve = async (id: string) => {
        setActionLoading(id + '_approve');
        try {
            const res = await fetch(`${API_BASE}/gigs/admin/${id}/approve`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            if (res.ok) {
                toast.success('Gig approved successfully!');
                fetchGigs(); // Re-fetch gigs to update the list
            } else {
                const data = await res.json();
                toast.error(data.message || 'Failed to approve gig.');
            }
        } catch (error) {
            console.error('Error approving gig:', error);
            toast.error('An unexpected error occurred.');
        } finally {
            setActionLoading(null);
        }
    };

    const refundCredits = async (id: string) => {
        setActionLoading(id + '_refund');
        try {
            const res = await fetch(`${API_BASE}/gigs/admin/${id}/refund`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                fetchGigs(); // Re-fetch gigs to update the list
            } else {
                toast.error(data.message || 'Failed to refund credits.');
            }
        } catch (error) {
            console.error('Error refunding credits:', error);
            toast.error('An unexpected error occurred.');
        } finally {
            setActionLoading(null);
        }
    };

    const reject = async () => {
        if (!rejectModal) return;
        setActionLoading(rejectModal.id + '_reject');
        const res = await fetch(`${API_BASE}/gigs/admin/${rejectModal.id}/reject`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
            body: JSON.stringify({ reason: rejectReason || 'Does not meet our quality standards.' })
        });
        if (res.ok) setGigs(prev => prev.map(g => g._id === rejectModal.id ? { ...g, approvalStatus: 'rejected', isApproved: false } : g));
        setRejectModal(null);
        setRejectReason('');
        setActionLoading(null);
    };

    const tabs: { key: ApprovalStatus; label: string }[] = [
        { key: 'pending', label: 'Pending Review' },
        { key: 'approved', label: 'Approved' },
        { key: 'rejected', label: 'Rejected' },
        { key: 'all', label: 'All Gigs' },
    ];

    const coverSrc = (gig: any) => gig.coverImage ? `${SERVER_BASE}${gig.coverImage}` : null;
    const pendingCount = gigs.filter(g => g.approvalStatus === 'pending').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Gig Approvals</h1>
                    <p className="text-gray-400 text-sm mt-1">Review full gig details before approving</p>
                </div>
                {pendingCount > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-sm text-amber-400 font-semibold">
                        {pendingCount} pending
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
                {tabs.map(({ key, label }) => (
                    <button key={key} onClick={() => setTab(key)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === key ? 'bg-indigo-500/10 text-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {/* Gig List */}
            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 animate-pulse h-28" />)}
                </div>
            ) : gigs.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
                    <div className="text-4xl mb-3">✅</div>
                    <p className="text-gray-400">No gigs in this category.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {gigs.map(gig => (
                        <div key={gig._id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5"
                            style={{ borderColor: gig.approvalStatus === 'pending' ? 'rgba(245,158,11,0.2)' : gig.approvalStatus === 'rejected' ? 'rgba(239,68,68,0.2)' : undefined }}>
                            <div className="flex gap-4">
                                {/* Cover thumbnail */}
                                <div className="w-24 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-800 border border-gray-700">
                                    {coverSrc(gig)
                                        ? <img src={coverSrc(gig)!} alt="" className="w-full h-full object-cover" />
                                        : <div className="w-full h-full flex items-center justify-center text-2xl">⚡</div>
                                    }
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-white font-bold text-base leading-snug">{gig.title}</h3>
                                            <p className="text-gray-500 text-xs mt-0.5">
                                                by <span className="text-gray-300">{gig.sellerName}</span>
                                                · {gig.category}
                                                · {new Date(gig.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <span className={`shrink-0 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${statusStyle[gig.approvalStatus] || ''}`}>
                                            {gig.approvalStatus}
                                        </span>
                                    </div>
                                    <p className="text-gray-400 text-sm mt-2 line-clamp-2">{gig.description}</p>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                        <span className="text-emerald-400 font-bold">from {RUPEE}{gig.packages?.basic?.price?.toLocaleString()}</span>
                                        <span>{gig.packages?.basic?.deliveryDays}d delivery</span>
                                        {gig.packages?.standard && <span className="text-blue-400">+ Standard</span>}
                                        {gig.packages?.premium && <span className="text-violet-400">+ Premium</span>}
                                    </div>
                                    {gig.rejectionReason && (
                                        <p className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 line-clamp-1">
                                            ✕ {gig.rejectionReason}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-800 flex-wrap">
                                {/* Full Review button - opens detail modal */}
                                <button onClick={() => setSelectedGig(gig)}
                                    className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    Read Full Details
                                </button>

                                {(gig.approvalStatus === 'pending' || gig.approvalStatus === 'rejected') && (
                                    <button onClick={() => approve(gig._id)}
                                        disabled={actionLoading === gig._id + '_approve'}
                                        className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-gray-950 border border-emerald-500/20 text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50">
                                        {actionLoading === gig._id + '_approve' ? 'Approving…' : '✓ Approve'}
                                    </button>
                                )}
                                {(gig.approvalStatus === 'pending' || gig.approvalStatus === 'approved') && (
                                    <button onClick={() => setRejectModal({ id: gig._id, title: gig.title })}
                                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold px-4 py-2 rounded-lg transition-all">
                                        ✕ Reject
                                    </button>
                                )}

                                {/* Return Credits — only for rejected gigs where credits were charged and not yet refunded */}
                                {gig.approvalStatus === 'rejected' && gig.creditsPaid > 0 && !gig.creditsRefunded && (
                                    <button onClick={() => refundCredits(gig._id)}
                                        disabled={actionLoading === gig._id + '_refund'}
                                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5">
                                        💰 {actionLoading === gig._id + '_refund' ? 'Returning…' : `Return ${gig.creditsPaid} Credit${gig.creditsPaid > 1 ? 's' : ''}`}
                                    </button>
                                )}
                                {gig.approvalStatus === 'rejected' && gig.creditsRefunded && (
                                    <span className="text-xs text-emerald-500/70 font-semibold flex items-center gap-1">
                                        ✓ Credits Returned
                                    </span>
                                )}
                                {gig.approvalStatus === 'rejected' && gig.creditsPaid === 0 && (
                                    <span className="text-xs text-gray-600">Free posting — no credits to return</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Full Detail Modal */}
            {selectedGig && (
                <GigDetailModal
                    gig={selectedGig}
                    onClose={() => setSelectedGig(null)}
                    onApprove={(id) => { approve(id); setSelectedGig(null); }}
                    onReject={(g) => { setRejectModal(g); setSelectedGig(null); }}
                    actionLoading={actionLoading}
                />
            )}

            {/* Reject Reason Modal */}
            {rejectModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setRejectModal(null)}>
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-white font-bold text-lg mb-1">Reject Gig</h3>
                        <p className="text-gray-400 text-sm mb-4 line-clamp-2">"{rejectModal.title}"</p>
                        <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                            placeholder="Reason shown to the freelancer (e.g. 'This gig lists multiple unrelated services…')"
                            className="w-full h-28 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none mb-4" />
                        <div className="flex gap-3">
                            <button onClick={reject} disabled={!!actionLoading}
                                className="flex-1 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 font-bold py-2.5 rounded-xl transition-all disabled:opacity-50 text-sm">
                                {actionLoading ? 'Rejecting…' : 'Confirm Reject'}
                            </button>
                            <button onClick={() => setRejectModal(null)}
                                className="flex-1 bg-gray-800 text-gray-300 hover:bg-gray-700 font-semibold py-2.5 rounded-xl transition-all text-sm">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
