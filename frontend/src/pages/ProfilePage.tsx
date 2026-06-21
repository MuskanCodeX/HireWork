import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ReportModal } from '../components/ReportModal';
import { VerificationModal } from '../components/VerificationModal';
import { PortfolioModal } from '../components/PortfolioModal';
import { PortfolioViewer } from '../components/PortfolioViewer';
import { SEO } from '../components/SEO';
import { motion, useScroll, useTransform } from 'framer-motion';
import { subscribeToPush, unsubscribeFromPush, isPushSupported } from '../lib/pushNotifications';
import toast from 'react-hot-toast';

import { SERVER_BASE, API_BASE } from '../config';

const API_URL = SERVER_BASE;
const RUPEE_SYMBOL = '\u20B9';
const CHECK_MARK = '\u2713';

const TRUST_BADGE_STYLES: Record<string, { label: string; classes: string }> = {
    bronze: { label: 'Bronze Trust', classes: 'bg-orange-500/15 text-orange-200 border border-orange-500/40' },
    silver: { label: 'Silver Trust', classes: 'bg-slate-200/10 text-slate-100 border border-slate-200/40' },
    gold: { label: 'Gold Trust', classes: 'bg-yellow-500/15 text-yellow-200 border border-yellow-500/40' },
    platinum: { label: 'Platinum Trust', classes: 'bg-blue-200/10 text-blue-100 border border-blue-200/40' }
};

interface Review {
    _id: string;
    projectTitle: string;
    reviewerName: string;
    rating: number;
    comment: string;
    amount: number;
    createdAt: string;
}

interface VerificationStatus {
    isVerified: boolean;
    status: 'none' | 'pending' | 'approved' | 'rejected';
    rejectionReason?: string;
    updatedAt?: string | null;
}

const AnimatedBackground = ({ reduceMotion }: { reduceMotion?: boolean }) => {
    if (reduceMotion) {
        return (
            <div className="fixed inset-0 z-[-1] pointer-events-none" aria-hidden="true">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-black opacity-80" />
                <div className="absolute inset-0 bg-dot-pattern opacity-[0.04]" />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
            <motion.div
                animate={{ x: [0, 50, 0], y: [0, 30, 0], rotate: [0, 10, 0] }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full"
            />
            <motion.div
                animate={{ x: [0, -40, 0], y: [0, 50, 0], rotate: [0, -15, 0] }}
                transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                className="absolute top-[20%] -right-[10%] w-[45%] h-[45%] bg-blue-500/10 blur-[150px] rounded-full"
            />
            <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.15, 0.1] }}
                transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute bottom-[-10%] left-[15%] w-[50%] h-[50%] bg-violet-500/10 blur-[130px] rounded-full"
            />
            <div className="absolute inset-0 bg-dot-pattern opacity-[0.05]" />
        </div>
    );
};

const useIsMobileView = () => {
    const getMatch = () => (typeof window === 'undefined' ? false : window.innerWidth < 768);
    const [isMobile, setIsMobile] = useState(getMatch);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handler = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handler, { passive: true });
        return () => window.removeEventListener('resize', handler);
    }, []);

    return isMobile;
};

const usePrefersReducedMotionSetting = () => {
    const getPreference = () => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    };
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(getPreference);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handler = () => setPrefersReducedMotion(mediaQuery.matches);
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handler);
        } else {
            mediaQuery.addListener(handler);
        }
        return () => {
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener('change', handler);
            } else {
                mediaQuery.removeListener(handler);
            }
        };
    }, []);

    return prefersReducedMotion;
};

