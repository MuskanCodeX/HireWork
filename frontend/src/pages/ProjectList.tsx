import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../config';
import { SEO } from '../components/SEO';
import { useAuth } from '../hooks/useAuth';

interface Project {
    _id: string;
    title: string;
    description: string;
    budget: number;
    userName: string;
    userBadge?: string;
    createdAt: string;
    bids: any[];
    bidCount?: number;
    status?: string;
    slug?: string;
}

export const ProjectList = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'newest' | 'budget-high' | 'budget-low' | 'most-bids'>('newest');
    const [recommended, setRecommended] = useState<Project[]>([]);
    const [recLoading, setRecLoading] = useState(false);
    const { user } = useAuth();

    useEffect(() => { fetchProjects(); }, []);
    useEffect(() => { fetchRecommended(); }, [user?._id, user?.token]);

    const fetchProjects = async () => {
        try {
            const response = await fetch(`${API_BASE}/projects`);
            const data = await response.json();
            if (response.ok && Array.isArray(data)) setProjects(data);
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchRecommended = async () => {
        if (!user?.token) {
            setRecommended([]);
            return;
        }
        setRecLoading(true);
        try {
            const response = await fetch(`${API_BASE}/projects/feed/recommended?limit=4`, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            const data = await response.json().catch(() => ({ recommendations: [] }));
            if (response.ok && Array.isArray(data?.recommendations)) setRecommended(data.recommendations);
            else setRecommended([]);
        } catch (error) {
            console.error('Error fetching recommendations:', error);
            setRecommended([]);
        } finally {
            setRecLoading(false);
        }
    };

    const handleRefreshRecommendations = () => fetchRecommended();

    const filtered = projects.filter(p => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.userName.toLowerCase().includes(q);
    });

    const getBidCount = (project: Project) => {
        if (Number.isFinite(Number(project.bidCount))) return Number(project.bidCount);
        if (Array.isArray(project.bids)) return project.bids.length;
        return 0;
    };

    const sorted = [...filtered].sort((a, b) => {
        switch (sortBy) {
            case 'budget-high': return b.budget - a.budget;
            case 'budget-low': return a.budget - b.budget;
            case 'most-bids': return getBidCount(b) - getBidCount(a);
            default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
    });

    const totalBudget = projects.reduce((sum, p) => sum + Number(p.budget || 0), 0);
    const openCount = projects.filter(p => p.status !== 'awarded').length;

    const timeAgo = (date: string) => {
        const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return new Date(date).toLocaleDateString();
    };

    const sortOptions = [
        { key: 'newest' as const, label: 'Newest' },
        { key: 'budget-high' as const, label: 'Highest' },
        { key: 'budget-low' as const, label: 'Lowest' },
        { key: 'most-bids' as const, label: 'Popular' },
    ];

    return (
        <div className="min-h-screen bg-gray-950">
            <SEO
                title={`Browse ${projects.length} Freelance Jobs`}
                description="Explore high-paying freelance projects in India. Filter by budget, skills, and newest postings."
            />

            {/* ─────── Hero Header ─────── */}
            <div className="relative overflow-hidden border-b border-white/[0.04]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.08),transparent)]" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-8 sm:pb-10">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
                        <div style={{ animation: 'fadeUp .5s cubic-bezier(.16,1,.3,1)' }}>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-emerald-400 text-[11px] font-bold uppercase tracking-widest">Job Board</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-1">Browse Jobs</h1>
                            <p className="text-gray-400 text-sm sm:text-base">Find your next opportunity from <span className="text-white font-semibold">{projects.length}</span> projects</p>
                        </div>

                        {/* Stat chips */}
                        <div className="flex gap-3" style={{ animation: 'fadeUp .5s cubic-bezier(.16,1,.3,1) .08s both' }}>
                            <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 backdrop-blur-sm">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider leading-none mb-0.5">Open</p>
                                    <p className="text-white font-black text-base leading-none">{openCount}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 backdrop-blur-sm">
                                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider leading-none mb-0.5">Budget</p>
                                    <p className="text-white font-black text-base leading-none">₹{totalBudget.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                {/* ─────── Search & Sort ─────── */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6" style={{ animation: 'fadeUp .5s cubic-bezier(.16,1,.3,1) .12s both' }}>
                    <div className="relative flex-1">
                        <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none">
                            <svg className="w-[18px] h-[18px] text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by title, description, or employer..."
                            className="w-full pl-12 pr-10 py-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 transition-all placeholder-gray-600"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/[0.05] flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                    </div>
                    <div className="flex gap-1 p-1 bg-white/[0.02] border border-white/[0.04] rounded-xl shrink-0">
                        {sortOptions.map(s => (
                            <button key={s.key} onClick={() => setSortBy(s.key)}
                                className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${sortBy === s.key
                                    ? 'bg-white/[0.08] text-white shadow-sm'
                                    : 'text-gray-400 hover:text-gray-300'}`}>
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {user && (
                    <div className="mb-8 bg-white/[0.02] border border-white/[0.04] rounded-2xl p-5" style={{ animation: 'fadeUp .5s cubic-bezier(.16,1,.3,1) .15s both' }}>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.3em] text-gray-400">Personalized</p>
                                <h3 className="text-xl font-bold text-white">Recommended for you</h3>
                            </div>
                            <button onClick={handleRefreshRecommendations} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014-2" /></svg>
                                Refresh
                            </button>
                        </div>
                        {recLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                {[...Array(4)].map((_, idx) => (
                                    <div key={idx} className="rounded-xl bg-white/[0.02] border border-white/[0.03] h-28 animate-pulse" />
                                ))}
                            </div>
                        ) : recommended.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                {recommended.map((project, idx) => (
                                    <Link key={`${project._id}-${idx}`} to={`/projects/${project.slug || project._id}`} className="p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.04] hover:border-emerald-500/20 transition-all">
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Match</p>
                                        <h4 className="text-sm font-bold text-white line-clamp-2 mb-2">{project.title}</h4>
                                        <p className="text-xs text-gray-400 line-clamp-2 mb-3">{project.description}</p>
                                        <div className="flex items-center justify-between text-xs text-gray-300">
                                            <span>₹{Number(project.budget || 0).toLocaleString()}</span>
                                            <span>{new Date(project.createdAt || Date.now()).toLocaleDateString()}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm">We need more signals to personalize jobs for you.</p>
                        )}
                    </div>
                )}

                {/* Results count */}
                {search && (
                    <p className="text-gray-500 text-sm mb-5">
                        <span className="text-white font-semibold">{sorted.length}</span> result{sorted.length !== 1 ? 's' : ''} for "<span className="text-emerald-400">{search}</span>"
                    </p>
                )}

                {/* ─────── Content ─────── */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="rounded-2xl bg-white/[0.02] border border-white/[0.04] p-6 space-y-4" style={{ animation: `fadeUp .4s cubic-bezier(.16,1,.3,1) ${i * 0.06}s both` }}>
                                <div className="flex justify-between">
                                    <div className="h-6 w-16 bg-gray-800/60 rounded-full animate-pulse" />
                                    <div className="h-6 w-20 bg-gray-800/50 rounded-md animate-pulse" />
                                </div>
                                <div className="h-5 w-3/4 bg-gray-800/50 rounded animate-pulse" />
                                <div className="space-y-2">
                                    <div className="h-3 w-full bg-gray-800/30 rounded animate-pulse" />
                                    <div className="h-3 w-5/6 bg-gray-800/30 rounded animate-pulse" />
                                </div>
                                <div className="pt-4 border-t border-white/[0.03] flex justify-between">
                                    <div className="h-4 w-24 bg-gray-800/40 rounded animate-pulse" />
                                    <div className="h-4 w-16 bg-gray-800/40 rounded animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : sorted.length === 0 && projects.length > 0 ? (
                    <div className="text-center py-20" style={{ animation: 'fadeUp .5s cubic-bezier(.16,1,.3,1)' }}>
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">No matching projects</h3>
                        <p className="text-gray-400 text-sm mb-6">Try adjusting your search terms</p>
                        <button onClick={() => setSearch('')} className="bg-white/[0.06] hover:bg-white/[0.1] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all">Clear Search</button>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-20" style={{ animation: 'fadeUp .5s cubic-bezier(.16,1,.3,1)' }}>
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center">
                            <svg className="w-8 h-8 text-emerald-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">No projects yet</h3>
                        <p className="text-gray-400 text-sm mb-6">Be the first to post a project!</p>
                        <Link to="/post-project" className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold px-5 py-2.5 rounded-xl text-sm transition-all">Post a Project</Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sorted.map((project, idx) => (
                            <Link key={project._id} to={`/projects/${project.slug || project._id}`} className="group relative block"
                                style={{ animation: `fadeUp .4s cubic-bezier(.16,1,.3,1) ${Math.min(idx * 0.05, 0.4)}s both` }}>
                                <div className="relative bg-white/[0.02] border border-white/[0.05] group-hover:border-emerald-500/20 group-hover:bg-white/[0.04] rounded-2xl p-5 sm:p-6 h-full flex flex-col transition-all duration-300">
                                    {/* Top row */}
                                    <div className="flex justify-between items-start mb-4">
                                        {project.status === 'awarded' ? (
                                            <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 text-[11px] font-bold px-2.5 py-1 rounded-full border border-amber-500/15">
                                                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" /> Awarded
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-500/15">
                                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Open
                                            </span>
                                        )}
                                        <div className="text-right">
                                            <p className="text-emerald-400 font-black text-xl leading-none">₹{Number(project.budget || 0).toLocaleString()}</p>
                                            <p className="text-gray-500 text-[10px] font-semibold mt-0.5 tracking-wider">BUDGET</p>
                                        </div>
                                    </div>

                                    <h3 className="text-[15px] sm:text-base font-bold text-gray-200 group-hover:text-white transition-colors mb-2 line-clamp-2 leading-snug">{project.title}</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed line-clamp-3 flex-1 mb-5">{project.description}</p>

                                    {/* Footer */}
                                    <div className="pt-4 border-t border-white/[0.04] flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-gradient-to-br from-gray-700 to-gray-600 rounded-full flex items-center justify-center text-[11px] font-bold text-white">
                                                {project.userName.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-gray-300 text-xs font-semibold">{project.userName}</p>
                                                    {project.userBadge === 'Pro' && (
                                                        <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-amber-300 to-yellow-400 text-gray-950 text-[8px] font-black px-1 rounded">
                                                            <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>PRO
                                                        </span>
                                                    )}
                                                    {project.userBadge === 'Expert' && (
                                                        <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-blue-400 to-cyan-400 text-gray-950 text-[8px] font-black px-1 rounded">
                                                            <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>EXPERT
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-gray-600 text-[10px]">{timeAgo(project.createdAt)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] group-hover:border-emerald-500/15 transition-colors">
                                            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            <span className="text-gray-300 text-xs font-bold">{getBidCount(project)}</span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
        </div>
    );
};
