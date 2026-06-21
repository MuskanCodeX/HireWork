import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config';
import { useAuth } from '../../hooks/useAuth';
import { Users, UserPlus, Briefcase, CheckCircle, AlertTriangle, Activity, Zap, Ban, Settings, Coins, TrendingUp, ShieldAlert, Clock3 } from 'lucide-react';

interface ActivityLog {
    _id: string;
    userName: string;
    action: string;
    details: string;
    createdAt: string;
}

interface TrendPoint {
    label: string;
    value: number;
}

const TrendChart: React.FC<{ data: TrendPoint[]; prefix?: string }> = ({ data, prefix = '' }) => {
    if (!data || data.length === 0) {
        return <p className="text-sm text-gray-500">Not enough data yet.</p>;
    }
    const maxValue = Math.max(...data.map((point) => point.value), 1);
    return (
        <div className="h-40 flex items-end gap-3">
            {data.map((point) => (
                <div key={point.label} className="flex-1 flex flex-col items-center gap-1">
                    <div
                        className="w-full rounded-t-xl bg-gradient-to-t from-emerald-500/30 via-cyan-400/40 to-white/10 shadow-[0_15px_35px_rgba(16,185,129,0.2)]"
                        style={{ height: `${Math.max(6, (point.value / maxValue) * 100)}%` }}
                    ></div>
                    <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">{point.label}</span>
                    <span className="text-xs font-bold text-gray-200">{prefix}{point.value.toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
};

const TrendPanel: React.FC<{ title: string; data: TrendPoint[]; prefix?: string }> = ({ title, data, prefix }) => (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
            <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-gray-500 font-semibold">Insights</p>
                <h3 className="text-xl font-bold text-white">{title}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <TrendingUp size={18} className="text-emerald-400" />
            </div>
        </div>
        <TrendChart data={data} prefix={prefix} />
    </div>
);

export const AdminDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalUsers: 0,
        newUsers: 0,
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        pendingReports: 0,
        pendingPortfolios: 0,
        advanced: {
            disputeCount: 0,
            activeFreelancers: 0,
            activeEmployers: 0,
            returningUsers: 0,
            revenueThisMonth: 0,
            grossRevenue: 0,
            avgCompletionDays: '0'
        },
        trends: {
            monthlyUsers: [] as TrendPoint[],
            monthlyRevenue: [] as TrendPoint[],
            monthlyProjects: [] as TrendPoint[]
        }
    });
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`${API_BASE}/admin/stats`, {
                    headers: { Authorization: `Bearer ${user?.token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (error) {
                console.error("Failed to fetch admin stats", error);
            } finally {
                setLoading(false);
            }
        };

        const fetchActivityLogs = async () => {
            try {
                const res = await fetch(`${API_BASE}/admin/activity`, {
                    headers: { Authorization: `Bearer ${user?.token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setActivityLogs(data);
                }
            } catch (error) {
                console.error("Failed to fetch activity logs", error);
            }
        };

        if (user?.token) {
            fetchStats();
            fetchActivityLogs();
        }
    }, [user?._id, user?.token]);

    const getActivityIcon = (action: string) => {
        if (action.includes('register')) return <UserPlus size={16} className="text-green-400" />;
        if (action.includes('project')) return <Briefcase size={16} className="text-indigo-400" />;
        if (action.includes('contract')) return <CheckCircle size={16} className="text-emerald-400" />;
        if (action.includes('ban') || action.includes('delete')) return <Ban size={16} className="text-red-400" />;
        if (action.includes('setting')) return <Settings size={16} className="text-gray-400" />;
        return <Zap size={16} className="text-amber-400" />;
    };

    const cards = [
        { title: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        { title: 'New Users Today', value: stats.newUsers, icon: UserPlus, color: 'text-green-400', bg: 'bg-green-400/10' },
        { title: 'Total Projects', value: stats.totalProjects, icon: Briefcase, color: 'text-purple-400', bg: 'bg-purple-400/10' },
        { title: 'Active Jobs', value: stats.activeProjects, icon: Activity, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
        { title: 'Completed Projects', value: stats.completedProjects, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
        { title: 'Pending Reports', value: stats.pendingReports, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10' },
        { title: 'Pending Portfolios', value: stats.pendingPortfolios || 0, icon: Briefcase, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    ];

    const advancedCards = [
        { title: 'Open Disputes', value: stats.advanced?.disputeCount ?? 0, icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10' },
        { title: 'Active Freelancers (30d)', value: stats.advanced?.activeFreelancers ?? 0, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { title: 'Active Employers (30d)', value: stats.advanced?.activeEmployers ?? 0, icon: Briefcase, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { title: 'Returning Users', value: stats.advanced?.returningUsers ?? 0, icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        { title: 'Revenue This Month', value: stats.advanced?.revenueThisMonth ?? 0, icon: Coins, color: 'text-yellow-400', bg: 'bg-yellow-500/10', prefix: '₹' },
        { title: 'Avg Completion (days)', value: Number(stats.advanced?.avgCompletionDays ?? 0), icon: Clock3, color: 'text-gray-300', bg: 'bg-white/5', suffix: 'd' }
    ];

    if (loading) {
        return <div className="animate-pulse flex space-x-4"><div className="flex-1 space-y-4 py-1"><div className="h-4 bg-gray-800 rounded w-3/4"></div></div></div>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-8">
                Platform Overview
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                {cards.map((card, index) => {
                    const Icon = card.icon;
                    return (
                        <div key={index} className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Icon size={100} className={card.color} />
                            </div>
                            <div className={`p-3 rounded-lg ${card.bg} w-fit mb-4`}>
                                <Icon size={24} className={card.color} />
                            </div>
                            <div>
                                <h3 className="text-gray-400 font-medium text-sm">{card.title}</h3>
                                <div className="text-4xl font-bold text-white mt-1">{card.value}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
                <TrendPanel title="User Growth" data={stats.trends?.monthlyUsers || []} />
                <TrendPanel title="Revenue (₹)" data={stats.trends?.monthlyRevenue || []} prefix="₹" />
                <TrendPanel title="Project Volume" data={stats.trends?.monthlyProjects || []} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
                {advancedCards.map((card, index) => {
                    const Icon = card.icon;
                    const valueDisplay = typeof card.value === 'number'
                        ? `${card.prefix || ''}${card.value.toLocaleString()}${card.suffix || ''}`
                        : card.value;
                    return (
                        <div key={index} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-1 shadow-lg">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.bg}`}>
                                <Icon size={18} className={card.color} />
                            </div>
                            <p className="text-[10px] uppercase tracking-[0.35em] text-gray-500 font-semibold">{card.title}</p>
                            <p className="text-2xl font-bold text-white">{valueDisplay}</p>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col h-[400px]">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Activity className="text-emerald-400" size={20} />
                        Global Activity Feed
                    </h2>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                        {activityLogs.length === 0 ? (
                            <div className="text-center text-gray-500 py-10 border-2 border-dashed border-gray-800 rounded-lg">
                                No recent activity
                            </div>
                        ) : (
                            activityLogs.map((log) => (
                                <div key={log._id} className="flex gap-4 p-3 bg-gray-800/30 rounded-lg border border-gray-800/50 hover:bg-gray-800/50 transition-colors">
                                    <div className="mt-1 bg-gray-800 p-2 rounded-full shrink-0 h-fit">
                                        {getActivityIcon(log.action)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-200">
                                            <span className="font-bold text-white">{log.userName}</span>
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5 truncate">{log.details}</p>
                                        <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">
                                            {new Date(log.createdAt).toLocaleString(undefined, {
                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
                    <div className="space-y-3">
                        <button
                            onClick={() => navigate('/admin/reports')}
                            className="w-full bg-gray-800 hover:bg-gray-700 text-left px-4 py-3 rounded-lg transition-colors flex items-center shadow-md"
                        >
                            <AlertTriangle className="mr-3 text-red-400" size={18} />
                            <span>Review Pending Reports</span>
                        </button>
                        <button
                            onClick={() => navigate('/admin/users?filter=banned')}
                            className="w-full bg-gray-800 hover:bg-gray-700 text-left px-4 py-3 rounded-lg transition-colors flex items-center shadow-md"
                        >
                            <Users className="mr-3 text-blue-400" size={18} />
                            <span>Manage Suspended Users</span>
                        </button>
                        <button
                            onClick={() => navigate('/admin/users?action=manageCredits')}
                            className="w-full bg-gray-800 hover:bg-gray-700 text-left px-4 py-3 rounded-lg transition-colors flex items-center shadow-md border border-yellow-500/20"
                        >
                            <Coins className="mr-3 text-yellow-400" size={18} />
                            <span>Manage User Credits</span>
                        </button>
                        <button
                            onClick={() => navigate('/admin/portfolio')}
                            className="w-full bg-gray-800 hover:bg-gray-700 text-left px-4 py-3 rounded-lg transition-colors flex items-center shadow-md border border-cyan-500/20"
                        >
                            <Briefcase className="mr-3 text-cyan-400" size={18} />
                            <span>Review Portfolio Submissions</span>
                        </button>
                        <button
                            onClick={() => navigate('/admin/learn')}
                            className="w-full bg-gray-800 hover:bg-gray-700 text-left px-4 py-3 rounded-lg transition-colors flex items-center shadow-md border border-emerald-500/20"
                        >
                            <Activity className="mr-3 text-emerald-400" size={18} />
                            <span>Manage Learn Articles</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
