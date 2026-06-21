import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import { API_BASE } from '../config';
import { FeedbackModal } from './FeedbackModal';
import { Bell, Settings } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface NotificationNode {
    _id: string;
    type: 'success' | 'info' | 'warning';
    title: string;
    message: string;
    link?: string;
    read: boolean;
    createdAt: string;
}

export const Navbar = () => {
    const { user, logout } = useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate();
    const location = useLocation();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationNode[]>([]);
    const [unreadMsgCount, setUnreadMsgCount] = useState(0);
    const panelRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);
    const notifMobileRef = useRef<HTMLDivElement>(null);

    const handleLogout = () => {
        logout();
        setSettingsOpen(false);
        setMobileMenuOpen(false);
        navigate('/');
    };

    // Close panels on route change
    useEffect(() => {
        setSettingsOpen(false);
        setNotificationsOpen(false);
        setMobileMenuOpen(false);
        setFeedbackOpen(false);
    }, [location.pathname]);

    // Listen for real-time notifications - Stable Listener
    useEffect(() => {
        if (socket) {
            const handleNewNotification = (notification: NotificationNode) => {
                setNotifications(prev => [notification, ...prev]);
            };
            socket.on('new_notification', handleNewNotification);
            return () => { socket.off('new_notification', handleNewNotification); };
        }
    }, [socket]);

    // Call handling moved to global CallContext

    // Fetch notifications
    useEffect(() => {
        if (user?.token) {
            fetch(`${API_BASE}/notifications`, {
                headers: { Authorization: `Bearer ${user.token}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setNotifications(data);
                })
                .catch(console.error);
        }
    }, [user?._id, user?.token]);

    const fetchUnreadCount = useCallback(async () => {
        if (!user?.token) return;
        try {
            const res = await fetch(`${API_BASE}/messages/unread-count`, {
                headers: { Authorization: `Bearer ${user.token}` },
                cache: 'no-store'
            });
            if (res.ok) {
                const data = await res.json();
                setUnreadMsgCount(Number(data?.count || 0));
            }
        } catch (err) { }
    }, [user?.token]);

    // Fetch unread message count and keep it synced when route/message events change.
    useEffect(() => {
        if (!user?.token) return;
        fetchUnreadCount();

        const intervalId = window.setInterval(fetchUnreadCount, 20000);

        if (socket) {
            socket.on('receive_message', fetchUnreadCount);
        }

        return () => {
            window.clearInterval(intervalId);
            if (socket) {
                socket.off('receive_message', fetchUnreadCount);
            }
        };
    }, [user?.token, socket, location.pathname, fetchUnreadCount]);

    const markAsRead = async (id: string, link?: string) => {
        try {
            await fetch(`${API_BASE}/notifications/${id}/read`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
            if (link) {
                setNotificationsOpen(false);
                navigate(link);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await fetch(`${API_BASE}/notifications/read-all`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (error) {
            console.error(error);
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setSettingsOpen(false);
            }
            const outsideDesktopNotif = !notifRef.current || !notifRef.current.contains(e.target as Node);
            const outsideMobileNotif = !notifMobileRef.current || !notifMobileRef.current.contains(e.target as Node);
            if (outsideDesktopNotif && outsideMobileNotif) {
                setNotificationsOpen(false);
            }
        };
        if (settingsOpen || notificationsOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [settingsOpen, notificationsOpen]);

    // Close on Escape
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSettingsOpen(false);
                setMobileMenuOpen(false);
            }
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, []);

    return (
        <>
            <nav className="bg-gray-950/80 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        {/* Logo */}
                        <div className="flex items-center">
                            <Link to="/" className="flex items-center ml-1">
                                <BrandLogo size="md" />
                            </Link>
                        </div>

                        {/* Desktop Navigation - hidden on mobile */}
                        <div className="hidden md:flex items-center gap-1">
                            <Link to="/" className="text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-800/50">
                                Home
                            </Link>
                            {!user && (
                                <Link to="/learn" className="text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-800/50">
                                    Learn
                                </Link>
                            )}
                            <Link to="/projects" className="text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-800/50">
                                Browse Jobs
                            </Link>
                            <Link to="/gigs" className="text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-800/50">
                                Gigs
                            </Link>
                            {user ? (
                                <>
                                    <Link to="/my-projects" className="text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-800/50">
                                        My Projects
                                    </Link>

                                    {user.role === 'admin' && (
                                        <Link to="/admin" className="text-amber-400 hover:text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors hover:bg-amber-400/10 border border-amber-400/20">
                                            Admin Panel
                                        </Link>
                                    )}
                                    <Link to="/inbox" className="text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-800/50 flex items-center gap-2">
                                        Messages
                                        {unreadMsgCount > 0 && (
                                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-[0_0_8px_#ef4444]">
                                                {unreadMsgCount}
                                            </span>
                                        )}
                                    </Link>
                                    <div className="w-px h-6 bg-gray-800 mx-2"></div>
                                    {user.role === 'employer' && (
                                        <Link to="/post-project" className="btn-primary !py-2 !px-4 text-sm mr-2">
                                            Post Job
                                        </Link>
                                    )}
                                    {/* Credit Badge */}
                                    <Link
                                        to="/membership"
                                        title="Buy more credits"
                                        className="flex items-center gap-1.5 shrink-0 whitespace-nowrap bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                                    >
                                        <span>{Number((user as any).credits ?? 0)} credits</span>
                                    </Link>
                                    {/* Notification Bell */}
                                    <div className="relative" ref={notifRef}>
                                        <button
                                            aria-label="Notifications"
                                            onClick={() => setNotificationsOpen(!notificationsOpen)}
                                            className="relative p-2 text-gray-300 hover:text-white rounded-lg transition-colors hover:bg-gray-800/50"
                                        >
                                            <Bell size={20} />
                                            {unreadCount > 0 && (
                                                <span className="absolute top-1 right-1 flex h-3 w-3">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-gray-900"></span>
                                                </span>
                                            )}
                                        </button>

                                        {/* Notifications Dropdown */}
                                        {notificationsOpen && (
                                            <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl py-2 z-50">
                                                <div className="px-4 py-2 border-b border-gray-800 flex justify-between items-center">
                                                    <h3 className="text-white font-bold">Notifications</h3>
                                                    {unreadCount > 0 && (
                                                        <button onClick={markAllAsRead} className="text-xs text-indigo-400 hover:text-indigo-300">
                                                            Mark all read
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="max-h-96 overflow-y-auto">
                                                    {notifications.length === 0 ? (
                                                        <div className="px-4 py-8 text-center text-gray-500 text-sm">
                                                            No notifications yet.
                                                        </div>
                                                    ) : (
                                                        notifications.map(n => (
                                                            <div
                                                                key={n._id}
                                                                onClick={() => markAsRead(n._id, n.link)}
                                                                className={`px-4 py-3 border-b border-gray-800/50 cursor-pointer transition-colors hover:bg-gray-800/50 ${!n.read ? 'bg-indigo-500/5' : ''}`}
                                                            >
                                                                <div className="flex gap-3">
                                                                    <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${!n.read ? 'bg-indigo-400' : 'bg-transparent'}`} />
                                                                    <div>
                                                                        <p className={`text-sm ${!n.read ? 'font-bold text-white' : 'font-medium text-gray-300'}`}>{n.title}</p>
                                                                        <p className="text-xs text-gray-300 mt-0.5 line-clamp-2">{n.message}</p>
                                                                        <p className="text-[10px] text-gray-500 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Settings Button */}
                                    <button
                                        onClick={() => setSettingsOpen(!settingsOpen)}
                                        className="flex items-center gap-2 text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-800/50 ml-1"
                                    >
                                        <Settings size={18} />
                                        Settings
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to="/help" className="text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-800/50">
                                        Help
                                    </Link>
                                    <Link to="/login" className="text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-800/50">
                                        Log In
                                    </Link>
                                    <Link to="/register" className="btn-primary !py-2 !px-4 text-sm ml-2">
                                        Sign Up
                                    </Link>
                                </>
                            )}
                        </div>

                        {/* Mobile: Action buttons + Hamburger */}
                        <div className="flex md:hidden items-center gap-2">
                            {user && user.role === 'employer' && (
                                <Link to="/post-project" className="btn-primary !py-1.5 !px-3 text-xs">
                                    Post
                                </Link>
                            )}
                            {!user && (
                                <Link to="/login" className="btn-primary !py-1.5 !px-3 text-xs">
                                    Login
                                </Link>
                            )}
                            {user && (
                                <Link
                                    to="/membership"
                                    title="Buy more credits"
                                    className="flex items-center gap-1 shrink-0 whitespace-nowrap bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all"
                                >
                                    <span>{Number((user as any).credits ?? 0)} credits</span>
                                </Link>
                            )}
                            {user && (
                                <div className="relative" ref={notifMobileRef}>
                                    <button
                                        onClick={() => setNotificationsOpen(!notificationsOpen)}
                                        className="relative text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
                                        aria-label="Notifications"
                                    >
                                        <Bell size={19} />
                                        {unreadCount > 0 && (
                                            <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-gray-900"></span>
                                            </span>
                                        )}
                                    </button>
                                    {notificationsOpen && (
                                        <div className="fixed top-16 left-3 right-3 md:hidden bg-gray-900 border border-gray-800 rounded-xl shadow-2xl py-2 z-[80]">
                                            <div className="px-4 py-2 border-b border-gray-800 flex justify-between items-center">
                                                <h3 className="text-white font-bold">Notifications</h3>
                                                {unreadCount > 0 && (
                                                    <button onClick={markAllAsRead} className="text-xs text-indigo-400 hover:text-indigo-300">
                                                        Mark all read
                                                    </button>
                                                )}
                                            </div>
                                            <div className="max-h-[60vh] overflow-y-auto">
                                                {notifications.length === 0 ? (
                                                    <div className="px-4 py-8 text-center text-gray-500 text-sm">
                                                        No notifications yet.
                                                    </div>
                                                ) : (
                                                    notifications.map(n => (
                                                        <div
                                                            key={n._id}
                                                            onClick={() => markAsRead(n._id, n.link)}
                                                            className={`px-4 py-3 border-b border-gray-800/50 cursor-pointer transition-colors hover:bg-gray-800/50 ${!n.read ? 'bg-indigo-500/5' : ''}`}>
                                                            <div className="flex gap-3">
                                                                <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${!n.read ? 'bg-indigo-400' : 'bg-transparent'}`} />
                                                                <div>
                                                                    <p className={`text-sm ${!n.read ? 'font-bold text-white' : 'font-medium text-gray-300'}`}>{n.title}</p>
                                                                    <p className="text-xs text-gray-300 mt-0.5 line-clamp-2">{n.message}</p>
                                                                    <p className="text-[10px] text-gray-500 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <button
                                aria-label="Toggle menu"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
                            >
                                {mobileMenuOpen ? (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                ) : (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu Dropdown */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-gray-800 bg-gray-950/95 backdrop-blur-xl" style={{ animation: 'fadeIn 0.15s ease-out' }}>
                        <div className="px-4 py-3 space-y-1">
                            <Link to="/" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                Home
                            </Link>
                            {!user && (
                                <Link to="/learn" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                    Learn
                                </Link>
                            )}
                            <Link to="/projects" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                Browse Jobs
                            </Link>
                            <Link to="/gigs" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                Gigs
                            </Link>
                            {user ? (
                                <>
                                    <Link to="/my-projects" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                        My Projects
                                    </Link>
                                    <Link to="/gigs/my-gigs" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                        My Gigs
                                    </Link>
                                    {user.role === 'admin' && (
                                        <Link to="/admin" className="block px-3 py-2.5 rounded-lg text-amber-400 hover:text-white hover:bg-amber-400/10 text-sm font-bold transition-all border border-amber-400/20">
                                            Admin Panel
                                        </Link>
                                    )}
                                    <Link to="/inbox" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                        Messages
                                    </Link>

                                    <div className="my-2 border-t border-gray-800"></div>

                                    <Link to="/profile" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                        Profile
                                    </Link>
                                    <Link to="/membership" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                        Membership
                                    </Link>
                                    <Link to="/referral" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                        Refer & Earn
                                    </Link>
                                    <Link to="/contract" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                        Payment
                                    </Link>
                                    <Link to="/learn" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                        Learn
                                    </Link>
                                    <Link to="/help" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                        Help
                                    </Link>
                                    <button
                                        onClick={() => setFeedbackOpen(true)}
                                        className="w-full text-left block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all"
                                    >
                                        Help Us Improve
                                    </button>
                                    <Link to="/about" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                        About Us
                                    </Link>
                                    <Link to="/terms" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                        Terms & Conditions
                                    </Link>

                                    <div className="my-2 border-t border-gray-800"></div>

                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-3 py-2.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 text-sm font-medium transition-all"
                                    >
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to="/help" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                        Help
                                    </Link>
                                    <Link to="/about" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                        About Us
                                    </Link>
                                    <div className="my-2 border-t border-gray-800"></div>
                                    <Link to="/login" className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 text-sm font-medium transition-all">
                                        Log In
                                    </Link>
                                    <Link to="/register" className="block px-3 py-2.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 text-sm font-bold transition-all">
                                        Sign Up
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </nav>

            {/* Settings Slide-out Panel (Desktop) */}
            {settingsOpen && (
                <div className="fixed inset-0 z-[60]">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        style={{ animation: 'fadeIn 0.2s ease-out' }}
                    />

                    {/* Panel */}
                    <div
                        ref={panelRef}
                        className="absolute top-0 right-0 h-full w-72 bg-gray-900 border-l border-gray-800 shadow-2xl"
                        style={{ animation: 'slideInRight 0.25s ease-out' }}
                    >
                        {/* Panel Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                            <h2 className="text-lg font-bold text-white">Settings</h2>
                            <button
                                aria-label="Close settings"
                                onClick={() => setSettingsOpen(false)}
                                className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* User Info */}
                        {user && (
                            <div className="px-5 py-4 border-b border-gray-800">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 font-bold text-lg">
                                        {user.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-white font-semibold text-sm">{user.name}</p>
                                        <p className="text-gray-500 text-xs">{user.email}</p>
                                    </div>
                                </div>
                                <Link
                                    to="/membership"
                                    className="flex items-center justify-between bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl px-3 py-2.5 transition-all group"
                                >
                                    <div className="flex items-center gap-2">
                                        <div>
                                            <p className="text-emerald-400 font-bold text-sm">{(user as any).credits ?? 0} Credits</p>
                                            <p className="text-gray-500 text-[11px]">Tap to buy more</p>
                                        </div>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-600 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </Link>
                            </div>
                        )}

                        {/* Menu Items */}
                        <div className="px-3 py-3 space-y-1">
                            <Link to="/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-all text-sm font-medium group">
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Profile
                            </Link>
                            <Link to="/membership" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-all text-sm font-medium group">
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                                <strong>Membership</strong>
                            </Link>
                            <Link to="/referral" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-all text-sm font-medium group">
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Refer & Earn
                            </Link>
                            <Link to="/contract" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-all text-sm font-medium group">
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Payment
                            </Link>
                            <Link to="/gigs/my-gigs" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-all text-sm font-medium group">
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                My Gigs
                            </Link>
                            <Link to="/learn" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-all text-sm font-medium group">
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                Learn
                            </Link>
                            <Link to="/help" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-all text-sm font-medium group">
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Help
                            </Link>
                            <button
                                onClick={() => setFeedbackOpen(true)}
                                className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-all text-sm font-medium group"
                            >
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" />
                                </svg>
                                Help Us Improve
                            </button>
                            <Link to="/about" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-all text-sm font-medium group">
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                About Us
                            </Link>
                            <Link to="/terms" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-all text-sm font-medium group">
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-amber-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Terms & Conditions
                            </Link>

                            <div className="my-2 border-t border-gray-800"></div>

                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all text-sm font-medium group w-full"
                            >
                                <svg className="w-5 h-5 text-red-500/60 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
            <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} token={user?.token} />
        </>
    );
};
