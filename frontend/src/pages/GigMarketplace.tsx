import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_BASE, SERVER_BASE } from '../config';

const CATEGORIES = [
    'All', 'Web Development', 'Mobile Development', 'Design & Creative',
    'Content Writing', 'Digital Marketing', 'Data & Analytics',
    'Video & Animation', 'Music & Audio', 'Business Consulting',
    'Legal & Finance', 'Education & Training', 'Other'
];

const CAT_ICONS: Record<string, string> = {
    'All': '✦',
    'Web Development': '💻',
    'Mobile Development': '📱',
    'Design & Creative': '🎨',
    'Content Writing': '✍️',
    'Digital Marketing': '📣',
    'Data & Analytics': '📊',
    'Video & Animation': '🎬',
    'Music & Audio': '🎵',
    'Business Consulting': '💼',
    'Legal & Finance': '⚖️',
    'Education & Training': '🎓',
    'Other': '⚡',
};

const RUPEE = '₹';

function GigCard({ gig }: { gig: any }) {
    const cover = gig.coverImage ? `${SERVER_BASE}${gig.coverImage}` : null;
    const icon = CAT_ICONS[gig.category] || '⚡';

    return (
        <Link to={`/gigs/${gig._id}`}
            className="group flex flex-col bg-gray-900 border border-gray-800/80 rounded-2xl overflow-hidden hover:border-emerald-500/30 hover:shadow-xl hover:shadow-black/40 transition-all duration-300">
            {/* Cover */}
            <div className="relative h-48 bg-gray-800 overflow-hidden shrink-0">
                {cover ? (
                    <img src={cover} alt={gig.title} loading="lazy" width="400" height="192"
                        className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 via-gray-850 to-gray-900">
                        <span className="text-5xl opacity-30">{icon}</span>
                    </div>
                )}
                {/* Category pill */}
                <div className="absolute top-3 left-3">
                    <span className="text-[10px] font-bold bg-black/60 backdrop-blur-sm text-gray-300 px-2.5 py-1 rounded-full border border-white/10">
                        {icon} {gig.category}
                    </span>
                </div>
            </div>

            {/* Body */}
            <div className="flex flex-col flex-1 p-4 gap-3">
                {/* Seller */}
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-gray-950 text-[10px] font-black shrink-0">
                        {gig.sellerName?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-gray-400 text-xs font-medium truncate flex-1">{gig.sellerName}</span>
                    {gig.sellerBadge === 'Expert' && <span className="text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-200 to-yellow-500 text-gray-950 px-1.5 py-0.5 rounded-sm shrink-0">Expert</span>}
                    {gig.sellerBadge === 'Pro' && <span className="text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-400 to-indigo-500 text-white px-1.5 py-0.5 rounded-sm shrink-0">Pro</span>}
                </div>

                {/* Title */}
                <h3 className="text-white text-sm font-semibold leading-snug line-clamp-2 group-hover:text-emerald-400 transition-colors flex-1">
                    {gig.title}
                </h3>

                {/* Rating */}
                {gig.reviewCount > 0 && (
                    <div className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-amber-400 fill-current" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        <span className="text-amber-400 text-xs font-bold">{gig.avgRating?.toFixed(1)}</span>
                        <span className="text-gray-500 text-xs">({gig.reviewCount})</span>
                    </div>
                )}

                {/* Price */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                    <span className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">Starting at</span>
                    <span className="text-emerald-400 font-black text-base">{RUPEE}{gig.packages?.basic?.price?.toLocaleString()}</span>
                </div>
            </div>
        </Link>
    );
}

function SkeletonCard() {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden animate-pulse">
            <div className="h-48 bg-gray-800" />
            <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-800" />
                    <div className="h-3 bg-gray-800 rounded w-24" />
                </div>
                <div className="space-y-1.5">
                    <div className="h-4 bg-gray-800 rounded w-full" />
                    <div className="h-4 bg-gray-800 rounded w-3/4" />
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-800/60">
                    <div className="h-3 bg-gray-800 rounded w-16" />
                    <div className="h-5 bg-gray-800 rounded w-16" />
                </div>
            </div>
        </div>
    );
}

export default function GigMarketplace() {
    const [searchParams] = useSearchParams();
    const [gigs, setGigs] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(searchParams.get('q') || '');
    const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
    const [category, setCategory] = useState(searchParams.get('category') || 'All');
    const [sort, setSort] = useState('newest');
    const [page, setPage] = useState(1);
    const pages = Math.ceil(total / 20);

    const fetchGigs = async (q = search, cat = category, s = sort, p = page) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(p), sort: s });
            if (q.trim()) params.set('q', q.trim());
            if (cat && cat !== 'All') params.set('category', cat);
            const res = await fetch(`${API_BASE}/gigs?${params}`);
            const data = await res.json();
            setGigs(data.gigs || []);
            setTotal(data.total || 0);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchGigs(search, category, sort, page); }, [category, sort, page]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearch(searchInput);
        setPage(1);
        fetchGigs(searchInput, category, sort, 1);
    };

    const handleCategory = (cat: string) => {
        setCategory(cat);
        setPage(1);
    };

    return (
        <div className="min-h-screen bg-gray-950">

            {/* ── Hero ── */}
            <div className="relative overflow-hidden border-b border-gray-800/60">
                {/* subtle radial glow */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.07),transparent)]" />
                <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-12 text-center">
                    <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-500/20 mb-5">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                        Gig Marketplace
                    </span>
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4 leading-tight">
                        Find the perfect{' '}
                        <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                            freelance service
                        </span>
                    </h1>
                    <p className="text-gray-400 text-base max-w-xl mx-auto mb-8">
                        Fixed-price packages. Order instantly. No bidding, no fuss.
                    </p>

                    {/* Search bar */}
                    <form onSubmit={handleSearch} className="flex gap-2 max-w-lg mx-auto">
                        <div className="relative flex-1">
                            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                placeholder="Search gigs…  e.g. logo design, React developer"
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40 transition-colors"
                            />
                        </div>
                        <button type="submit"
                            className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold px-5 py-3 rounded-xl transition-all text-sm shrink-0">
                            Search
                        </button>
                    </form>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="max-w-7xl mx-auto px-4 py-8">

                {/* Category pills — horizontal scroll on mobile */}
                <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
                    {CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => handleCategory(cat)}
                            className={`flex items-center gap-1.5 shrink-0 text-xs font-semibold px-4 py-2 rounded-full border transition-all ${category === cat
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-600 hover:text-gray-200'}`}>
                            <span>{CAT_ICONS[cat]}</span>
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Toolbar: results count + sort */}
                <div className="flex items-center justify-between mb-6">
                    <p className="text-gray-400 text-sm">
                        {loading ? (
                            <span className="inline-block h-3 w-24 bg-gray-800 rounded animate-pulse" />
                        ) : (
                            <><span className="text-white font-semibold">{total}</span> service{total !== 1 ? 's' : ''} available</>
                        )}
                    </p>
                    <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
                        className="bg-gray-900 border border-gray-800 text-gray-300 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:border-gray-600 cursor-pointer">
                        <option value="newest">Newest First</option>
                        <option value="popular">Most Popular</option>
                        <option value="rating">Top Rated</option>
                    </select>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                ) : gigs.length === 0 ? (
                    <div className="text-center py-24 bg-gray-900/40 rounded-3xl border border-gray-800">
                        <div className="text-6xl mb-5">🔍</div>
                        <h3 className="text-xl font-bold text-white mb-2">No gigs found</h3>
                        <p className="text-gray-400 text-sm mb-7">Try a different search or browse another category</p>
                        <Link to="/gigs/create"
                            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold px-6 py-3 rounded-xl transition-all hover:scale-105">
                            + Be the first to post a gig
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {gigs.map(gig => <GigCard key={gig._id} gig={gig} />)}
                    </div>
                )}

                {/* Pagination */}
                {pages > 1 && (
                    <div className="flex justify-center gap-2 mt-10">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-30 transition-all">
                            ← Prev
                        </button>
                        {Array.from({ length: pages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === pages || Math.abs(p - page) <= 2)
                            .map((p, idx, arr) => (
                                <>
                                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                                        <span key={`gap-${p}`} className="self-center text-gray-500">…</span>
                                    )}
                                    <button key={p} onClick={() => setPage(p)}
                                        className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${p === page
                                            ? 'bg-emerald-500 text-gray-950'
                                            : 'bg-gray-900 text-gray-400 border border-gray-800 hover:border-emerald-500/30 hover:text-white'}`}>
                                        {p}
                                    </button>
                                </>
                            ))}
                        <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                            className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-30 transition-all">
                            Next →
                        </button>
                    </div>
                )}

                {/* Bottom CTA */}
                <div className="mt-16 relative overflow-hidden bg-gradient-to-r from-gray-900 to-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_100%_at_50%_120%,rgba(16,185,129,0.08),transparent)]" />
                    <div className="relative">
                        <h2 className="text-2xl font-black text-white mb-2">Offer your skills as a Gig</h2>
                        <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">Your first gig is completely free to post. Start earning from your expertise today.</p>
                        <Link to="/gigs/create"
                            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold px-8 py-3 rounded-xl transition-all hover:scale-105 text-sm">
                            Create a Gig — It's Free
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
