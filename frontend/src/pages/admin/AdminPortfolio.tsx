import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE } from '../../config';
import { CheckCircle, XCircle, Briefcase, ExternalLink, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { PromptModal } from '../../components/PromptModal';

import type { PortfolioItem } from '../../types/portfolio';

const SERVER_BASE = API_BASE.replace(/\/api$/, '');

export const AdminPortfolio = () => {
    const { user } = useAuth();
    const [items, setItems] = useState<PortfolioItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [promptConfig, setPromptConfig] = useState<{ id: string } | null>(null);

    useEffect(() => {
        fetchPendingItems();
    }, [user?._id, user?.token]);

    const fetchPendingItems = async () => {
        try {
            const res = await fetch(`${API_BASE}/portfolio/admin/pending`, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setItems(data);
            }
        } catch (error) {
            console.error('Error fetching pending portfolio items:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async (id: string, action: 'approve' | 'reject', feedback: string = '') => {
        if (action === 'reject' && !feedback && !promptConfig) {
            setPromptConfig({ id });
            return;
        }

        setPromptConfig(null);

        setResolvingId(id);
        try {
            const res = await fetch(`${API_BASE}/portfolio/admin/${id}/resolve`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${user?.token}`
                },
                body: JSON.stringify({ action, feedback })
            });

            if (res.ok) {
                setItems(prev => prev.filter(item => item._id !== id));
                toast.success(`Submission ${action}d successfully.`);
            } else {
                const data = await res.json();
                toast.error(data.message || 'Failed to resolve portfolio item');
            }
        } catch (error) {
            console.error('Error resolving portfolio item:', error);
            toast.error('An error occurred while resolving the item');
        } finally {
            setResolvingId(null);
        }
    };

    if (loading) {
        return (
            <div className="animate-pulse space-y-4 pt-4">
                <div className="h-10 bg-gray-800 rounded w-1/4"></div>
                <div className="h-64 bg-gray-900 rounded-xl border border-gray-800"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-emerald-400">
                        Portfolio Review
                    </h1>
                    <p className="text-gray-400 mt-1">Review user portfolio submissions for quality and platform compliance.</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 flex items-center gap-2">
                    <Briefcase className="text-emerald-400" size={20} />
                    <span className="text-white font-bold">{items.length}</span>
                    <span className="text-gray-400 text-sm">Pending</span>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="text-center py-16 bg-gray-900/50 border border-gray-800 border-dashed rounded-xl">
                    <Briefcase className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">No items to review</h3>
                    <p className="text-gray-500">Wait for users to submit their brilliant work!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-8">
                    {items.map(item => (
                        <div key={item._id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
                            {/* Images Section */}
                            <div className="w-full md:w-2/5 p-4 bg-gray-950">
                                <div className="grid grid-cols-1 gap-3 h-full">
                                    {item.images.length > 0 ? (
                                        item.images.map((img, idx) => (
                                            <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-gray-800 group">
                                                <img
                                                    src={`${SERVER_BASE}/uploads/${img}`}
                                                    alt={`${item.title} - image ${idx + 1}`}
                                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                />
                                                <a
                                                    href={`${SERVER_BASE}/uploads/${img}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                                >
                                                    <ImageIcon className="text-white" size={24} />
                                                </a>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-gray-700 border-2 border-dashed border-gray-800 rounded-xl">
                                            <ImageIcon size={48} />
                                            <p className="text-sm mt-2">No images provided</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Content Section */}
                            <div className="flex-1 p-6 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">{item.title}</h3>
                                        <p className="text-sm text-emerald-400 font-medium">By {item.user?.name || 'User'}</p>
                                    </div>
                                    <div className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">
                                        SUBMITTED {new Date(item.createdAt).toLocaleDateString()}
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <div className="bg-gray-950/50 p-4 rounded-xl border border-gray-800/50 mb-4 min-h-[100px]">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</h4>
                                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{item.description}</p>
                                    </div>

                                    {item.externalLink && (
                                        <div className="mb-6">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">External Link</h4>
                                            <a
                                                href={item.externalLink}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-blue-400 hover:text-blue-300 flex items-center gap-1.5 text-sm font-medium transition-colors"
                                            >
                                                <ExternalLink size={14} />
                                                {item.externalLink}
                                            </a>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-4 mt-auto pt-6 border-t border-gray-800/50">
                                    <button
                                        onClick={() => handleResolve(item._id, 'reject')}
                                        disabled={resolvingId === item._id}
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-500/20 disabled:opacity-50"
                                    >
                                        <XCircle size={20} />
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => handleResolve(item._id, 'approve')}
                                        disabled={resolvingId === item._id}
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold bg-emerald-500 text-gray-950 hover:bg-emerald-400 transition-all shadow-[0_8px_20px_-6px_rgba(16,185,129,0.3)] disabled:opacity-50"
                                    >
                                        <CheckCircle size={20} />
                                        Approve Submission
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <PromptModal
                isOpen={!!promptConfig}
                title="Reject Submission"
                message="Please provide a reason for rejection. This helps the user improve their portfolio."
                onConfirm={(val) => promptConfig && handleResolve(promptConfig.id, 'reject', val)}
                onCancel={() => setPromptConfig(null)}
                placeholder="e.g. Image quality is too low or content is irrelevant..."
            />
        </div>
    );
};
