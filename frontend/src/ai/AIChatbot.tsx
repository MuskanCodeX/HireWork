import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { API_BASE } from '../config';
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    suggestedActions?: string[];
}

type DockSide = 'left' | 'right' | 'top' | 'bottom';

const MOBILE_BREAKPOINT = 768;
const FLOATING_BUTTON_SIZE = 56;
const FLOATING_BUTTON_MARGIN = 8;
const DOCK_STORAGE_KEY = 'HIREWORK_ai_dock_side';

export const AIChatbot = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false);
    const [dockSide, setDockSide] = useState<DockSide>(() => {
        if (typeof window === 'undefined') return 'right';
        const savedSide = window.localStorage.getItem(DOCK_STORAGE_KEY);
        return savedSide === 'left' || savedSide === 'right' || savedSide === 'top' || savedSide === 'bottom'
            ? savedSide
            : 'right';
    });
    const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const dragStateRef = useRef<{
        dragging: boolean;
        moved: boolean;
        offsetX: number;
        offsetY: number;
        startX: number;
        startY: number;
    }>({
        dragging: false,
        moved: false,
        offsetX: 0,
        offsetY: 0,
        startX: 0,
        startY: 0,
    });

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
            setDragPosition(null);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(DOCK_STORAGE_KEY, dockSide);
        }
    }, [dockSide]);

    const handleSend = async () => {
        if (!input.trim() || loading || !user) return;
        
        const userMessage: Message = { role: 'user', content: input.trim() };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE}/ai/chatbot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
                body: JSON.stringify({
                    message: userMessage.content,
                    conversationHistory: messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
                })
            });
            const data = await res.json();
            
            if (res.ok && data.response) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.response.response,
                    suggestedActions: data.response.suggestedActions
                }]);
            } else {
                setError(data.message || 'Failed to get response');
            }
        } catch (err) {
            setError('Unable to reach AI assistant. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSuggestedAction = (action: string) => {
        setInput(action);
    };

    const clampPosition = (x: number, y: number) => ({
        x: Math.min(Math.max(FLOATING_BUTTON_MARGIN, x), window.innerWidth - FLOATING_BUTTON_SIZE - FLOATING_BUTTON_MARGIN),
        y: Math.min(Math.max(FLOATING_BUTTON_MARGIN, y), window.innerHeight - FLOATING_BUTTON_SIZE - FLOATING_BUTTON_MARGIN),
    });

    const getDockStyle = () => {
        if (dragPosition) {
            return {
                left: `${dragPosition.x}px`,
                top: `${dragPosition.y}px`,
            };
        }

        switch (dockSide) {
            case 'left':
                return { left: '1rem', top: '50%', transform: 'translateY(-50%)' };
            case 'top':
                return { left: '50%', top: '1rem', transform: 'translateX(-50%)' };
            case 'bottom':
                return { left: '50%', bottom: '1rem', transform: 'translateX(-50%)' };
            case 'right':
            default:
                return { right: '1rem', top: '50%', transform: 'translateY(-50%)' };
        }
    };

    const startDrag = (clientX: number, clientY: number, rect: DOMRect) => {
        dragStateRef.current = {
            dragging: true,
            moved: false,
            offsetX: clientX - rect.left,
            offsetY: clientY - rect.top,
            startX: clientX,
            startY: clientY,
        };
        setDragPosition({ x: rect.left, y: rect.top });
    };

    const updateDrag = (clientX: number, clientY: number) => {
        if (!isMobile || !dragStateRef.current.dragging) return;

        const deltaX = Math.abs(clientX - dragStateRef.current.startX);
        const deltaY = Math.abs(clientY - dragStateRef.current.startY);
        if (deltaX > 6 || deltaY > 6) {
            dragStateRef.current.moved = true;
        }

        const next = clampPosition(
            clientX - dragStateRef.current.offsetX,
            clientY - dragStateRef.current.offsetY,
        );

        setDragPosition(next);
    };

    const finishDrag = () => {
        if (!isMobile || !dragStateRef.current.dragging) return;

        const current = dragPosition;
        dragStateRef.current.dragging = false;

        if (!current || !dragStateRef.current.moved) {
            setDragPosition(null);
            return;
        }

        const centerX = current.x + FLOATING_BUTTON_SIZE / 2;
        const centerY = current.y + FLOATING_BUTTON_SIZE / 2;
        const distances = [
            { side: 'left' as DockSide, value: centerX },
            { side: 'right' as DockSide, value: window.innerWidth - centerX },
            { side: 'top' as DockSide, value: centerY },
            { side: 'bottom' as DockSide, value: window.innerHeight - centerY },
        ];
        distances.sort((a, b) => a.value - b.value);
        setDockSide(distances[0].side);
        setDragPosition(null);

        window.setTimeout(() => {
            dragStateRef.current.moved = false;
        }, 0);
    };

    const cancelDrag = () => {
        dragStateRef.current.dragging = false;
        dragStateRef.current.moved = false;
        setDragPosition(null);
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
        if (!isMobile || isOpen) return;

        const touch = e.touches[0];
        if (!touch) return;

        startDrag(touch.clientX, touch.clientY, e.currentTarget.getBoundingClientRect());
    };

    useEffect(() => {
        if (!isMobile || !dragStateRef.current.dragging) return;

        const handleTouchMove = (event: TouchEvent) => {
            const touch = event.touches[0];
            if (!touch) return;
            event.preventDefault();
            updateDrag(touch.clientX, touch.clientY);
        };

        const handleTouchEnd = () => {
            finishDrag();
        };

        const handleTouchCancel = () => {
            cancelDrag();
        };

        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd);
        window.addEventListener('touchcancel', handleTouchCancel);

        return () => {
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('touchcancel', handleTouchCancel);
        };
    }, [isMobile, dragPosition]);

    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (isMobile || isOpen) return;
        startDrag(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
    };

    useEffect(() => {
        if (isMobile || !dragStateRef.current.dragging) return;

        const handleMouseMove = (event: MouseEvent) => {
            updateDrag(event.clientX, event.clientY);
        };

        const handleMouseUp = () => {
            finishDrag();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isMobile, dragPosition]);

    const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
        e.preventDefault();
    };

    const handleButtonClick = () => {
        if (dragStateRef.current.moved) {
            dragStateRef.current.moved = false;
            return;
        }
        setIsOpen(true);
    };

    if (!user) return null;

        return (
        <>
            {/* Floating Button */}
            <div
                className="fixed z-40"
                style={getDockStyle()}
            >
                <button
                    onClick={handleButtonClick}
                    onTouchStart={handleTouchStart}
                    onMouseDown={handleMouseDown}
                    onDragStart={handleDragStart}
                    className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white p-4 rounded-full shadow-lg hover:shadow-emerald-500/25 transition-all hover:scale-110 animate-pulse touch-none"
                    title={isMobile ? 'AI Assistant - drag to move' : 'AI Assistant'}
                    style={{ touchAction: 'none' }}
                >
                    <MessageCircle className="w-6 h-6" />
                </button>
            </div>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ height: '500px' }}>
                    {/* Header */}
                    <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-sm">AI Assistant</h3>
                                <p className="text-white/70 text-xs">Ask me anything about HIREWORK</p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 && (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Bot className="w-8 h-8 text-emerald-400" />
                                </div>
                                <h4 className="text-white font-bold mb-2">Hello! I'm your AI Assistant</h4>
                                <p className="text-gray-500 text-sm mb-4">I can help you with:</p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {['How to get verified', 'How to post a project', 'How payments work', 'Tips for getting hired'].map((tip) => (
                                        <button
                                            key={tip}
                                            onClick={() => handleSuggestedAction(tip)}
                                            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-full transition-colors"
                                        >
                                            {tip}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-emerald-500/20' : 'bg-gray-800'}`}>
                                    {msg.role === 'user' ? (
                                        <User className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                        <Bot className="w-4 h-4 text-cyan-400" />
                                    )}
                                </div>
                                <div className={`max-w-[80%] rounded-2xl p-3 ${msg.role === 'user' ? 'bg-emerald-500/20 text-white' : 'bg-gray-800 text-gray-200'}`}>
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {msg.suggestedActions.map((action, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleSuggestedAction(action)}
                                                    className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded transition-colors"
                                                >
                                                    {action}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex gap-3">
                                <div className="w-7 h-7 bg-gray-800 rounded-full flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-cyan-400" />
                                </div>
                                <div className="bg-gray-800 rounded-2xl p-3">
                                    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
                                {error}
                            </div>
                        )}
                        
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-3 border-t border-gray-800">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Type your question..."
                                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                                disabled={loading}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-xl transition-colors"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Send className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
