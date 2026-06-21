import React, { useState } from 'react';
import { API_BASE } from '../config';
import { useAuth } from '../hooks/useAuth';

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    agreementId: string;
    revieweeName: string;
    onSuccess: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, agreementId, revieweeName, onSuccess }) => {
    const { user } = useAuth();
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [communicationRating, setCommunicationRating] = useState(0);
    const [qualityRating, setQualityRating] = useState(0);
    const [timelinessRating, setTimelinessRating] = useState(0);
    const [wouldRecommend, setWouldRecommend] = useState(false);
    const [deliveredOnTime, setDeliveredOnTime] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) {
            setError('Please provide an overall rating out of 5 stars.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE}/reviews`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${user?.token}`,
                },
                body: JSON.stringify({
                    contractId: agreementId,
                    rating,
                    comment,
                    communicationRating: communicationRating || rating,
                    qualityRating: qualityRating || rating,
                    timelinessRating: timelinessRating || rating,
                    wouldRecommend,
                    deliveredOnTime
                }),
            });

            const data = await res.json();
            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                setError(data.message || 'Failed to submit review');
            }
        } catch (err) {
            setError('Network error submitting review.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const renderSecondaryStars = (label: string, value: number, setter: (val: number) => void) => (
        <div className="flex items-center justify-between mb-3 bg-gray-900/50 p-3 rounded-xl border border-gray-800/50">
            <span className="text-gray-400 text-sm font-medium">{label}</span>
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => setter(star)}
                        className="focus:outline-none transition-transform hover:scale-110 active:scale-95 p-1"
                    >
                        <svg
                            className={`w-5 h-5 transition-colors ${value >= star ? 'text-amber-400' : 'text-gray-700'
                                }`}
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto" style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl my-8" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="text-amber-400">⭐</span> Leave a Review
                        </h3>
                        <button onClick={onClose} className="text-gray-600 hover:text-white text-xl leading-none">×</button>
                    </div>

                    <p className="text-gray-400 text-sm mb-6">
                        How was your experience working with <span className="text-white font-semibold">{revieweeName}</span>?
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Star Rating */}
                        <div className="flex flex-col items-center mb-6">
                            <span className="text-gray-400 text-sm font-medium mb-3">Overall Rating</span>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        onClick={() => setRating(star)}
                                        className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                                    >
                                        <svg
                                            className={`w-10 h-10 transition-colors ${(hoverRating || rating) >= star ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'text-gray-700'
                                                }`}
                                            fill="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                        </svg>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Detailed Ratings */}
                        <div className="space-y-1">
                            {renderSecondaryStars('Communication', communicationRating, setCommunicationRating)}
                            {renderSecondaryStars('Quality of Work', qualityRating, setQualityRating)}
                            {renderSecondaryStars('Timeliness', timelinessRating, setTimelinessRating)}
                        </div>

                        {/* Additional Toggles */}
                        <div className="flex flex-col gap-3 py-2">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${wouldRecommend ? 'bg-emerald-500' : 'bg-gray-700'}`}>
                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${wouldRecommend ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                                <span className="text-gray-300 text-sm group-hover:text-white transition-colors">I would recommend them</span>
                                <input type="checkbox" className="hidden" checked={wouldRecommend} onChange={(e) => setWouldRecommend(e.target.checked)} />
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${deliveredOnTime ? 'bg-emerald-500' : 'bg-gray-700'}`}>
                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${deliveredOnTime ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                                <span className="text-gray-300 text-sm group-hover:text-white transition-colors">Project delivered on schedule</span>
                                <input type="checkbox" className="hidden" checked={deliveredOnTime} onChange={(e) => setDeliveredOnTime(e.target.checked)} />
                            </label>
                        </div>

                        {/* Comment Textarea */}
                        <div>
                            <label className="block text-gray-400 text-sm font-medium mb-2">
                                Public Review <span className="text-gray-600 text-xs font-normal">(optional)</span>
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="input-field h-24 resize-none text-sm"
                                placeholder="Share details of your experience..."
                                maxLength={500}
                            />
                            <div className="text-right mt-1 text-xs text-gray-600">
                                {comment.length}/500
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-start gap-2">
                                <span>⚠️</span>
                                <p>{error}</p>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose} className="flex-1 btn-secondary !py-3 text-sm">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || rating === 0}
                                className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-950 font-bold py-3 rounded-lg text-sm hover:from-amber-400 hover:to-yellow-400 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
                            >
                                {loading ? 'Submitting...' : 'Post Review'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
