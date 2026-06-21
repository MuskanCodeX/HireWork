import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE, SERVER_BASE } from '../config';
import { useAuth } from '../hooks/useAuth';
import { ConfirmModal } from '../components/ConfirmModal';

const RUPEE = '₹';

const statusColors: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    cancelled: 'bg-gray-800 text-gray-400 border-gray-700',
    expired: 'bg-red-500/10 text-red-400 border-red-500/20',
    pending_payment: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    pending_acceptance: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export default function MyGigs() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState<'my_gigs' | 'orders_received' | 'my_purchases'>('my_gigs');
    const [myGigs, setMyGigs] = useState<any[]>([]);
    const [sales, setSales] = useState<any[]>([]);
    const [purchases, setPurchases] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [completingId, setCompletingId] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [confirmConfig, setConfirmConfig] = useState<{
        id: string;
        type: 'delete_gig' | 'decline_order';
        title: string;
        message: string;
        confirmText: string;
    } | null>(null);

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        const h = { Authorization: `Bearer ${user.token}` };
        Promise.all([
            fetch(`${API_BASE}/gigs/my`, { headers: h }).then(r => r.json()),
            fetch(`${API_BASE}/gigs/orders/sales`, { headers: h }).then(r => r.json()),
            fetch(`${API_BASE}/gigs/orders/purchases`, { headers: h }).then(r => r.json()),
        ]).then(([g, s, p]) => {
            setMyGigs(Array.isArray(g) ? g : []);
            setSales(Array.isArray(s) ? s : []);
            setPurchases(Array.isArray(p) ? p : []);
        }).catch(console.error).finally(() => setLoading(false));
    }, [user]);

    const toggleActive = async (gig: any) => {
        const res = await fetch(`${API_BASE}/gigs/${gig._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
            body: JSON.stringify({ isActive: !gig.isActive })
        });
        if (res.ok) setMyGigs(prev => prev.map(g => g._id === gig._id ? { ...g, isActive: !gig.isActive } : g));
    };

    const deleteGig = async (id: string) => {
        setConfirmConfig({
            id,
            type: 'delete_gig',
            title: 'Delete Gig',
            message: 'Are you sure you want to delete this gig? This cannot be undone.',
            confirmText: 'Delete'
        });
    };

    const confirmDeleteGig = async (id: string) => {
        setConfirmConfig(null);
        await fetch(`${API_BASE}/gigs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${user?.token}` } });
        setMyGigs(prev => prev.filter(g => g._id !== id));
    };

    const markComplete = async (orderId: string) => {
        setCompletingId(orderId);
        const res = await fetch(`${API_BASE}/gigs/orders/${orderId}/complete`, {
            method: 'PUT', headers: { Authorization: `Bearer ${user?.token}` }
        });
        if (res.ok) setSales(prev => prev.map(o => o._id === orderId ? { ...o, status: 'completed' } : o));
        setCompletingId(null);
    };

    const acceptOrder = async (orderId: string) => {
        setCompletingId(orderId + '_accept');
        try {
            const res = await fetch(`${API_BASE}/gigs/orders/${orderId}/accept`, {
                method: 'PUT', headers: { Authorization: `Bearer ${user?.token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setSales(prev => prev.map(o => o._id === orderId ? { ...o, status: 'active' } : o));
            } else {
                toast.error(data.message || 'Failed to accept order');
                if (data.message?.includes('cancelled')) {
                    setSales(prev => prev.map(o => o._id === orderId ? { ...o, status: 'cancelled' } : o));
                }
            }
        } finally {
            setCompletingId(null);
        }
    };

    const declineOrder = async (orderId: string) => {
        setConfirmConfig({
            id: orderId,
            type: 'decline_order',
            title: 'Decline Order',
            message: 'Are you sure you want to decline this order? No credits will be deducted.',
            confirmText: 'Decline'
        });
    };

    const confirmDeclineOrder = async (orderId: string) => {
        setConfirmConfig(null);
        setCompletingId(orderId + '_decline');
        try {
            const res = await fetch(`${API_BASE}/gigs/orders/${orderId}/decline`, {
                method: 'PUT', headers: { Authorization: `Bearer ${user?.token}` }
            });
            if (res.ok) setSales(prev => prev.map(o => o._id === orderId ? { ...o, status: 'cancelled' } : o));
        } finally {
            setCompletingId(null);
        }
    };

    const cancelOrder = async (orderId: string) => {
        setCancellingId(orderId);
        const res = await fetch(`${API_BASE}/gigs/orders/${orderId}/cancel`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
            body: JSON.stringify({ reason: 'Cancelled by buyer' })
        });
        if (res.ok) setPurchases(prev => prev.map(o => o._id === orderId ? { ...o, status: 'cancelled' } : o));
        setCancellingId(null);
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-950 py-10 px-4">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-white">My Gigs</h1>
                        <p className="text-gray-400 text-sm mt-1">Manage your services and track orders</p>
                    </div>
                    <Link to="/gigs/create" className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold px-5 py-2.5 rounded-xl transition-all hover:scale-105 text-sm">
                        + New Gig
                    </Link>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6 w-fit">
                    {([
                        { key: 'my_gigs', label: `My Gigs (${myGigs.length})` },
                        { key: 'orders_received', label: `Orders Received (${sales.length})` },
                        { key: 'my_purchases', label: `My Purchases (${purchases.length})` },
                    ] as const).map(({ key, label }) => (
                        <button key={key} onClick={() => setTab(key)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === key ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:text-gray-200'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                {/* Tab: My Gigs */}
                {tab === 'my_gigs' && (
                    <div>
                        {myGigs.length === 0 ? (
                            <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
                                <div className="text-5xl mb-4">🛍️</div>
                                <h3 className="text-xl font-bold text-white mb-2">No gigs yet</h3>
                                <p className="text-gray-500 mb-5">Your first gig is free to post!</p>
                                <Link to="/gigs/create" className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold px-6 py-3 rounded-xl transition-all">
                                    Create Your First Gig
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {myGigs.map(gig => {
                                    const approvalStatus = gig.approvalStatus || 'pending';
                                    const approvalStyles: Record<string, string> = {
                                        pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                                        approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                                        rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
                                    };
                                    const approvalLabels: Record<string, string> = {
                                        pending: '⏳ Pending Review',
                                        approved: '✓ Live',
                                        rejected: '✕ Rejected',
                                    };
                                    return (
                                        <div key={gig._id} className={`bg-gray-900 border rounded-2xl p-5 ${approvalStatus === 'rejected' ? 'border-red-500/20' : approvalStatus === 'pending' ? 'border-amber-500/20' : 'border-gray-800'}`}>
                                            <div className="flex items-center gap-5">
                                                {gig.coverImage ? (
                                                    <img src={`${SERVER_BASE}${gig.coverImage}`} alt={gig.title} className="w-20 h-16 rounded-xl object-cover border border-gray-700 shrink-0" />
                                                ) : (
                                                    <div className="w-20 h-16 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-2xl shrink-0">⚡</div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                        {approvalStatus !== 'approved' ? (
                                                            <span className="text-white font-bold line-clamp-1">{gig.title}</span>
                                                        ) : (
                                                            <Link to={`/gigs/${gig._id}`} className="text-white font-bold hover:text-emerald-400 transition-colors line-clamp-1">{gig.title}</Link>
                                                        )}
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${approvalStyles[approvalStatus]}`}>
                                                            {approvalLabels[approvalStatus]}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-500 text-xs mt-0.5">{gig.category} · {gig.totalOrders} orders</p>
                                                    <p className="text-emerald-400 text-sm font-bold mt-1">From {RUPEE}{gig.packages?.basic?.price?.toLocaleString()}</p>
                                                    {approvalStatus === 'rejected' && gig.rejectionReason && (
                                                        <p className="mt-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
                                                            ✕ Rejected: {gig.rejectionReason}
                                                        </p>
                                                    )}
                                                    {approvalStatus === 'pending' && (
                                                        <p className="mt-1.5 text-xs text-amber-400/80">Your gig is under admin review. It will go live once approved.</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    {approvalStatus === 'approved' && (
                                                        <button onClick={() => toggleActive(gig)} className="text-xs font-semibold text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-700 transition-all">
                                                            {gig.isActive ? 'Pause' : 'Activate'}
                                                        </button>
                                                    )}
                                                    <button onClick={() => deleteGig(gig._id)} className="text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/20 transition-all">
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab: Orders Received (seller view) */}
                {tab === 'orders_received' && (
                    <div className="space-y-4">
                        {sales.length === 0 ? (
                            <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
                                <div className="text-5xl mb-4">📦</div>
                                <p className="text-gray-400">No orders received yet. Share your gigs to get started!</p>
                            </div>
                        ) : sales.map(order => (
                            <div key={order._id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <div>
                                        <h3 className="text-white font-bold">{order.gigTitle}</h3>
                                        <p className="text-gray-500 text-xs mt-0.5">
                                            From <span className="text-gray-300">{order.buyerName}</span> · {new Date(order.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-emerald-400 font-black">{RUPEE}{order.packageSnapshot?.price?.toLocaleString()}</p>
                                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 ${statusColors[order.status] || ''}`}>
                                            {order.status.replace('_', ' ').toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-gray-800/60 rounded-xl p-3 mb-3">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Client Requirements</p>
                                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{order.requirements}</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span>📦 {order.selectedPackage} package</span>
                                    <span>·</span>
                                    <span>⏰ Expires {new Date(order.expiresAt).toLocaleDateString()}</span>
                                </div>
                                {order.status === 'pending_acceptance' && (
                                    <div className="mt-3 flex gap-2">
                                        <button
                                            onClick={() => acceptOrder(order._id)}
                                            disabled={!!completingId}
                                            className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                                        >
                                            {completingId === order._id + '_accept' ? 'Accepting...' : '✓ Accept Order (1 Credit)'}
                                        </button>
                                        <button
                                            onClick={() => declineOrder(order._id)}
                                            disabled={!!completingId}
                                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                                        >
                                            {completingId === order._id + '_decline' ? 'Declining...' : '✕ Decline Order'}
                                        </button>
                                    </div>
                                )}
                                {order.status === 'active' && (
                                    <div className="mt-3 flex gap-2">
                                        <button
                                            onClick={() => markComplete(order._id)}
                                            disabled={completingId === order._id}
                                            className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-gray-950 border border-emerald-500/20 text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                                        >
                                            {completingId === order._id ? 'Marking...' : '✓ Mark as Completed'}
                                        </button>
                                        <Link to={`/messages/${order.buyerId}`} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 w-fit">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                            Message Client
                                        </Link>
                                    </div>
                                )}
                                {order.status === 'completed' && (
                                    <div className="mt-3">
                                        <Link to={`/messages/${order.buyerId}`} className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 w-fit">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                            Message Client
                                        </Link>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Tab: My Purchases (buyer view) */}
                {tab === 'my_purchases' && (
                    <div className="space-y-4">
                        {purchases.length === 0 ? (
                            <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
                                <div className="text-5xl mb-4">🛒</div>
                                <p className="text-gray-400 mb-5">You haven't ordered any gigs yet.</p>
                                <Link to="/gigs" className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold px-6 py-3 rounded-xl transition-all">
                                    Browse Gigs
                                </Link>
                            </div>
                        ) : purchases.map(order => (
                            <div key={order._id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <div>
                                        <h3 className="text-white font-bold">{order.gigTitle}</h3>
                                        <p className="text-gray-500 text-xs mt-0.5">
                                            By <span className="text-gray-300">{order.sellerName}</span> · {new Date(order.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-emerald-400 font-black">{RUPEE}{order.packageSnapshot?.price?.toLocaleString()}</p>
                                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 ${statusColors[order.status] || ''}`}>
                                            {order.status.replace('_', ' ').toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-gray-800/60 rounded-xl p-3 mb-3">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Your Requirements</p>
                                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{order.requirements}</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                                    <span>📦 {order.selectedPackage} package</span>
                                    <span>·</span>
                                    <span>⏰ Expires {new Date(order.expiresAt).toLocaleDateString()}</span>
                                </div>
                                {order.status === 'active' && (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <Link to={`/messages/${order.sellerId}`} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 w-fit">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                                Message Seller
                                            </Link>
                                            <button
                                                onClick={() => cancelOrder(order._id)}
                                                disabled={cancellingId === order._id}
                                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                                            >
                                                {cancellingId === order._id ? 'Cancelling...' : 'Cancel Order'}
                                            </button>
                                        </div>
                                        <p className="text-gray-600 text-xs">You can re-order after cancellation</p>
                                    </div>
                                )}
                                {order.status === 'completed' && (
                                    <div className="mt-1">
                                        <Link to={`/messages/${order.sellerId}`} className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 w-fit">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                            Message Seller
                                        </Link>
                                    </div>
                                )}
                                {order.status === 'cancelled' && (
                                    <Link to={`/gigs/${order.gigId}`} className="text-emerald-400 text-xs font-semibold hover:text-emerald-300 underline">
                                        Re-order this Gig →
                                    </Link>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={!!confirmConfig}
                title={confirmConfig?.title || ''}
                message={confirmConfig?.message || ''}
                confirmText={confirmConfig?.confirmText}
                onConfirm={() => {
                    if (!confirmConfig) return;
                    if (confirmConfig.type === 'delete_gig') confirmDeleteGig(confirmConfig.id);
                    else if (confirmConfig.type === 'decline_order') confirmDeclineOrder(confirmConfig.id);
                }}
                onCancel={() => setConfirmConfig(null)}
                isDanger={true}
            />
        </div>
    );
}
