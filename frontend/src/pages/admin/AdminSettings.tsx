import { useEffect, useState } from 'react';
import { API_BASE } from '../../config';
import { useAuth } from '../../hooks/useAuth';
import { Settings2, Save, Clock, MessageCircle, Instagram } from 'lucide-react';
import toast from 'react-hot-toast';

export const AdminSettings = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        platformName: '',
        defaultNewUserCredits: 3,
        referralBonusCredits: 1,
        maintenanceMode: false,
        maintenanceEndTime: '',
        whatsappLink: '',
        instagramLink: '',
        contactEmail: ''
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch(`${API_BASE}/admin/settings`, {
                    headers: { Authorization: `Bearer ${user?.token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setSettings({
                        platformName: data.platformName || '',
                        defaultNewUserCredits: data.defaultNewUserCredits !== undefined ? data.defaultNewUserCredits : 3,
                        referralBonusCredits: data.referralBonusCredits !== undefined ? data.referralBonusCredits : 1,
                        maintenanceMode: data.maintenanceMode || false,
                        maintenanceEndTime: data.maintenanceEndTime ? new Date(data.maintenanceEndTime).toISOString().slice(0, 16) : '',
                        whatsappLink: data.whatsappLink || '',
                        instagramLink: data.instagramLink || '',
                        contactEmail: data.contactEmail || ''
                    });
                }
            } catch (error) {
                console.error("Failed to fetch settings", error);
            } finally {
                setLoading(false);
            }
        };
        if (user?.token) fetchSettings();
    }, [user?._id, user?.token]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/admin/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${user?.token}`
                },
                body: JSON.stringify({
                    ...settings,
                    defaultNewUserCredits: Number(settings.defaultNewUserCredits),
                    referralBonusCredits: Number(settings.referralBonusCredits),
                    maintenanceEndTime: settings.maintenanceEndTime ? new Date(settings.maintenanceEndTime).toISOString() : null
                })
            });
            if (res.ok) {
                toast.success('Settings correctly updated.');
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to update settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="text-gray-500 p-8">Loading configuration...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center space-x-3 mb-8">
                <Settings2 size={32} className="text-indigo-400" />
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                    Platform Settings
                </h1>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg p-8">
                <form onSubmit={handleSubmit} className="space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Platform Name</label>
                            <input
                                type="text"
                                name="platformName"
                                value={settings.platformName}
                                onChange={handleChange}
                                className="w-full bg-gray-800 border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Contact Email</label>
                            <input
                                type="email"
                                name="contactEmail"
                                value={settings.contactEmail}
                                onChange={handleChange}
                                className="w-full bg-gray-800 border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Default Free Credits (New Users)</label>
                            <input
                                type="number"
                                name="defaultNewUserCredits"
                                value={settings.defaultNewUserCredits}
                                onChange={handleChange}
                                min="0"
                                className="w-full bg-gray-800 border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Referral Bonus (Credits per invite)</label>
                            <input
                                type="number"
                                name="referralBonusCredits"
                                value={settings.referralBonusCredits}
                                onChange={handleChange}
                                min="0"
                                className="w-full bg-gray-800 border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-800">
                        <div className="flex items-center justify-between bg-gradient-to-r from-red-900/20 to-gray-800/50 p-5 rounded-lg border border-red-500/30">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${settings.maintenanceMode ? 'bg-red-500/20' : 'bg-gray-700/50'}`}>
                                    <Clock size={24} className={settings.maintenanceMode ? 'text-red-400' : 'text-gray-400'} />
                                </div>
                                <div>
                                    <h3 className="text-white font-semibold text-lg">Maintenance Mode</h3>
                                    <p className="text-sm text-gray-400">Enable to show countdown page to users (admins can still access)</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="maintenanceMode"
                                    checked={settings.maintenanceMode}
                                    onChange={handleChange}
                                    className="sr-only peer"
                                />
                                <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-500"></div>
                            </label>
                        </div>

                        {settings.maintenanceMode && (
                            <div className="mt-4 p-5 bg-gradient-to-r from-emerald-900/20 to-cyan-900/10 rounded-lg border border-emerald-500/30 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                                        <Clock size={20} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-semibold">Countdown Timer</h4>
                                        <p className="text-sm text-gray-400">Set when the site should be back online (shows countdown on maintenance page)</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">End Date & Time</label>
                                        <input
                                            type="datetime-local"
                                            name="maintenanceEndTime"
                                            value={settings.maintenanceEndTime}
                                            onChange={handleChange}
                                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            type="button"
                                            onClick={() => setSettings(prev => ({ ...prev, maintenanceEndTime: '' }))}
                                            className="text-sm text-gray-400 hover:text-white transition-colors"
                                        >
                                            Clear Time
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-emerald-400/70">
                                    💡 Leave empty to show "We'll be back in a few minutes" without countdown
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-gray-800">
                        <div className="flex items-center gap-2 text-white font-medium mb-4">
                            <MessageCircle size={18} className="text-emerald-400" />
                            Social Links (Maintenance Page)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    <span className="flex items-center gap-2">
                                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                        WhatsApp Link
                                    </span>
                                </label>
                                <input
                                    type="url"
                                    name="whatsappLink"
                                    value={settings.whatsappLink}
                                    onChange={handleChange}
                                    placeholder="https://wa.me/91xxxxxxxxxx"
                                    className="w-full bg-gray-800 border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    <span className="flex items-center gap-2">
                                        <Instagram size={16} />
                                        Instagram Link
                                    </span>
                                </label>
                                <input
                                    type="url"
                                    name="instagramLink"
                                    value={settings.instagramLink}
                                    onChange={handleChange}
                                    placeholder="https://instagram.com/hirework.in"
                                    className="w-full bg-gray-800 border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                        >
                            <Save size={20} />
                            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};
