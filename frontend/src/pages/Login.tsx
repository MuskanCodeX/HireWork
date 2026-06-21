import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { API_BASE } from '../config';

export const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleQuickLogin = (demoEmail: string, demoPass: string) => {
        setEmail(demoEmail);
        setPassword(demoPass);
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
            });
            const data = await response.json();
            if (response.ok) {
                login(data);
                navigate('/');
            } else {
                setError(data.message || 'Invalid credentials');
            }
        } catch (error) {
            console.error('Login error:', error);
            setError('Something went wrong. Please check your network and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center relative overflow-hidden py-8">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>

            <div className="w-full max-w-md p-4 relative z-10">
                <div className="card p-8 md:p-10">
                    <div className="text-center mb-6">
                        <div className="flex items-center justify-center mb-6">
                            <BrandLogo size="lg" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
                        <p className="text-gray-500 text-sm">Sign in to your HIREWORK account</p>
                    </div>

                    {/* Quick Demo Accounts */}
                    <div className="mb-6 p-3.5 bg-gray-900/90 border border-gray-800 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                Quick Sample Logins
                            </span>
                            <span className="text-[10px] text-gray-500">1-click fill</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => handleQuickLogin('client@hirework.com', 'Password@123')}
                                className="py-2 px-2 bg-gray-800/80 hover:bg-emerald-500/20 hover:border-emerald-500/50 border border-gray-700/60 rounded-lg text-xs font-medium text-emerald-300 transition-all text-center flex flex-col items-center gap-0.5"
                            >
                                <span className="text-sm">💼</span>
                                <span>Client</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleQuickLogin('freelancer@hirework.com', 'Password@123')}
                                className="py-2 px-2 bg-gray-800/80 hover:bg-cyan-500/20 hover:border-cyan-500/50 border border-gray-700/60 rounded-lg text-xs font-medium text-cyan-300 transition-all text-center flex flex-col items-center gap-0.5"
                            >
                                <span className="text-sm">⚡</span>
                                <span>Freelancer</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleQuickLogin('admin@hirework.com', 'Password@123')}
                                className="py-2 px-2 bg-gray-800/80 hover:bg-purple-500/20 hover:border-purple-500/50 border border-gray-700/60 rounded-lg text-xs font-medium text-purple-300 transition-all text-center flex flex-col items-center gap-0.5"
                            >
                                <span className="text-sm">🛡️</span>
                                <span>Admin</span>
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-gray-400 text-sm font-medium mb-2">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-field"
                                required
                                placeholder="you@example.com"
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-gray-400 text-sm font-medium">Password</label>
                                <Link to="/forgot-password" className="text-emerald-400 text-xs hover:text-emerald-300 transition-colors font-semibold">Forgot Password?</Link>
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-field"
                                required
                                placeholder="••••••••"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-3 mt-2 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : null}
                            <span>{loading ? 'Signing In...' : 'Sign In'}</span>
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-500">
                        New to HIREWORK?{' '}
                        <Link to="/register" className="text-emerald-400 font-semibold hover:text-emerald-300 transition-colors">Create Account</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
