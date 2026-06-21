import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import { useAuth } from '../hooks/useAuth';

const CATEGORIES = [
    'Web Development', 'Mobile Development', 'Design & Creative',
    'Content Writing', 'Digital Marketing', 'Data & Analytics',
    'Video & Animation', 'Music & Audio', 'Business Consulting',
    'Legal & Finance', 'Education & Training', 'Other'
];

interface PackageForm {
    title: string;
    description: string;
    price: string;
    deliveryDays: string;
    revisions: string;
    features: string;
}

const emptyPkg = (title: string): PackageForm => ({ title, description: '', price: '', deliveryDays: '3', revisions: '1', features: '' });

// ── MUST be outside CreateGig — defining inside causes remount on every render ──
interface PackageSectionProps {
    pkg: PackageForm;
    setPkg: (p: PackageForm) => void;
    label: string;
    accent?: string;
}

function PackageSection({ pkg, setPkg, label, accent = 'emerald' }: PackageSectionProps) {
    const borderColor = accent === 'violet' ? 'border-violet-500/20' : accent === 'blue' ? 'border-blue-500/20' : 'border-emerald-500/20';
    return (
        <div className={`bg-gray-900/60 border ${borderColor} rounded-2xl p-5 space-y-3`}>
            <h3 className="text-sm font-bold text-white">{label} Package</h3>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Price (₹) *</label>
                    <input
                        type="number"
                        value={pkg.price}
                        onChange={e => setPkg({ ...pkg, price: e.target.value })}
                        className="w-full mt-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40"
                        placeholder="499"
                        min="1"
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Delivery (days) *</label>
                    <input
                        type="number"
                        value={pkg.deliveryDays}
                        onChange={e => setPkg({ ...pkg, deliveryDays: e.target.value })}
                        className="w-full mt-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40"
                        placeholder="3"
                        min="1"
                    />
                </div>
            </div>
            <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Package Description</label>
                <input
                    value={pkg.description}
                    onChange={e => setPkg({ ...pkg, description: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40"
                    placeholder="What's included in this package?"
                />
            </div>
            <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Revisions</label>
                <select
                    value={pkg.revisions}
                    onChange={e => setPkg({ ...pkg, revisions: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40"
                >
                    {['1', '2', '3', '5', 'unlimited'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>
            <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Key Features (comma-separated)</label>
                <input
                    value={pkg.features}
                    onChange={e => setPkg({ ...pkg, features: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40"
                    placeholder="Source file, Commercial rights, Fast delivery"
                />
            </div>
        </div>
    );
}

const inputCls = 'w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40 transition-colors';

export default function CreateGig() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [gigCount, setGigCount] = useState<number | null>(null);
    const [credits, setCredits] = useState<number | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [tags, setTags] = useState('');
    const [basic, setBasic] = useState<PackageForm>(emptyPkg('Basic'));
    const [standard, setStandard] = useState<PackageForm>(emptyPkg('Standard'));
    const [premium, setPremium] = useState<PackageForm>(emptyPkg('Premium'));
    const [includeStandard, setIncludeStandard] = useState(false);
    const [includePremium, setIncludePremium] = useState(false);
    const [cover, setCover] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!user) return;
        Promise.all([
            fetch(`${API_BASE}/gigs/my`, { headers: { Authorization: `Bearer ${user.token}` } }).then(r => r.json()),
            fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${user.token}` } }).then(r => r.json())
        ]).then(([gigs, me]) => {
            setGigCount(Array.isArray(gigs) ? gigs.length : 0);
            setCredits(me?.credits || 0);
        }).catch(console.error);
    }, [user]);

    const isFreeSlotUsed = gigCount !== null && gigCount >= 1;
    const creditCost = isFreeSlotUsed ? 3 : 0;

    const buildPkg = (p: PackageForm) => ({
        title: p.title,
        description: p.description,
        price: Number(p.price),
        deliveryDays: Number(p.deliveryDays),
        revisions: p.revisions,
        features: p.features.split(',').map(s => s.trim()).filter(Boolean)
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setError('');

        if (!title.trim()) { setError('Gig title is required.'); return; }
        if (!description.trim()) { setError('Description is required.'); return; }
        if (!basic.price || Number(basic.price) < 1) { setError('Basic package price is required.'); return; }
        if (isFreeSlotUsed && (credits || 0) < 3) {
            setError('You need 3 credits to post an additional gig. Your first gig is free.');
            return;
        }

        setSubmitting(true);
        try {
            const packages: any = { basic: buildPkg(basic) };
            if (includeStandard) packages.standard = buildPkg(standard);
            if (includePremium) packages.premium = buildPkg(premium);

            const formData = new FormData();
            formData.append('title', title.trim());
            formData.append('description', description.trim());
            formData.append('category', category);
            formData.append('tags', JSON.stringify(tags.split(',').map(s => s.trim()).filter(Boolean)));
            formData.append('packages', JSON.stringify(packages));
            if (cover) formData.append('coverImage', cover);

            const res = await fetch(`${API_BASE}/gigs`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${user.token}` },
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                setSuccess(true);
                setTimeout(() => navigate('/gigs/my-gigs'), 2000);
            } else {
                setError(data.message || 'Failed to create gig');
            }
        } catch (err) {
            setError('Failed to create gig. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (success) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-black text-white mb-2">Gig Submitted!</h2>
                <p className="text-gray-400">Your gig is under admin review. It'll go live once approved.</p>
                <p className="text-gray-600 text-sm mt-2">Redirecting to My Gigs…</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-950 py-10 px-4">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-white">Create a Gig</h1>
                    <p className="text-gray-400 mt-1 text-sm">Showcase your services with fixed-price packages</p>
                </div>

                {/* Credit Info */}
                {gigCount !== null && (
                    <div className={`mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${isFreeSlotUsed
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isFreeSlotUsed ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                        </svg>
                        {isFreeSlotUsed
                            ? `You have ${gigCount} gig(s). Posting another costs 3 credits. Your balance: ${credits ?? 0} credits.`
                            : 'Your first gig is FREE to post! 🎉'}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Gig Details</h2>
                        <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1 block">Gig Title *</label>
                            <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls}
                                placeholder="I will design a professional logo for your brand" maxLength={120} />
                            <p className="text-xs text-gray-600 mt-1">{title.length}/120</p>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1 block">Category *</label>
                            <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1 block">Description *</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)}
                                className={`${inputCls} h-32 resize-none`}
                                placeholder="Describe what you offer, your experience, tools you use..." maxLength={3000} />
                            <p className="text-xs text-gray-600 mt-1">{description.length}/3000</p>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1 block">Tags (comma separated)</label>
                            <input value={tags} onChange={e => setTags(e.target.value)} className={inputCls}
                                placeholder="react, logo, ui design, photoshop" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1 block">Cover Image</label>
                            <input type="file" accept="image/*" onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) { setCover(f); setCoverPreview(URL.createObjectURL(f)); }
                            }} className="block text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:bg-gray-800 file:text-gray-300 file:font-semibold file:cursor-pointer hover:file:bg-gray-700" />
                            {coverPreview && <img src={coverPreview} alt="Cover preview" className="mt-3 w-full h-40 object-cover rounded-xl border border-gray-700" />}
                        </div>
                    </div>

                    {/* Packages */}
                    <PackageSection pkg={basic} setPkg={setBasic} label="Basic" accent="emerald" />

                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setIncludeStandard(!includeStandard)}
                            className={`text-sm font-semibold px-4 py-2 rounded-lg border transition-all ${includeStandard ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-600'}`}>
                            {includeStandard ? '✓ Standard Package Added' : '+ Add Standard Package'}
                        </button>
                        <button type="button" onClick={() => setIncludePremium(!includePremium)}
                            className={`text-sm font-semibold px-4 py-2 rounded-lg border transition-all ${includePremium ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-600'}`}>
                            {includePremium ? '✓ Premium Package Added' : '+ Add Premium Package'}
                        </button>
                    </div>

                    {includeStandard && <PackageSection pkg={standard} setPkg={setStandard} label="Standard" accent="blue" />}
                    {includePremium && <PackageSection pkg={premium} setPkg={setPremium} label="Premium" accent="violet" />}

                    {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

                    <button type="submit" disabled={submitting}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold py-4 rounded-xl transition-all hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed text-base">
                        {submitting ? 'Submitting for Review…' : `Submit Gig for Approval${creditCost > 0 ? ` (${creditCost} Credits)` : ' — Free!'}`}
                    </button>
                </form>
            </div>
        </div>
    );
}
