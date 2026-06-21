import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { SEO } from '../components/SEO';

export const About = () => {
    const { user } = useAuth();
    const [statsVisible, setStatsVisible] = useState(false);
    const statsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setStatsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 }
        );
        if (statsRef.current) observer.observe(statsRef.current);
        return () => observer.disconnect();
    }, []);

    const AnimatedCounter = ({ end, duration = 2000 }: { end: number; duration?: number }) => {
        const [count, setCount] = useState(0);
        useEffect(() => {
            if (!statsVisible) return;
            let startTime: number | null = null;
            const step = (ts: number) => {
                if (!startTime) startTime = ts;
                const progress = Math.min((ts - startTime) / duration, 1);
                setCount(Math.floor(progress * end));
                if (progress < 1) window.requestAnimationFrame(step);
            };
            window.requestAnimationFrame(step);
        }, [statsVisible, end, duration]);
        return <span>{count.toLocaleString()}</span>;
    };

    const founders = [
        {
            name: 'Aman Varma',
            role: 'Founder & Product Lead',
            bio: 'Product engineer passionate about creating fair, accessible, and milestone-protected remote work opportunities for modern Indian freelancers.',
            emoji: '🚀',
            gradient: 'from-emerald-500 to-teal-500',
        },
        {
            name: 'Tech Team',
            role: 'Engineering & Product',
            bio: 'A passionate team of engineers and designers dedicated to building the most seamless freelancing experience for Indian professionals.',
            emoji: '⚙️',
            gradient: 'from-cyan-500 to-blue-500',
        },
        {
            name: 'Community',
            role: 'Growth & Operations',
            bio: 'Our growth team works tirelessly with freelancers and employers across India to build a thriving, trustworthy ecosystem.',
            emoji: '🌱',
            gradient: 'from-violet-500 to-purple-500',
        },
    ];

    const timeline = [
        { year: '2026', title: 'Founded', desc: 'HIREWORK was launched with a clear mission: give every Indian freelancer a world-class platform with free bidding, free job posting, and zero signup fees.' },
        { year: '2026 Q2', title: 'Beta Launch', desc: 'Launched the beta platform, onboarded the first 500 freelancers and employers, and successfully completed 100+ projects.' },
        { year: '2026 Q3', title: 'Scaling Up', desc: 'Crossed 1,100+ active freelancers, introduced AI-powered matching, real-time video calling, and tiered membership plans.' },
        { year: 'Future', title: 'Global Vision', desc: 'Expanding across South Asia and beyond — making HIREWORK the #1 freelancing platform for Indian talent to work globally.' },
    ];

    const faqs = [
        { q: 'What is HIREWORK?', a: 'HIREWORK is an India-based freelancing marketplace that connects skilled freelancers with employers looking for quality work. We offer secure contracts, real-time chat, video calls, and milestone-based payments.' },
        { q: 'Who can join HIREWORK?', a: 'Any skilled professional — developers, designers, writers, marketers, video editors, and more — can join as a freelancer. Businesses and individuals looking to hire can join as employers.' },
        { q: 'Is HIREWORK free to use?', a: 'Yes! Creating an account is completely free. Freelancers can browse and apply to jobs at no cost. We offer free and premium plans with different bid limits.' },
        { q: 'How are payments secured?', a: 'We use milestone-based escrow payments. Funds are held securely until the client approves the delivered work, protecting both freelancers and employers.' },
        { q: 'Is HIREWORK only for Indians?', a: 'While we are headquartered in India and primarily serve the Indian market, freelancers and employers from any country are welcome on our platform.' },
    ];

    return (
        <div className="min-h-screen bg-gray-950 overflow-x-hidden">
            <SEO
                title="About HIREWORK — India's Top Freelancing Platform | Our Story, Mission & Team"
                description="Learn about HIREWORK — India's fastest growing freelancing platform. Discover our founder's story, mission to democratize digital work, and how we connect 1,100+ freelancers with global clients."
            />

            <style>{`
                @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }
                @keyframes pulse-glow { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.1); } }
                @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .card-3d:hover { transform: translateY(-10px) rotateX(5deg); }
            `}</style>

            {/* ── HERO ── */}
            <div className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black" />
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[120px] mix-blend-screen animate-[pulse-glow_8s_ease-in-out_infinite]" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] mix-blend-screen animate-[pulse-glow_10s_ease-in-out_infinite_reverse]" />

                {/* Floating Particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(20)].map((_, i) => (
                        <div key={i} className="absolute w-1 h-1 bg-white/20 rounded-full"
                            style={{
                                left: `${(i * 37 + 5) % 95}%`, top: `${(i * 23 + 10) % 85}%`,
                                animation: `float ${3 + (i % 4)}s ease-in-out infinite`,
                                animationDelay: `${i * 0.3}s`, opacity: 0.2 + (i % 4) * 0.1
                            }} />
                    ))}
                </div>

                <div className="relative container mx-auto px-4 z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 animate-[fadeIn_1s_ease-out]">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-emerald-300 text-xs font-bold uppercase tracking-widest">India's #1 Freelancing Platform</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter leading-tight animate-[slideUp_1s_ease-out_0.2s_both]">
                        About <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 bg-[length:200%_auto] animate-[gradient_3s_linear_infinite]">HIREWORK</span>
                    </h1>

                    <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed mb-8 animate-[slideUp_1s_ease-out_0.4s_both]">
                        We are on a mission to democratize digital work — connecting India's top freelance talent with the world's best opportunities through a secure, transparent, and powerful platform.
                    </p>

                    <div className="flex flex-wrap gap-3 justify-center animate-[slideUp_1s_ease-out_0.6s_both]">
                        {['🇮🇳 Made in India', '🔒 Secure Payments', '🚀 AI-Powered Matching', '💬 Real-Time Collaboration'].map((tag, i) => (
                            <span key={i} className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-300 text-sm font-medium">{tag}</span>
                        ))}
                    </div>
                </div>

                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-50">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                </div>
            </div>

            {/* ── MISSION ── */}
            <section className="py-24 bg-gray-900/50 border-y border-white/5">
                <div className="container mx-auto px-4 max-w-5xl text-center">
                    <span className="text-emerald-400 font-bold tracking-widest uppercase text-xs mb-4 block">Our Mission</span>
                    <h2 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight">
                        Talent is universal — <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">opportunity should be too</span>
                    </h2>
                    <p className="text-gray-400 text-lg leading-relaxed max-w-3xl mx-auto">
                        HIREWORK was born from a simple observation: India has some of the world's most talented developers, designers, writers, and digital professionals — but they often lack access to quality platforms to showcase their work and earn fairly. We built HIREWORK to change that. Our platform empowers every Indian freelancer to compete on the global stage, with the tools and safeguards they deserve.
                    </p>
                </div>
            </section>

            {/* ── STATS ── */}
            <div ref={statsRef} className="relative py-24 bg-gray-950 border-b border-white/5">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        {[
                            { label: 'Active Freelancers', value: 1139, suffix: '+', color: 'emerald' },
                            { label: 'Projects Completed', value: 563, suffix: '+', color: 'cyan' },
                            { label: 'Total Paid Out', value: 480, prefix: '₹', suffix: 'K+', color: 'violet' },
                            { label: 'Satisfaction Rate', value: 96, suffix: '%', color: 'yellow' },
                        ].map((stat, i) => (
                            <div key={i}
                                className={`transform transition-all duration-1000 ${statsVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}
                                style={{ transitionDelay: `${i * 150}ms` }}>
                                <div className="text-5xl md:text-6xl font-black text-white mb-2">
                                    {stat.prefix}<AnimatedCounter end={stat.value} />{stat.suffix}
                                </div>
                                <p className={`text-${stat.color}-400 font-semibold text-sm uppercase tracking-widest flex items-center justify-center gap-1`}>
                                    <span className={`w-1.5 h-1.5 rounded-full bg-${stat.color}-400 inline-block`} />
                                    {stat.label}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── FOUNDER & TEAM ── */}
            <section className="py-24 bg-gray-900">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <span className="text-emerald-400 font-bold tracking-widest uppercase text-xs mb-3 block">The People Behind It</span>
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-4">Meet the Team</h2>
                        <p className="text-gray-400 max-w-xl mx-auto">Built by a small but passionate team of builders who believe the future of work is remote, fair, and distributed.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {founders.map((f, i) => (
                            <div key={i} className="group relative bg-gray-950 border border-gray-800 rounded-3xl p-8 hover:border-emerald-500/30 transition-all duration-500 hover:-translate-y-2">
                                <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-5 rounded-3xl transition-opacity duration-500`} />
                                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center text-3xl mb-6 shadow-lg`}>
                                    {f.emoji}
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1">{f.name}</h3>
                                <p className="text-emerald-400 text-sm font-semibold mb-4">{f.role}</p>
                                <p className="text-gray-400 leading-relaxed text-sm">{f.bio}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── OUR STORY TIMELINE ── */}
            <section className="py-24 bg-gray-950">
                <div className="container mx-auto px-4 max-w-4xl">
                    <div className="text-center mb-16">
                        <span className="text-cyan-400 font-bold tracking-widest uppercase text-xs mb-3 block">Our Journey</span>
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-4">The HIREWORK Story</h2>
                        <p className="text-gray-400 max-w-xl mx-auto">From a bold idea to India's fastest-growing freelance platform.</p>
                    </div>

                    <div className="relative border-l-2 border-emerald-500/20 pl-8 space-y-12 ml-4">
                        {timeline.map((item, i) => (
                            <div key={i} className="relative">
                                <div className="absolute -left-[2.85rem] top-1 w-5 h-5 rounded-full bg-emerald-500 border-4 border-gray-950 shadow-lg shadow-emerald-500/30" />
                                <span className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-1 block">{item.year}</span>
                                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── VALUES ── */}
            <section className="py-24 bg-gray-900 border-y border-white/5">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <span className="text-violet-400 font-bold tracking-widest uppercase text-xs mb-3 block">What We Stand For</span>
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-4">Our Core Values</h2>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        {[
                            { icon: '🛡️', title: 'Trust & Transparency', desc: 'Every payment, review, and contract is fully visible. No hidden fees, no surprises.', color: 'emerald' },
                            { icon: '🌍', title: 'Inclusive Opportunity', desc: 'Whether you are in Mumbai or Manipur, you deserve access to top-tier freelance work.', color: 'cyan' },
                            { icon: '⚡', title: 'Speed & Efficiency', desc: 'Our AI-powered matching connects you with the right people in minutes, not days.', color: 'yellow' },
                            { icon: '🤝', title: 'Community First', desc: 'Built by freelancers, for freelancers. Every product decision is guided by community feedback.', color: 'violet' },
                            { icon: '🔒', title: 'Payment Security', desc: 'Direct and transparent payments between freelancers and clients. Track every transaction with full visibility.', color: 'blue' },
                            { icon: '🚀', title: 'Constant Innovation', desc: 'From real-time video calls to AI smart pricing — we keep shipping features that matter.', color: 'pink' },
                        ].map((v, i) => (
                            <div key={i} className={`group p-6 rounded-2xl bg-gray-950 border border-gray-800 hover:border-${v.color}-500/30 transition-all duration-300 hover:-translate-y-1`}>
                                <div className="text-3xl mb-4">{v.icon}</div>
                                <h3 className="text-white font-bold text-lg mb-2 group-hover:text-emerald-400 transition-colors">{v.title}</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">{v.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── WHY HIREWORK ── */}
            <section className="py-24 bg-gray-950">
                <div className="container mx-auto px-4 max-w-5xl">
                    <div className="text-center mb-16">
                        <span className="text-emerald-400 font-bold tracking-widest uppercase text-xs mb-3 block">Why Choose Us</span>
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-4">Built Differently, for India</h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">We're not just another freelancing platform. HIREWORK is purpose-built for the unique needs of Indian professionals and businesses.</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8">
                        {[
                            { title: '🇮🇳 India-first Platform', desc: 'Rupee payments, Indian support team, and features built for how Indian professionals work.' },
                            { title: '🆓 Free to Bid & Post', desc: '100% free to post jobs and apply to projects. No listing fees, no bidding fees — ever.' },
                            { title: '🤖 AI Smart Pricing', desc: 'Our AI analyzes thousands of projects to suggest competitive, fair bid ranges for every job.' },
                            { title: '🎥 Built-in Video Calls', desc: 'No need for Zoom or Meet — collaborate face to face directly on the platform at no extra cost.' },
                            { title: '📋 Contract Management', desc: 'Milestone-based contracts with digital signing ensure every party is protected from start to finish.' },
                            { title: '⭐ Expert-tier Talent', desc: 'Freelancers are ranked by reputation — Expert and Pro tier professionals get prominent placement.' },
                        ].map((item, i) => (
                            <div key={i} className="flex gap-4 p-6 rounded-2xl bg-gray-900 border border-gray-800 hover:border-emerald-500/20 transition-all duration-300">
                                <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center text-xl">{item.title.split(' ')[0]}</div>
                                <div>
                                    <h3 className="text-white font-bold mb-1">{item.title.slice(item.title.indexOf(' ') + 1)}</h3>
                                    <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FAQ ── */}
            <section className="py-24 bg-gray-900 border-t border-white/5">
                <div className="container mx-auto px-4 max-w-3xl">
                    <div className="text-center mb-16">
                        <span className="text-yellow-400 font-bold tracking-widest uppercase text-xs mb-3 block">FAQs</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Frequently Asked Questions</h2>
                        <p className="text-gray-400">Everything you need to know about HIREWORK.</p>
                    </div>
                    <div className="space-y-4">
                        {faqs.map((faq, i) => (
                            <details key={i} className="group bg-gray-950 border border-gray-800 rounded-2xl p-6 cursor-pointer hover:border-emerald-500/30 transition-all duration-300">
                                <summary className="text-white font-semibold text-base list-none flex items-center justify-between gap-4">
                                    <span>{faq.q}</span>
                                    <span className="w-6 h-6 shrink-0 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-sm font-black group-open:rotate-45 transition-transform duration-300">+</span>
                                </summary>
                                <p className="text-gray-400 mt-4 leading-relaxed text-sm">{faq.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <div className="relative py-24 bg-black overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/20 to-cyan-900/20" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
                        {user ? 'Continue Building with Us' : 'Join the Movement'}
                    </h2>
                    <p className="text-xl text-gray-400 mb-10 max-w-xl mx-auto">
                        {user
                            ? 'Discover your next project or hire exceptional Indian talent today.'
                            : "Be part of India's most exciting freelancing platform. Free to join, built to grow."}
                    </p>
                    {user ? (
                        <Link to="/projects" className="px-10 py-4 bg-emerald-500 text-gray-950 font-bold text-lg rounded-full hover:bg-emerald-400 transition-all hover:scale-105 shadow-xl shadow-emerald-500/20 inline-block">
                            Browse Jobs
                        </Link>
                    ) : (
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link to="/register" className="px-10 py-4 bg-emerald-500 text-gray-950 font-bold text-lg rounded-full hover:bg-emerald-400 transition-all hover:scale-105 shadow-xl shadow-emerald-500/20 inline-block">
                                Get Started Free
                            </Link>
                            <Link to="/projects" className="px-10 py-4 bg-white/5 border border-white/10 text-white font-bold text-lg rounded-full hover:bg-white/10 transition-all hover:scale-105 inline-block">
                                Browse Projects
                            </Link>
                        </div>
                    )}
                    {!user && <p className="mt-5 text-sm text-gray-600">No credit card required · Free for freelancers · Join 1,100+ professionals</p>}
                </div>
            </div>
        </div>
    );
};
