import { useState, useEffect } from 'react';
import { BrandLogo } from '../components/BrandLogo';

interface MaintenanceData {
    maintenanceMode: boolean;
    endTime: number | null;
    whatsappLink: string;
    instagramLink: string;
}

const SUPPORT_EMAIL = 'support@hirework.in';

// Hardcoded WhatsApp and Instagram links - do not change
const WHATSAPP_LINK = process.env.SUPPORT_WHATSAPP || 'https://wa.me/910000000000';
const INSTAGRAM_LINK = 'https://instagram.com/hirework.in';

export const MaintenancePage = () => {
    const [maintenanceData, setMaintenanceData] = useState<MaintenanceData>({
        maintenanceMode: true,
        endTime: null,
        whatsappLink: WHATSAPP_LINK,
        instagramLink: INSTAGRAM_LINK
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkMaintenanceMode = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const userData = await res.json();
                    if (userData.role === 'admin') {
                        setLoading(false);
                        return;
                    }
                }
            } catch (e) {
            }

            try {
                const res = await fetch('/api/settings/maintenance', {
                    headers: { 'Cache-Control': 'no-cache' }
                });
                if (res.ok) {
                    const data = await res.json();
                    setMaintenanceData({
                        maintenanceMode: data.maintenanceMode || true,
                        endTime: data.endTime || null,
                        whatsappLink: WHATSAPP_LINK,
                        instagramLink: INSTAGRAM_LINK
                    });
                }
            } catch (e) {
                console.error('Failed to fetch maintenance status:', e);
            } finally {
                setLoading(false);
            }
        };

        checkMaintenanceMode();
    }, []);

    const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        if (!maintenanceData.endTime) {
            setTimeLeft(null);
            return;
        }

        const calculateTimeLeft = () => {
            const now = Date.now();
            const endTimeMs = maintenanceData.endTime || 0;
            const diff = endTimeMs - now;

            if (diff <= 0) {
                setIsExpired(true);
                setTimeLeft(null);
                return;
            }

            setIsExpired(false);
            setTimeLeft({
                days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((diff % (1000 * 60)) / 1000)
            });
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(timer);
    }, [maintenanceData.endTime]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center overflow-hidden">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 w-20 h-20 border-4 border-cyan-500/30 border-b-cyan-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                </div>
            </div>
        );
    }

    const waLink = WHATSAPP_LINK;
    const igLink = INSTAGRAM_LINK;

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center overflow-hidden relative">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/20 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/15 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }}></div>
                <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[60px] animate-pulse" style={{ animationDelay: '3s' }}></div>
            </div>

            {/* Grid Pattern */}
            <div className="absolute inset-0" style={{
                backgroundImage: `
                    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
                `,
                backgroundSize: '50px 50px'
            }}></div>

            {/* Floating Particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-1 h-1 bg-emerald-400/50 rounded-full"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
                            animationDelay: `${Math.random() * 2}s`,
                            opacity: 0.3 + Math.random() * 0.5
                        }}
                    ></div>
                ))}
            </div>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
                    25% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
                    50% { transform: translateY(-10px) translateX(-10px); opacity: 0.4; }
                    75% { transform: translateY(-30px) translateX(5px); opacity: 0.5; }
                }
                @keyframes glow {
                    0%, 100% { filter: drop-shadow(0 0 20px rgba(16, 185, 129, 0.5)); }
                    50% { filter: drop-shadow(0 0 40px rgba(16, 185, 129, 0.8)); }
                }
                @keyframes bounce-gentle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
            `}</style>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center px-4 max-w-4xl mx-auto text-center">
                {/* Logo with Glow */}
                <div className="mb-6 flex items-center justify-center" style={{ animation: 'glow 3s ease-in-out infinite' }}>
                    <BrandLogo size="xl" />
                </div>

                {/* Status Badge - Fixed spacing */}
                <div className="mb-8">
                    <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        <span className="text-sm font-medium text-gray-300">Under Maintenance</span>
                    </div>
                </div>

                {/* Main Title */}
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 tracking-tight" style={{ textShadow: '0 0 60px rgba(16, 185, 129, 0.3)' }}>
                    We'll Be{' '}
                    <span className="relative inline-block">
                        <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                            Back Soon
                        </span>
                    </span>
                </h1>

                {/* Description */}
                <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                    We're performing some scheduled maintenance to bring you a better experience. 
                    We'll be back online shortly!
                </p>

                {/* Countdown Timer - Fixed for mobile single row */}
                {timeLeft && (
                    <div className="mb-10 w-full">
                        <div className="flex justify-center items-center gap-1 md:gap-2 lg:gap-3 flex-wrap">
                            <CountdownBox value={timeLeft.days} label="Days" />
                            <CountdownSeparator />
                            <CountdownBox value={timeLeft.hours} label="Hours" />
                            <CountdownSeparator />
                            <CountdownBox value={timeLeft.minutes} label="Mins" />
                            <CountdownSeparator />
                            <CountdownBox value={timeLeft.seconds} label="Secs" />
                        </div>
                    </div>
                )}

                {isExpired && !timeLeft && (
                    <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-2xl p-6 mb-8 inline-flex items-center gap-3 animate-[bounce-gentle_2s_ease-in-out_infinite]">
                        <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-emerald-400 font-semibold text-lg">We're Back Online!</span>
                    </div>
                )}

                {!timeLeft && !isExpired && (
                    <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 mb-8 inline-flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Estimated Time</div>
                            <div className="text-white font-semibold">We'll be back in a few minutes</div>
                        </div>
                    </div>
                )}

                {/* Social Links */}
                <div className="flex justify-center gap-4 mb-10">
                    <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative inline-flex items-center gap-2 px-6 py-3.5 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/50 rounded-xl text-gray-300 hover:text-white transition-all duration-300 hover:scale-105 hover:-translate-y-1"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/10 group-hover:to-cyan-500/10 rounded-xl transition-all duration-300"></div>
                        <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        <span className="relative z-10">WhatsApp</span>
                    </a>
                    <a
                        href={igLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative inline-flex items-center gap-2 px-6 py-3.5 bg-white/5 hover:bg-pink-500/20 border border-white/10 hover:border-pink-500/50 rounded-xl text-gray-300 hover:text-white transition-all duration-300 hover:scale-105 hover:-translate-y-1"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-pink-500/0 to-pink-500/0 group-hover:from-pink-500/10 group-hover:to-purple-500/10 rounded-xl transition-all duration-300"></div>
                        <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                        </svg>
                        <span className="relative z-10">Instagram</span>
                    </a>
                </div>

                {/* Contact Support */}
                <div className="text-sm text-gray-500">
                    Need urgent assistance?{' '}
                    <a 
                        href={`mailto:${SUPPORT_EMAIL}`}
                        className="text-emerald-400 hover:text-emerald-300 transition-colors underline underline-offset-4 hover:underline decoration-emerald-500/50 hover:decoration-emerald-400"
                    >
                        Contact Support
                    </a>
                </div>
            </div>

            {/* Animated Gear Icon */}
            <div className="fixed bottom-8 right-8 opacity-20 z-0 hidden md:block">
                <div className="relative">
                    <div className="w-24 h-24 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin" style={{ animationDuration: '8s' }}></div>
                    <div className="absolute inset-2 w-20 h-20 border-4 border-cyan-500 rounded-full border-b-transparent animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}></div>
                    <div className="absolute inset-4 w-16 h-16 border-4 border-emerald-500/50 rounded-full border-l-transparent animate-spin" style={{ animationDuration: '4s' }}></div>
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-4 text-xs text-gray-600">
                © {new Date().getFullYear()} HIREWORK. All rights reserved.
            </div>
        </div>
    );
};

// Countdown Box Component - Responsive
function CountdownBox({ value, label }: { value: number; label: string }) {
    return (
        <div className="group relative flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <div className="relative bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-4 md:px-5 md:py-5 min-w-[60px] md:min-w-[80px] lg:min-w-[90px] hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1">
                <div className="text-2xl md:text-4xl lg:text-5xl font-bold text-white tabular-nums">
                    {String(value).padStart(2, '0')}
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-widest mt-1 font-medium">{label}</div>
            </div>
        </div>
    );
}

// Countdown Separator Component
function CountdownSeparator() {
    return (
        <span className="text-2xl md:text-4xl lg:text-5xl text-emerald-500 font-bold self-start mt-3 md:mt-4 lg:mt-5">:</span>
    );
}
