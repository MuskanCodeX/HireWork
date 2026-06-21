import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE, SERVER_BASE } from '../config';
import { useAuth } from '../hooks/useAuth';

const RUPEE = '₹';

export default function GigDetail() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();

    const [gig, setGig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedPkg, setSelectedPkg] = useState<'basic' | 'standard' | 'premium'>('basic');
    const [requirements, setRequirements] = useState('');
    const [ordering, setOrdering] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`${API_BASE}/gigs/${id}`)
            .then(r => r.json())
            .then(data => { setGig(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [id]);

    if (loading) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        </div>
    );

    if (!gig || gig.message) return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-center px-4">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold text-white mb-2">Gig Not Found</h2>
            <Link to="/gigs" className="text-emerald-400 hover:text-emerald-300 underline">Browse all gigs</Link>
        </div>
    );

    const isOwnGig = user && String((user as any)._id || (user as any).id) === String(gig.sellerId);
    const pkg = gig.packages?.[selectedPkg];
    const availablePkgs = (['basic', 'standard', 'premium'] as const).filter(k => gig.packages?.[k]);

    const handleOrder = async () => {
        if (!user) { setError('Please login to place an order'); return; }
        if (!requirements.trim()) { setError('Please describe your requirements before ordering.'); return; }
        setError('');
        setOrdering(true);
        try {
            const res = await fetch(`${API_BASE}/gigs/orders/place`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
                body: JSON.stringify({ gigId: gig._id, selectedPackage: selectedPkg, requirements: requirements.trim() })
            });
            const data = await res.json();
            if (res.ok) {
                setOrderSuccess(true);
            } else {
                setError(data.message || 'Failed to place order');
            }
        } catch {
            setError('Failed to place order. Please try again.');
        } finally {
            setOrdering(false);
        }
    };

    if (orderSuccess) return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-center px-4">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center text-4xl mb-6">✅</div>
            <h2 className="text-3xl font-black text-white mb-2">Order Placed!</h2>
            <p className="text-gray-400 max-w-md mb-2">Your requirements have been sent to <strong className="text-white">{gig.sellerName}</strong>. 1 credit has been deducted from your account.</p>
            <p className="text-gray-400 text-sm mb-8">This order will auto-expire in 3 days if not fulfilled.</p>
            <div className="flex gap-4">
                <Link to="/gigs/my-orders" className="btn-secondary">View My Orders</Link>
                <Link to="/gigs" className="btn-primary">Browse More Gigs</Link>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-950 py-10 px-4">
            <div className="max-w-5xl mx-auto">
                {/* Breadcrumb */}
                <nav className="text-sm text-gray-400 mb-6">
                    <Link to="/gigs" className="hover:text-gray-300 transition-colors">Gigs</Link>
                    <span className="mx-2">/</span>
                    <span className="text-gray-400">{gig.title}</span>
                </nav>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Gig info */}
                    <div className="lg:col-span-2 space-y-6">
                        <h1 className="text-2xl md:text-3xl font-black text-white leading-snug">{gig.title}</h1>

                        {/* Seller row */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-gray-950 font-black">
                                {gig.sellerName?.[0]?.toUpperCase()}
                            </div>
                            <div>
                                <Link to={`/profile/${gig.sellerId}`} className="text-white font-semibold hover:text-emerald-400 transition-colors">{gig.sellerName}</Link>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {gig.reviewCount > 0 && (
                                        <span className="flex items-center gap-1 text-xs text-amber-400">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                            {gig.avgRating?.toFixed(1)} ({gig.reviewCount} reviews)
                                        </span>
                                    )}
                                    <span className="text-gray-500 text-xs">{gig.totalOrders} orders</span>
                                </div>
                            </div>
                        </div>

                        {/* Cover image */}
                        {gig.coverImage && (
                            <div className="rounded-2xl overflow-hidden border border-gray-800">
                                <img src={`${SERVER_BASE}${gig.coverImage}`} alt={gig.title} width="800" height="320" className="w-full object-cover max-h-80" />
                            </div>
                        )}

                        {/* Tags */}
                        {gig.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {gig.tags.map((tag: string) => (
                                    <span key={tag} className="bg-gray-800 text-gray-400 text-xs font-semibold px-3 py-1 rounded-full border border-gray-700">#{tag}</span>
                                ))}
                            </div>
                        )}

                        {/* Description */}
                        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1 h-5 bg-gradient-to-b from-emerald-400 to-cyan-400 rounded-full" />
                                <h2 className="text-base font-bold text-white">About This Gig</h2>
                            </div>
                            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{gig.description}</p>
                        </div>

                        {/* Package comparison */}
                        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
                            <div className="flex border-b border-gray-800">
                                {availablePkgs.map(pkgKey => (
                                    <button
                                        key={pkgKey}
                                        onClick={() => setSelectedPkg(pkgKey)}
                                        className={`flex-1 py-3 text-sm font-bold capitalize transition-all ${selectedPkg === pkgKey
                                            ? 'bg-emerald-500/10 text-emerald-400 border-b-2 border-emerald-500'
                                            : 'text-gray-400 hover:text-gray-200'}`}
                                    >
                                        {pkgKey}
                                    </button>
                                ))}
                            </div>
                            {pkg && (
                                <div className="p-6 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-2xl font-black text-white">{RUPEE}{pkg.price?.toLocaleString()}</h3>
                                        <div className="text-right">
                                            <p className="text-emerald-400 text-sm font-semibold">{pkg.deliveryDays} day delivery</p>
                                            <p className="text-gray-400 text-xs">{pkg.revisions} revision{pkg.revisions !== '1' ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    {pkg.description && <p className="text-gray-400 text-sm">{pkg.description}</p>}
                                    {pkg.features?.length > 0 && (
                                        <ul className="space-y-1.5 mt-3">
                                            {pkg.features.map((f: string, i: number) => (
                                                <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                                                    <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Order sidebar */}
                    <div className="space-y-4">
                        {/* Package selector */}
                        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4 sticky top-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-white text-lg capitalize">{selectedPkg} Package</h3>
                                <span className="text-2xl font-black text-emerald-400">{RUPEE}{pkg?.price?.toLocaleString()}</span>
                            </div>
                            {pkg && (
                                <div className="flex items-center gap-4 text-xs text-gray-400 border-t border-gray-800 pt-3">
                                    <span className="flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {pkg.deliveryDays} days
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        {pkg.revisions} revision{pkg.revisions !== '1' ? 's' : ''}
                                    </span>
                                </div>
                            )}

                            {isOwnGig ? (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-400 text-xs font-medium text-center">
                                    This is your gig
                                </div>
                            ) : user ? (
                                <>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold block mb-1.5">Your Requirements *</label>
                                        <textarea
                                            value={requirements}
                                            onChange={e => setRequirements(e.target.value)}
                                            className="w-full h-28 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                                            placeholder="Describe exactly what you need… colors, style, references, specific requirements..."
                                        />
                                        <p className="text-[10px] text-gray-500 mt-1">This acts as the agreement between you and the seller. Be clear and specific.</p>
                                    </div>
                                    {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
                                    <button
                                        onClick={handleOrder}
                                        disabled={ordering}
                                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold py-3.5 rounded-xl transition-all hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {ordering ? 'Placing Order…' : 'Order Now (1 Credit)'}
                                    </button>
                                    <p className="text-[10px] text-gray-400 text-center">1 credit deducted from buyer & seller. Expires in 3 days.</p>
                                </>
                            ) : (
                                <Link to="/login" className="block w-full text-center bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold py-3.5 rounded-xl transition-all">
                                    Login to Order
                                </Link>
                            )}
                        </div>

                        {/* Category */}
                        <div className="bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Category</p>
                            <Link to={`/gigs?category=${encodeURIComponent(gig.category)}`} className="text-emerald-400 text-sm font-semibold hover:text-emerald-300 transition-colors mt-0.5 block">
                                {gig.category}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