export const ProfilePage = () => {
    const { user, login, isLoading: authLoading } = useAuth();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isMobileView = useIsMobileView();
    const prefersReducedMotion = usePrefersReducedMotionSetting();
    const reduceMotion = isMobileView || prefersReducedMotion;
    const enableMotion = !reduceMotion;
    const [isEditing, setIsEditing] = useState(false);
    const [profileData, setProfileData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    const [name, setName] = useState('');
    const [bio, setBio] = useState('');
    const [skills, setSkills] = useState('');
    const [hourlyRate, setHourlyRate] = useState('');
    const [experience, setExperience] = useState('');
    const [phone, setPhone] = useState('');
    const [upiId, setUpiId] = useState('');
    const [aadhaarLast4, setAadhaarLast4] = useState('');
    const [uploadingQr, setUploadingQr] = useState(false);
    const qrInputRef = useRef<HTMLInputElement>(null);

    const { scrollY } = useScroll();
    const coverY = useTransform(scrollY, [0, 500], [0, 150]);
    const headerOpacity = useTransform(scrollY, [0, 300], [1, 0]);

    const isOwnProfile = !id || (user && user._id === id);

    const [reviews, setReviews] = useState<Review[]>([]);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
    const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false);
    const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
    const [selectedPortfolioItem, setSelectedPortfolioItem] = useState<any | null>(null);
    const [isPortfolioViewerOpen, setIsPortfolioViewerOpen] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);
    const [pushStatus, setPushStatus] = useState<'enabled' | 'disabled' | 'unsupported'>('disabled');
    const [pushError, setPushError] = useState<string | null>(null);
    const [achievements, setAchievements] = useState<any[]>([]);
    const [achievementSummary, setAchievementSummary] = useState<any>(null);
    const [achievementsLoading, setAchievementsLoading] = useState(false);
    const heroPortfolioItem = useMemo(() => (portfolioItems.length > 0 ? portfolioItems[0] : null), [portfolioItems]);
    const gridPortfolioItems = useMemo(() => (portfolioItems.length > 1 ? portfolioItems.slice(1) : []), [portfolioItems]);
    const displayedPortfolioGrid = useMemo(() => {
        const source = heroPortfolioItem ? gridPortfolioItems : portfolioItems;
        return isMobileView ? source.slice(0, 4) : source;
    }, [heroPortfolioItem, gridPortfolioItems, portfolioItems, isMobileView]);

    const formatLastActive = (value?: string | null) => {
        if (!value) return 'Recently active';
        const timestamp = new Date(value).getTime();
        if (Number.isNaN(timestamp)) return 'Recently active';
        const diff = Date.now() - timestamp;
        if (diff < 60_000) return 'Active now';
        const minutes = Math.floor(diff / 60_000);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    useEffect(() => {
        if (!authLoading && !user && !id) {
            navigate('/login');
            return;
        }

        if (id || user) {
            fetchProfile();
            fetchReviews();
            fetchPortfolio();
            if (isOwnProfile && user) {
                fetchVerificationStatus();
                fetchAchievements();
            } else {
                setVerificationStatus(null);
                fetchUserAchievements(id || user?._id);
            }
        }
    }, [id, user?._id, user?.token, isOwnProfile, authLoading]);

    useEffect(() => {
        if (!isOwnProfile) return;
        if (!isPushSupported()) {
            setPushStatus('unsupported');
            return;
        }
        if (profileData?.pushOptIn) {
            setPushStatus('enabled');
        } else {
            setPushStatus('disabled');
        }
    }, [profileData?.pushOptIn, isOwnProfile]);

    const fetchReviews = async () => {
        const userId = id || (user ? user._id : null);
        if (!userId) return;
        try {
            const res = await fetch(`${API_BASE}/reviews/${userId}`);
            const data = await res.json();
            if (res.ok && Array.isArray(data)) setReviews(data);
        } catch (err) { console.error('Error fetching reviews:', err); }
    };

    const fetchProfile = async () => {
        try {
            const userId = id || (user ? user._id : null);
            if (!userId) return;
            setError(null);
            const headers: Record<string, string> = {};
            if (user?.token) {
                headers.Authorization = `Bearer ${user.token}`;
            }
            const response = await fetch(`${API_URL}/api/auth/${userId}?ts=${Date.now()}`, {
                headers,
                cache: 'no-store'
            });
            const data = await response.json();
            if (response.ok) {
                setProfileData(data);
                setName(data.name);
                setBio(data.bio || '');
                setSkills(data.skills ? data.skills.join(', ') : '');
                setHourlyRate(data.hourlyRate || '');
                setExperience(data.experience || '');
                setPhone(data.phone || '');
                setUpiId(data.upiId || '');
                setAadhaarLast4(data.aadhaarLast4 || '');
            } else {
                setError(data.message || 'User not found');
            }
        } catch (error) {
            console.error("Error fetching profile", error);
            setError('Failed to connect to server');
        }
    };

    const fetchVerificationStatus = async () => {
        if (!user?.token) return;
        try {
            const response = await fetch(`${API_BASE}/verification/me?ts=${Date.now()}`, {
                headers: { Authorization: `Bearer ${user.token}` },
                cache: 'no-store'
            });
            const data = await response.json();
            if (response.ok && data) {
                setVerificationStatus(data);
            }
        } catch (error) {
            console.error('Error fetching verification status', error);
        }
    };

    const fetchPortfolio = async () => {
        const userId = id || (user ? user._id : null);
        if (!userId) return;
        try {
            const url = isOwnProfile && user?.token
                ? `${API_BASE}/portfolio/me`
                : `${API_BASE}/portfolio/user/${userId}`;

            const headers: Record<string, string> = {};
            if (isOwnProfile && user?.token) {
                headers.Authorization = `Bearer ${user.token}`;
            }

            const res = await fetch(url, { headers });
            const data = await res.json();
            if (res.ok && Array.isArray(data)) {
                setPortfolioItems(data);
            }
        } catch (err) {
            console.error('Error fetching portfolio:', err);
        }
    };

    const fetchAchievements = async () => {
        if (!user?.token) return;
        setAchievementsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/achievements/my`, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            const data = await res.json();
            if (res.ok && data.achievements) {
                setAchievements(data.achievements);
                setAchievementSummary(data.summary);
            }
        } catch (err) {
            console.error('Error fetching achievements:', err);
        } finally {
            setAchievementsLoading(false);
        }
    };

    const fetchUserAchievements = async (userId?: string) => {
        if (!userId) return;
        setAchievementsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/achievements/user/${userId}`);
            const data = await res.json();
            if (res.ok && data.achievements) {
                setAchievements(data.achievements);
                setAchievementSummary(data.summary);
            }
        } catch (err) {
            console.error('Error fetching user achievements:', err);
        } finally {
            setAchievementsLoading(false);
        }
    };

    const handleEnablePush = async () => {
        if (!user) return;
        setPushLoading(true);
        setPushError(null);
        try {
            await subscribeToPush(user.token);
            setPushStatus('enabled');
            await fetchProfile();
        } catch (err: any) {
            console.error('Enable push failed:', err);
            setPushError(err?.message || 'Failed to enable push notifications');
        } finally {
            setPushLoading(false);
        }
    };

    const handleDisablePush = async () => {
        if (!user) return;
        setPushLoading(true);
        setPushError(null);
        try {
            await unsubscribeFromPush(user.token);
            setPushStatus('disabled');
            await fetchProfile();
        } catch (err: any) {
            console.error('Disable push failed:', err);
            setPushError(err?.message || 'Failed to disable push notifications');
        } finally {
            setPushLoading(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        try {
            console.log('[DEBUG] Updating profile with data:', { name, bio, skills, hourlyRate, experience, phone, upiId, aadhaarLast4 });
            const response = await fetch(`${API_BASE}/auth/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                body: JSON.stringify({ name, bio, skills: skills.split(',').map(s => s.trim()).filter(s => s), hourlyRate: Number(hourlyRate), experience, phone, upiId, aadhaarLast4 }),
            });
            const data = await response.json();
            console.log('[DEBUG] Profile update response:', data);
            if (response.ok) {
                login(data);
                setProfileData(data);
                setIsEditing(false);
                toast.success('Profile updated successfully!');
            } else { toast.error(data.message); }
        } catch (error) { console.error('Error updating profile:', error); }
    };

    const uploadImage = async (file: File, type: 'avatar' | 'cover') => {
        if (!user) return;
        const setter = type === 'avatar' ? setUploadingAvatar : setUploadingCover;
        setter(true);
        try {
            const formData = new FormData();
            formData.append(type, file);
            const endpoint = type === 'avatar' ? 'upload-avatar' : 'upload-cover';
            const response = await fetch(`${API_URL}/api/auth/${endpoint}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${user.token}` },
                body: formData,
            });
            if (response.ok) {
                fetchProfile();
            } else {
                const data = await response.json();
                toast.error(data.message || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setter(false);
        }
    };

    const uploadQr = async (file: File) => {
        if (!user) return;
        setUploadingQr(true);
        try {
            const formData = new FormData();
            formData.append('qrCode', file);
            const response = await fetch(`${API_URL}/api/auth/upload-qr`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${user.token}` },
                body: formData,
            });
            if (response.ok) {
                fetchProfile();
                toast.success('QR uploaded successfully.');
            } else {
                const payload = await response.json();
                toast.error(payload?.message || 'QR upload failed');
            }
        } catch (error) {
            console.error('QR Upload error:', error);
            toast.error('QR upload failed. Please try again.');
        } finally {
            setUploadingQr(false);
        }
    };

    if (authLoading || (!profileData && !error)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950">
                <AnimatedBackground reduceMotion />
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full mx-auto animate-spin mb-6" />
                    <p className="text-gray-500 font-black uppercase tracking-widest text-[10px] animate-pulse">Syncing Profile Data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950 p-6">
                <AnimatedBackground />
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full p-8 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-2xl text-center"
                >
                    <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center text-red-400 mx-auto mb-6">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-black text-white mb-2">Something's Missing</h2>
                    <p className="text-gray-400 mb-8 font-medium">We couldn't find the profile you're looking for. It might have been moved or doesn't exist.</p>
                    <Link to="/" className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black transition-all">
                        Back to Home
                    </Link>
                </motion.div>
            </div>
        );
    }

    const avatarUrl = profileData.avatar ? `${API_URL}${profileData.avatar}` : null;
    const coverUrl = profileData.coverImage ? `${API_URL}${profileData.coverImage}` : null;

    return (
        <div className="min-h-screen bg-gray-950">
            <SEO
                title={`${profileData.name} - ${profileData.role === 'freelancer' ? 'Professional Freelancer' : 'Hiring Expert'}`}
                description={`${profileData.name} is a ${profileData.role} on HIREWORK. ${profileData.bio ? profileData.bio.slice(0, 150) : 'Connect and collaborate on premium projects.'}`}
            />
            <AnimatedBackground reduceMotion={reduceMotion} />

            {/* Cover Section */}
            <div className="relative">
                <motion.div
                    style={{
                        y: enableMotion ? coverY : 0,
                        opacity: enableMotion ? headerOpacity : 1,
                        backgroundImage: coverUrl
                            ? `url(${coverUrl})`
                            : 'linear-gradient(135deg, #059669 0%, #0891b2 50%, #6366f1 100%)'
                    }}
                    className="h-56 md:h-72 w-full bg-cover bg-center relative"
                >
                    {/* Cover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-gray-950" />

                    {/* Decorative mesh */}
                    <div className="absolute inset-0 opacity-20" style={{
                        backgroundImage: 'radial-gradient(circle at 25% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(255,255,255,0.05) 0%, transparent 50%)'
                    }} />

                    {isOwnProfile && (
                        <>
                            <input
                                type="file"
                                ref={coverInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => { if (e.target.files?.[0]) uploadImage(e.target.files[0], 'cover'); }}
                            />
                            <button
                                onClick={() => coverInputRef.current?.click()}
                                className="absolute top-4 right-4 bg-black/40 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-black/60 transition-all flex items-center gap-2 border border-white/10"
                                disabled={uploadingCover}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {uploadingCover ? 'Uploading...' : 'Edit Cover'}
                            </button>
                        </>
                    )}
                </motion.div>

                {/* Profile Info Overlay */}
                <div className="container mx-auto px-4 relative" style={{ marginTop: '-80px' }}>
                    <div className="max-w-4xl mx-auto">
                        <div className="flex flex-col md:flex-row items-center md:items-end gap-5">
                            {/* Avatar */}
                            <div className="relative group z-10">
                                <motion.div
                                    whileHover={enableMotion ? { scale: 1.05 } : undefined}
                                    className="w-32 h-32 rounded-2xl border-4 border-gray-950 shadow-2xl overflow-hidden bg-gray-800 ring-4 ring-gray-900/50"
                                >
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={profileData.name} className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-5xl font-black text-white">
                                            {profileData.name.charAt(0)}
                                        </div>
                                    )}
                                </motion.div>
                                {isOwnProfile && (
                                    <>
                                        <input
                                            type="file"
                                            ref={avatarInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => { if (e.target.files?.[0]) uploadImage(e.target.files[0], 'avatar'); }}
                                        />
                                        <button
                                            onClick={() => avatarInputRef.current?.click()}
                                            className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center"
                                            disabled={uploadingAvatar}
                                        >
                                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </button>
                                    </>
                                )}
                                {/* Online indicator */}
                                <div className="absolute bottom-2 right-2 w-4 h-4 bg-emerald-500 rounded-full border-2 border-gray-950" />
                            </div>

                            {/* Name & Meta */}
                            <div className="flex-1 text-center md:text-left pb-2">
                                <div className="flex items-center justify-center md:justify-start gap-3">
                                    <h1 className="text-3xl font-black text-white tracking-tight">{profileData.name}</h1>
                                    {profileData.badge === 'Pro' && (
                                        <div className="bg-gradient-to-r from-amber-200 to-yellow-400 text-gray-950 text-xs font-black px-2 py-0.5 rounded flex items-center gap-1 shadow-[0_0_15px_-3px_rgba(251,191,36,0.5)] transform translate-y-1">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                            PRO
                                        </div>
                                    )}
                                    {profileData.badge === 'Expert' && (
                                        <div className="bg-gradient-to-r from-blue-400 to-cyan-400 text-gray-950 text-xs font-black px-2 py-0.5 rounded flex items-center gap-1 shadow-[0_0_15px_-3px_rgba(34,211,238,0.5)] transform translate-y-1">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                            EXPERT
                                        </div>
                                    )}
                                    {profileData.badgeSubscriptionEnd && (
                                        <div className="text-gray-500 text-xs mt-1 ml-2 self-end pb-1">
                                            Valid until {new Date(profileData.badgeSubscriptionEnd).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center justify-center md:justify-start gap-3 mt-2 flex-wrap">
                                    <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/20 capitalize">
                                        {profileData.role}
                                    </span>
                                    <span className="flex items-center gap-1.5 text-gray-400 text-sm">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                        Available for hire
                                    </span>
                                    {profileData.hourlyRate && (
                                        <span className="text-emerald-400 font-bold text-sm">{RUPEE_SYMBOL}{profileData.hourlyRate}/hr</span>
                                    )}
                                    {/* Average Rating */}
                                    {(profileData.reviewCount ?? reviews.length) > 0 && (
                                        <span className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                                            <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                            </svg>
                                            <span className="text-amber-400 font-bold text-sm">
                                                {(profileData.avgRating ?? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length)).toFixed(1)}
                                            </span>
                                            <span className="text-gray-500 text-xs">({profileData.reviewCount ?? reviews.length})</span>
                                        </span>
                                    )}
                                </div>
                                {/* Verification Badges */}
                                <div className="flex items-center justify-center md:justify-start gap-2 mt-2 flex-wrap">
                                    {profileData.isEmailVerified && (
                                        <span className="flex items-center gap-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20">
                                            {CHECK_MARK} Email
                                        </span>
                                    )}
                                    {profileData.isPhoneVerified && (
                                        <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                                            {CHECK_MARK} Phone
                                        </span>
                                    )}
                                    {profileData.isAadhaarVerified && (
                                        <span className="flex items-center gap-1 bg-violet-500/10 text-violet-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-violet-500/20">
                                            {CHECK_MARK} Aadhaar
                                        </span>
                                    )}
                                    {profileData.trustBadge && TRUST_BADGE_STYLES[profileData.trustBadge] && (
                                        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${TRUST_BADGE_STYLES[profileData.trustBadge].classes}`}>
                                            ⚡ {TRUST_BADGE_STYLES[profileData.trustBadge].label}
                                        </span>
                                    )}
                                    {isOwnProfile && verificationStatus?.status === 'pending' && (
                                        <span className="flex items-center gap-1 bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
                                            KYC Pending Review
                                        </span>
                                    )}
                                    {isOwnProfile && verificationStatus?.status === 'rejected' && (
                                        <span className="flex items-center gap-1 bg-red-500/10 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/20">
                                            KYC Rejected
                                        </span>
                                    )}
                                </div>
                                {isOwnProfile && verificationStatus?.status === 'rejected' && verificationStatus?.rejectionReason && (
                                    <p className="text-xs text-red-300/90 mt-2 max-w-md">
                                        Rejection reason: {verificationStatus.rejectionReason}
                                    </p>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pb-2">
                                {!isOwnProfile && user && (
                                    <>
                                        <Link to={`/messages/${id}`} className="btn-primary !py-2.5 !px-5 text-sm flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                            Message
                                        </Link>
                                        <button
                                            onClick={() => setIsReportModalOpen(true)}
                                            className="btn-secondary text-red-400 hover:text-white hover:bg-red-500 hover:border-red-500 !py-2.5 !px-5 text-sm flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                            </svg>
                                            Report
                                        </button>
                                    </>
                                )}
                                {isOwnProfile && !isEditing && (
                                    <button onClick={() => setIsEditing(true)} className="btn-secondary !py-2.5 !px-5 text-sm flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Edit Profile
                                    </button>
                                )}
                                {isOwnProfile && !profileData.isAadhaarVerified && verificationStatus?.status !== 'pending' && verificationStatus?.status !== 'approved' && (
                                    <button
                                        onClick={() => setIsVerificationModalOpen(true)}
                                        className="font-bold py-2.5 px-5 rounded-xl text-sm flex items-center gap-2 shadow-lg transition-all hover:scale-105 bg-blue-600/20 text-blue-400 border border-blue-600/30 hover:bg-blue-600 hover:text-white"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Verify Identity
                                    </button>
                                )}
                                {isOwnProfile && (
                                    <Link
                                        to="/membership"
                                        className={`font-bold py-2.5 px-5 rounded-xl text-sm flex items-center gap-2 shadow-lg transition-all hover:scale-105 ${profileData.badge
                                            ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                            : 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-gray-950 shadow-amber-500/20'
                                            }`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {profileData.badge ? 'Manage Membership' : 'Get Verified'}
                                    </Link>
                                )}

                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="container mx-auto px-4 py-10">
                <div className="max-w-4xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Sidebar */}
                        <div className="space-y-4">
                            {/* Details Card */}
                            <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-800/80 p-5">
                                <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-4">Details</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">Hourly Rate</p>
                                            <p className="font-bold text-emerald-400">{profileData.hourlyRate ? `${RUPEE_SYMBOL}${profileData.hourlyRate}/hr` : 'Negotiable'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">Experience</p>
                                            <p className="font-medium text-gray-300 text-sm">{profileData.experience || 'Not specified'}</p>
                                        </div>
                                    </div>
                                    {isOwnProfile && (
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center shrink-0">
                                                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">Email</p>
                                                <p className="font-medium text-gray-300 text-sm truncate">{profileData.email}</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-violet-500/10 rounded-lg flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">Role</p>
                                            <p className="font-medium text-gray-300 text-sm capitalize">{profileData.role}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Trust Card */}
                            <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-800/80 p-5 space-y-4">
                                <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Trust & Reputation</h3>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Trust Score</p>
                                        <p className="text-4xl font-black text-white">
                                            {Math.round(profileData.trustScore ?? Math.min(100, (profileData.avgRating || 0) * 20))}
                                            <span className="text-xs text-gray-500 font-semibold"> / 100</span>
                                        </p>
                                    </div>
                                    {profileData.trustBadge && TRUST_BADGE_STYLES[profileData.trustBadge] && (
                                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${TRUST_BADGE_STYLES[profileData.trustBadge].classes}`}>
                                            {TRUST_BADGE_STYLES[profileData.trustBadge].label}
                                        </span>
                                    )}
                                </div>
                                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                                        style={{ width: `${Math.min(100, profileData.trustScore ?? (profileData.avgRating || 0) * 20)}%` }}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-center">
                                    <div className="p-3 rounded-lg bg-gray-900 border border-gray-800">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Avg Rating</p>
                                        <p className="text-xl font-bold text-white">{(profileData.avgRating ?? 0).toFixed(1)}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-gray-900 border border-gray-800">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Reviews</p>
                                        <p className="text-xl font-bold text-white">{profileData.reviewCount ?? 0}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-gray-900 border border-gray-800">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Communication</p>
                                        <p className="text-lg font-bold text-emerald-300">{(profileData.communicationRating ?? 0).toFixed(1)}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-gray-900 border border-gray-800">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Timeliness</p>
                                        <p className="text-lg font-bold text-emerald-300">{(profileData.timelinessRating ?? 0).toFixed(1)}</p>
                                    </div>
                                </div>
                                <p className="text-[11px] text-gray-500 text-center">
                                    Last active {formatLastActive(profileData.lastActiveAt)}
                                </p>
                            </div>

                            {/* Achievements Card */}
                            {(achievements.length > 0 || achievementsLoading) && (
                                <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-800/80 p-5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Achievements</h3>
                                        {achievementSummary && (
                                            <span className="text-[10px] text-emerald-400 font-semibold">
                                                {achievementSummary.completed}/{achievementSummary.total}
                                            </span>
                                        )}
                                    </div>

                                    {achievementSummary?.earningsTier && (
                                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${achievementSummary.earningsTier === 'platinum' ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' :
                                            achievementSummary.earningsTier === 'gold' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' :
                                                achievementSummary.earningsTier === 'silver' ? 'bg-gray-400/10 border-gray-400/30 text-gray-300' :
                                                    'bg-orange-500/10 border-orange-500/30 text-orange-300'
                                            }`}>
                                            <span className="text-lg">
                                                {achievementSummary.earningsTier === 'platinum' ? '💰' :
                                                    achievementSummary.earningsTier === 'gold' ? '🥇' :
                                                        achievementSummary.earningsTier === 'silver' ? '🥈' : '🥉'}
                                            </span>
                                            <span className="text-xs font-bold uppercase">{achievementSummary.earningsTier} Earner</span>
                                        </div>
                                    )}

                                    {achievementsLoading ? (
                                        <div className="flex justify-center py-4">
                                            <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {achievements.filter(a => a.isCompleted).slice(0, 8).map((achievement: any) => (
                                                <div
                                                    key={achievement._id}
                                                    className="group relative"
                                                    title={`${achievement.title}: ${achievement.description}`}
                                                >
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg border-2 ${achievement.tier === 'diamond' ? 'bg-cyan-500/20 border-cyan-500/50' :
                                                        achievement.tier === 'platinum' ? 'bg-purple-500/20 border-purple-500/50' :
                                                            achievement.tier === 'gold' ? 'bg-yellow-500/20 border-yellow-500/50' :
                                                                achievement.tier === 'silver' ? 'bg-gray-400/20 border-gray-400/50' :
                                                                    'bg-orange-500/20 border-orange-500/50'
                                                        }`}>
                                                        {achievement.icon || '🏆'}
                                                    </div>
                                                </div>
                                            ))}
                                            {achievements.filter(a => a.isCompleted).length > 8 && (
                                                <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-400 font-semibold">
                                                    +{achievements.filter(a => a.isCompleted).length - 8}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {achievementSummary && achievementSummary.completedProjects > 0 && (
                                        <div className="pt-2 border-t border-gray-800">
                                            <p className="text-[10px] text-gray-500">
                                                <span className="text-emerald-400 font-semibold">{achievementSummary.completedProjects}</span> projects completed
                                                {achievementSummary.totalEarnings > 0 && (
                                                    <span className="text-gray-600"> • </span>
                                                )}
                                                {achievementSummary.totalEarnings > 0 && (
                                                    <span className="text-emerald-400 font-semibold">₹{achievementSummary.totalEarnings.toLocaleString()}</span>
                                                )}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {isOwnProfile && (
                                <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-800/80 p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Mobile & Web Alerts</p>
                                            <p className="text-sm text-gray-300 font-bold">Push Notifications</p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pushStatus === 'enabled'
                                            ? 'bg-emerald-500/10 text-emerald-400'
                                            : pushStatus === 'unsupported'
                                                ? 'bg-gray-800 text-gray-500'
                                                : 'bg-amber-500/10 text-amber-300'}`}>
                                            {pushStatus === 'enabled' ? 'Enabled' : pushStatus === 'unsupported' ? 'Unsupported' : 'Disabled'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500">Stay updated with contract changes and bids even when you're offline.</p>
                                    {pushError && <p className="text-xs text-red-400">{pushError}</p>}
                                    <button
                                        disabled={pushLoading || pushStatus === 'unsupported'}
                                        onClick={pushStatus === 'enabled' ? handleDisablePush : handleEnablePush}
                                        className={`w-full text-sm font-semibold rounded-lg px-4 py-2 transition-all ${pushStatus === 'enabled'
                                            ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                                            : 'bg-emerald-500 text-gray-950 hover:bg-emerald-400'} ${pushLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        {pushLoading ? 'Please wait...' : pushStatus === 'enabled' ? 'Disable Notifications' : 'Enable Notifications'}
                                    </button>
                                </div>
                            )}

                            {/* Skills Card */}
                            <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-800/80 p-5">
                                <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-4">Skills</h3>
                                <div className="flex flex-wrap gap-2">
                                    {profileData.skills && profileData.skills.length > 0 ? (
                                        profileData.skills.map((skill: string, index: number) => (
                                            <span
                                                key={index}
                                                className="bg-gray-800/80 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-700/50 hover:border-emerald-500/30 hover:text-emerald-400 transition-colors cursor-default"
                                            >
                                                {skill}
                                            </span>
                                        ))
                                    ) : (
                                        <p className="text-gray-600 italic text-sm">No skills listed yet</p>
                                    )}
                                </div>
                            </div>

                            {/* Payment Info Card (public) */}
                            {isOwnProfile && (profileData.upiId || profileData.qrImage) && (
                                <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-800/80 p-5">
                                    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-4">Payment Details</h3>
                                    {profileData.upiId && (
                                        <div className="mb-3">
                                            <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">UPI ID</p>
                                            <p className="font-mono text-emerald-400 text-sm mt-1 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 inline-block">{profileData.upiId}</p>
                                        </div>
                                    )}
                                    {profileData.qrImage && (
                                        <div>
                                            <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider mb-2">QR Code</p>
                                            <img src={`${API_URL}${profileData.qrImage}`} alt="Payment QR" className="w-32 h-32 rounded-lg border border-gray-700 bg-white object-contain" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Main Content */}
                        <div className="md:col-span-2">
                            {isEditing ? (
                                <form onSubmit={handleUpdate} className="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-800/80 p-6 space-y-5">
                                    <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                                        <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </div>
                                        <h2 className="text-lg font-bold text-white">Edit Profile</h2>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Display Name</label>
                                            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Hourly Rate ({RUPEE_SYMBOL})</label>
                                            <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="input-field" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Experience</label>
                                            <input type="text" value={experience} onChange={(e) => setExperience(e.target.value)} className="input-field" placeholder="e.g. 3 years, Senior, Entry-level" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Bio</label>
                                        <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="input-field h-32 resize-none" placeholder="Tell clients about yourself..." />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Skills (comma separated)</label>
                                        <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)} className="input-field" placeholder="React, Node.js, Design" />
                                    </div>

                                    {/* Payment & Verification Section */}
                                    <div className="border-t border-gray-800 pt-5 mt-2">
                                        <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">Payment & Verification</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">UPI ID</label>
                                                <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)} className="input-field" placeholder="yourname@upi" />
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Phone Number</label>
                                                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" placeholder="+91 9876543210" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            {!profileData.isAadhaarVerified && (
                                                <div>
                                                    <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Aadhaar (Last 4 Digits)</label>
                                                    <input type="text" value={aadhaarLast4} onChange={(e) => setAadhaarLast4(e.target.value.slice(0, 4))} className="input-field" placeholder="XXXX" maxLength={4} />
                                                </div>
                                            )}
                                            {profileData.isAadhaarVerified && (
                                                <div className="flex items-center">
                                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2 flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        <span className="text-emerald-400 text-sm font-medium">Aadhaar Verified</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div>
                                                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">QR Code Image</label>
                                                <input
                                                    type="file"
                                                    ref={qrInputRef}
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={async (e) => {
                                                        if (!e.target.files?.[0] || !user) return;
                                                        setUploadingQr(true);
                                                        try {
                                                            const formData = new FormData();
                                                            formData.append('qr', e.target.files[0]);
                                                            const res = await fetch(`${API_URL}/api/auth/upload-qr`, {
                                                                method: 'POST',
                                                                headers: { 'Authorization': `Bearer ${user.token}` },
                                                                body: formData,
                                                            });
                                                            const payload = await res.json().catch(() => ({}));
                                                            if (res.ok) {
                                                                await fetchProfile();
                                                                toast.success('QR uploaded successfully.');
                                                            } else {
                                                                toast.error(payload?.message || 'QR upload failed');
                                                            }
                                                        } catch (err) {
                                                            console.error('QR upload error:', err);
                                                            toast.error('QR upload failed. Please try again.');
                                                        } finally {
                                                            setUploadingQr(false);
                                                            if (qrInputRef.current) qrInputRef.current.value = '';
                                                        }
                                                    }}
                                                />
                                                <button type="button" onClick={() => qrInputRef.current?.click()} disabled={uploadingQr} className="btn-secondary text-xs w-full">
                                                    {uploadingQr ? 'Uploading...' : profileData.qrImage ? 'Change QR' : 'Upload QR'}
                                                </button>
                                                {profileData.qrImage && (
                                                    <img src={`${API_URL}${profileData.qrImage}`} alt="QR" className="w-20 h-20 mt-2 rounded-lg border border-gray-700 bg-white object-contain" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                                        <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary">Cancel</button>
                                        <button type="submit" className="btn-primary flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                            Save Changes
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-4">
                                    {/* About */}
                                    <div className="bg-gray-900/60 backdrop-blur-sm rounded-2xl border border-gray-800/80 p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-1 h-5 bg-gradient-to-b from-emerald-400 to-cyan-400 rounded-full" />
                                            <h2 className="text-base font-bold text-white tracking-tight">About</h2>
                                        </div>
                                        <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">
                                            {profileData.bio || <span className="italic text-gray-600">No bio provided yet. {isOwnProfile && 'Click "Edit Profile" to add one.'}</span>}
                                        </p>
                                    </div>

                                    {/* Portfolio Section */}
                                    <div className="bg-gray-900/60 backdrop-blur-sm rounded-2xl border border-gray-800/80 p-6">
                                        <div className="flex items-center justify-between mb-5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1 h-5 bg-gradient-to-b from-violet-400 to-purple-500 rounded-full" />
                                                <h2 className="text-base font-bold text-white tracking-tight">Portfolio</h2>
                                                {portfolioItems.length > 0 && (
                                                    <span className="text-[10px] text-gray-500 font-semibold bg-gray-800 px-2 py-0.5 rounded-full">{portfolioItems.length}</span>
                                                )}
                                            </div>
                                            {isOwnProfile && (
                                                <button
                                                    onClick={() => setIsPortfolioModalOpen(true)}
                                                    className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-all hover:bg-emerald-500/20"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                                    </svg>
                                                    Add Work
                                                </button>
                                            )}
                                        </div>
                                        {heroPortfolioItem?.images?.[0] && (
                                            <div
                                                className="mb-5 overflow-hidden rounded-2xl border border-gray-800/80 bg-gray-800/40 shadow-inner cursor-pointer"
                                                onClick={() => { setSelectedPortfolioItem(heroPortfolioItem); setIsPortfolioViewerOpen(true); }}
                                            >
                                                <div className="relative aspect-video">
                                                    <img src={`${API_URL}${heroPortfolioItem.images[0]}`} alt={heroPortfolioItem.title} className="h-full w-full object-cover" loading="lazy" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex items-end justify-between p-4">
                                                        <div>
                                                            <p className="text-white font-semibold text-sm">{heroPortfolioItem.title}</p>
                                                            {heroPortfolioItem.tags && Array.isArray(heroPortfolioItem.tags) && (
                                                                <p className="text-[11px] text-gray-400 mt-1">{heroPortfolioItem.tags.slice(0, 3).join(' • ')}</p>
                                                            )}
                                                        </div>
                                                        <span className="text-xs font-semibold text-emerald-300">View →</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {(heroPortfolioItem || displayedPortfolioGrid.length > 0) ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {displayedPortfolioGrid.map((item: any, index: number) => (
                                                    <div
                                                        key={`${item._id}-${index}`}
                                                        onClick={() => { setSelectedPortfolioItem(item); setIsPortfolioViewerOpen(true); }}
                                                        className="relative aspect-video bg-gray-800 rounded-xl overflow-hidden cursor-pointer border border-gray-700/60 hover:border-emerald-500/50 transition-all group shadow-md"
                                                    >
                                                        {item.images && item.images[0] ? (
                                                            <img src={`${API_URL}${item.images[0]}`} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                                                                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                                                            <p className="text-white text-xs font-semibold truncate">{item.title}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center py-10 text-center">
                                                <div className="w-14 h-14 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-3">
                                                    <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                                <p className="text-gray-500 text-sm font-medium">No portfolio items yet</p>
                                                {isOwnProfile && <p className="text-gray-600 text-xs mt-1">Add your best projects to stand out</p>}
                                            </div>
                                        )}
                                    </div>



                                    {/* Work History & Reviews */}
                                    {reviews.length > 0 && (
                                        <div className="bg-gray-900/60 backdrop-blur-sm rounded-2xl border border-gray-800/80 p-6">
                                            <div className="flex items-center justify-between mb-5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1 h-5 bg-gradient-to-b from-amber-400 to-yellow-500 rounded-full" />
                                                    <h2 className="text-base font-bold text-white tracking-tight">Reviews</h2>
                                                    <span className="text-[10px] text-gray-500 font-semibold bg-gray-800 px-2 py-0.5 rounded-full">{reviews.length}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                                    </svg>
                                                    <span className="text-amber-400 font-bold text-sm">
                                                        {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}
                                                    </span>
                                                    <span className="text-gray-500 text-xs">avg</span>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                {reviews.map((review) => (
                                                    <div key={review._id} className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-4 hover:border-gray-600/50 transition-colors">
                                                        <div className="flex items-start justify-between gap-3 mb-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-gray-950 font-bold text-xs shrink-0">
                                                                    {review.reviewerName?.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <p className="text-white font-semibold text-sm">{review.reviewerName}</p>
                                                                    <p className="text-gray-500 text-xs">{new Date(review.createdAt).toLocaleDateString()}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-0.5 shrink-0">
                                                                {[1, 2, 3, 4, 5].map((star) => (
                                                                    <svg key={star} className={`w-3.5 h-3.5 ${star <= review.rating ? 'text-amber-400' : 'text-gray-700'}`} fill="currentColor" viewBox="0 0 24 24">
                                                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                                                    </svg>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <p className="text-gray-500 text-xs font-medium mb-2 truncate">📁 {review.projectTitle}</p>
                                                        {review.comment && (
                                                            <p className="text-gray-300 text-sm leading-relaxed">"{review.comment}"</p>
                                                        )}
                                                        {review.amount > 0 && (
                                                            <p className="text-emerald-400/60 text-xs font-semibold mt-2">{RUPEE_SYMBOL}{review.amount} project</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Report Modal */}
            {profileData && (
                <ReportModal
                    isOpen={isReportModalOpen}
                    onClose={() => setIsReportModalOpen(false)}
                    reportedId={profileData._id}
                    reportedType="user"
                />
            )}

            {/* Verification Modal */}
            <VerificationModal
                isOpen={isVerificationModalOpen}
                onClose={() => {
                    setIsVerificationModalOpen(false);
                    fetchProfile();
                    fetchVerificationStatus();
                }}
            />

            {/* Portfolio Modal */}
            <PortfolioModal
                isOpen={isPortfolioModalOpen}
                onClose={() => {
                    setIsPortfolioModalOpen(false);
                    fetchPortfolio();
                }}
            />

            {/* Portfolio Viewer */}
            <PortfolioViewer
                isOpen={isPortfolioViewerOpen}
                onClose={() => {
                    setIsPortfolioViewerOpen(false);
                    setSelectedPortfolioItem(null);
                }}
                item={selectedPortfolioItem}
            />
        </div>
    );
};
