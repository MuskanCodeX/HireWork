import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BrandLogo } from '../components/BrandLogo';
import { API_BASE } from '../config';

export const Register = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'freelancer' | 'employer'>('freelancer');
    const [phone, setPhone] = useState('');
    const [agreedTerms, setAgreedTerms] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [searchParams] = useSearchParams();
    const referralCode = searchParams.get('ref') || '';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!agreedTerms) { setError('Please agree to the Terms & Conditions'); return; }
        try {
            const payload: Record<string, string> = { name, email, password, role, phone };
            if (referralCode) payload.referredBy = referralCode;

            const response = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, otp }),
            });
            const data = await response.json();
            if (response.ok) {
                login(data);
                navigate('/');
            } else {
                setError(data.message);
            }
        } catch (error) {
            console.error('Registration error:', error);
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendOTP = async () => {
        if (!email) { setError('Please enter your email first'); return; }
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.toLowerCase(), type: 'registration' }),
            });
            const data = await res.json();
            console.log('[OTP Debug] Response:', res.status, data);
            if (res.ok) {
                setOtpSent(true);
                toast.success('OTP sent! Please check your email.');
            } else {
                setError(data.message || 'Failed to send OTP');
            }
        } catch (err) {
            console.error('[OTP Debug] Error:', err);
            setError('Failed to send OTP. Check your internet connection.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center relative overflow-hidden py-12">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>

            <div className="w-full max-w-md p-4 relative z-10">
                <div className="card p-8 md:p-10">
                    <div className="text-center mb-8">
                        <div className="flex items-center justify-center mb-6">
                            <BrandLogo size="lg" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-1">Create Account</h2>
                        <p className="text-gray-500 text-sm">Join the HIREWORK community</p>
                    </div>

                    {referralCode && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Referral code <strong>{referralCode}</strong> applied!
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {!otpSent ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-gray-400 text-sm font-medium mb-2">Full Name</label>
                                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" required placeholder="John Doe" />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm font-medium mb-2">Email</label>
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" required placeholder="you@example.com" />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm font-medium mb-2">Password</label>
                                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" required placeholder="••••••••" />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm font-medium mb-3">I want to:</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className={`cursor-pointer border-2 rounded-xl p-4 text-center transition-all ${role === 'freelancer' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-gray-700 hover:border-gray-600 text-gray-400'}`}>
                                            <input type="radio" value="freelancer" checked={role === 'freelancer'} onChange={() => setRole('freelancer')} className="hidden" />
                                            <div className="font-bold text-sm">Find Work</div>
                                            <div className="text-xs mt-1 opacity-60">I'm a freelancer</div>
                                        </label>
                                        <label className={`cursor-pointer border-2 rounded-xl p-4 text-center transition-all ${role === 'employer' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-gray-700 hover:border-gray-600 text-gray-400'}`}>
                                            <input type="radio" value="employer" checked={role === 'employer'} onChange={() => setRole('employer')} className="hidden" />
                                            <div className="font-bold text-sm">Hire Talent</div>
                                            <div className="text-xs mt-1 opacity-60">I'm an employer</div>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm font-medium mb-2">Phone Number (optional)</label>
                                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" placeholder="+91 9876543210" />
                                </div>
                                <label className="flex items-start gap-2 cursor-pointer mt-2">
                                    <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="mt-1 accent-emerald-500" />
                                    <span className="text-gray-400 text-xs leading-relaxed">
                                        I agree to the <Link to="/terms" className="text-emerald-400 underline">Terms &amp; Conditions</Link>. I understand that payments are made directly between clients and freelancers.
                                    </span>
                                </label>
                                <button type="button" onClick={handleSendOTP} disabled={!agreedTerms || loading} className="btn-primary w-full py-3 mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {loading ? 'Sending OTP...' : 'Send Verification OTP'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl text-center text-sm">
                                    OTP sent to <strong>{email}</strong>
                                    <p className="text-xs mt-1 text-emerald-500/70">If not received, please check your <strong>spam folder</strong>.</p>
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm font-medium mb-2 text-center">Enter 6-digit OTP</label>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                        className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl py-4 text-center text-3xl font-bold tracking-[8px] text-emerald-400 focus:border-emerald-500 focus:outline-none transition-all"
                                        placeholder="000000"
                                        required
                                    />
                                </div>
                                <button type="submit" disabled={loading || otp.length < 6} className="btn-primary w-full py-4 text-lg font-bold disabled:opacity-50 shadow-lg shadow-emerald-500/20">
                                    {loading ? 'Verifying...' : 'Complete Registration'}
                                </button>
                                <button type="button" onClick={() => setOtpSent(false)} className="w-full text-gray-500 text-sm hover:text-white transition-colors">
                                    Wrong email? Go back
                                </button>
                            </div>
                        )}
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-500">
                        Already have an account?{' '}
                        <Link to="/login" className="text-emerald-400 font-semibold hover:text-emerald-300 transition-colors">Sign In</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
