import { useState } from 'react';
import toast from 'react-hot-toast';
import { API_BASE } from '../config';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    token?: string;
}

export const FeedbackModal = ({ isOpen, onClose, token }: FeedbackModalProps) => {
    const [category, setCategory] = useState<'improvement' | 'suggestion' | 'bug' | 'other'>('suggestion');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedMessage = message.trim();

        if (!trimmedMessage) {
            toast.error('Please write your feedback first.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    category,
                    message: trimmedMessage,
                    pagePath: window.location.pathname,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.message || 'Failed to submit feedback');
            }

            toast.success('Thanks for the feedback.');
            setCategory('suggestion');
            setMessage('');
            onClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to submit feedback');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="absolute inset-0" onClick={onClose} />
            <form onSubmit={handleSubmit} className="relative w-full max-w-lg rounded-3xl border border-gray-800 bg-gray-900 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
                    <div>
                        <h3 className="text-lg font-bold text-white">Help Us Improve</h3>
                        <p className="text-sm text-gray-400">Share suggestions, improvements, or issues you want fixed.</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-800 hover:text-white">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4 px-6 py-5">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-300">Type</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as 'improvement' | 'suggestion' | 'bug' | 'other')}
                            className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white outline-none transition-all focus:border-emerald-500"
                        >
                            <option value="suggestion">Suggestion</option>
                            <option value="improvement">Improvement</option>
                            <option value="bug">Bug Report</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-300">Message</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                            rows={6}
                            placeholder="Tell us what should be improved or what you would like to see next..."
                            className="w-full resize-none rounded-2xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white outline-none transition-all focus:border-emerald-500"
                        />
                        <div className="mt-2 text-right text-xs text-gray-500">{message.length}/2000</div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-gray-800 px-6 py-4">
                    <button type="button" onClick={onClose} className="rounded-xl border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-800 hover:text-white">
                        Cancel
                    </button>
                    <button type="submit" disabled={submitting} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-gray-950 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60">
                        {submitting ? 'Sending...' : 'Send Feedback'}
                    </button>
                </div>
            </form>
        </div>
    );
};
