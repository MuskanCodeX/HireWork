import React, { useEffect, useRef, useState } from 'react';
import { useCall } from '../context/CallContext';

export const GlobalCallOverlay: React.FC = () => {
    const {
        calling, incomingCall, callAccepted,
        localStream, remoteStream,
        isMuted, isCameraOff, isScreenSharing, primaryView, audioBlocked,
        localVideoRef, remoteVideoRef, remoteAudioRef,
        answerCall, declineCall, endCall,
        toggleMute, toggleCamera, toggleScreenShare,
        setPrimaryView, unblockAudio,
    } = useCall();

    const isVideo = calling?.type === 'video';

    // Call timer
    const [elapsed, setElapsed] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
        if (callAccepted) {
            setElapsed(0);
            timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
        } else {
            clearInterval(timerRef.current!);
            setElapsed(0);
        }
        return () => clearInterval(timerRef.current!);
    }, [callAccepted]);

    const fmtTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    /* ── Incoming call overlay ── */
    if (incomingCall && !calling) {
        return (
            <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4"
                style={{ touchAction: 'none', background: 'radial-gradient(ellipse at center, #0f1f1a 0%, #050b0a 100%)' }}>

                {/* Glow rings */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-96 h-96 rounded-full border border-emerald-500/10 animate-ping" style={{ animationDuration: '2s' }} />
                    <div className="absolute w-72 h-72 rounded-full border border-emerald-500/10 animate-ping" style={{ animationDuration: '2.8s', animationDelay: '0.4s' }} />
                </div>

                {/* Floating particles */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className="absolute rounded-full"
                            style={{
                                width: `${2 + (i % 3) * 2}px`, height: `${2 + (i % 3) * 2}px`,
                                background: i % 3 === 0 ? '#34d399' : i % 3 === 1 ? '#06b6d4' : '#8b5cf6',
                                left: `${5 + i * 9}%`, top: `${10 + (i * 21) % 80}%`,
                                animation: `floatBubble ${3 + i * 0.5}s ease-in-out infinite alternate`,
                                animationDelay: `${i * 0.3}s`, opacity: 0.2 + (i % 4) * 0.1,
                            }} />
                    ))}
                </div>

                <div className="relative bg-gray-900/80 backdrop-blur-2xl border border-white/5 rounded-3xl p-10 max-w-sm w-full text-center shadow-2xl">
                    {/* Incoming call type badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest">
                        {incomingCall.type === 'video' ? (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        )}
                        {incomingCall.type === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call'}
                    </div>

                    {/* Avatar */}
                    <div className="relative w-24 h-24 mx-auto mb-5">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400/30 to-teal-600/20 animate-pulse" style={{ animationDuration: '1.6s' }} />
                        <div className="absolute -inset-2 rounded-full border-2 border-emerald-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                        <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white text-3xl font-black shadow-2xl shadow-emerald-500/30">
                            {incomingCall.peerName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-1 tracking-tight">{incomingCall.peerName || 'Someone'}</h3>
                    <p className="text-gray-400 text-sm mb-10">is calling you…</p>

                    <div className="flex justify-center gap-10">
                        {/* Decline */}
                        <div className="flex flex-col items-center gap-2">
                            <button onClick={declineCall}
                                className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white hover:scale-110 transition-all duration-200 active:scale-95">
                                <svg className="w-7 h-7 rotate-[135deg]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            </button>
                            <span className="text-xs text-gray-500 font-medium">Decline</span>
                        </div>
                        {/* Accept */}
                        <div className="flex flex-col items-center gap-2">
                            <button onClick={answerCall}
                                className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white hover:bg-emerald-400 hover:scale-110 transition-all duration-200 active:scale-95 shadow-xl shadow-emerald-500/40 animate-pulse">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            </button>
                            <span className="text-xs text-emerald-400 font-medium">Accept</span>
                        </div>
                    </div>
                </div>
                <style>{`@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
            </div>
        );
    }

    /* ── Active call overlay ── */
    if (!calling) return null;

    return (
        <div className="fixed top-0 left-0 w-screen h-screen z-[999999] flex flex-col select-none overscroll-none"
            style={{ touchAction: 'none', animation: 'fadeIn 0.3s ease-out', background: 'radial-gradient(ellipse at 50% 20%, #0e2117 0%, #050b08 70%)' }}>

            {/* Background decorative orbs + floating particles (matching home page) */}
            <div className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden pointer-events-none">
                {/* Gradient mesh orbs */}
                <div className="absolute w-[600px] h-[600px] rounded-full blur-[150px] opacity-15"
                    style={{ background: 'radial-gradient(circle, #34d399, transparent 70%)', left: '20%', top: '10%' }} />
                <div className="absolute w-[400px] h-[400px] rounded-full blur-[120px] opacity-10"
                    style={{ background: 'radial-gradient(circle, #06b6d4, transparent 70%)', right: '15%', bottom: '20%' }} />
                <div className="absolute w-[300px] h-[300px] rounded-full blur-[100px] opacity-8"
                    style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)', left: '60%', top: '60%' }} />

                {/* Floating particles */}
                {[...Array(14)].map((_, i) => (
                    <div key={i} className="absolute rounded-full"
                        style={{
                            width: `${2 + (i % 3) * 2}px`, height: `${2 + (i % 3) * 2}px`,
                            background: i % 3 === 0 ? '#34d399' : i % 3 === 1 ? '#06b6d4' : '#8b5cf6',
                            left: `${5 + i * 6.5}%`, top: `${10 + (i * 19) % 80}%`,
                            animation: `floatBubble ${3 + i * 0.5}s ease-in-out infinite alternate`,
                            animationDelay: `${i * 0.25}s`, opacity: 0.25 + (i % 4) * 0.1,
                        }} />
                ))}

                {/* Orbiting rings */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] opacity-[0.05]">
                    <div className="w-full h-full border border-emerald-400 rounded-full" style={{ animation: 'spin 50s linear infinite' }} />
                    <div className="absolute inset-16 border border-teal-400 rounded-full" style={{ animation: 'spin 35s linear infinite reverse' }} />
                    <div className="absolute inset-32 border border-cyan-400 rounded-full" style={{ animation: 'spin 25s linear infinite' }} />
                </div>
            </div>

            {/* Video feeds (absolute, below controls) */}
            {isVideo && callAccepted && (
                <div className="absolute inset-0 z-0 overflow-hidden bg-black rounded-none">
                    {/* Remote (full screen when primary) */}
                    <div className="absolute inset-0" style={{ display: primaryView === 'remote' ? 'block' : 'none' }}>
                        <video ref={remoteVideoRef} autoPlay playsInline muted={false} className="w-full h-full object-cover" />
                    </div>
                    {/* Local (full screen when primary) */}
                    <div className="absolute inset-0" style={{ display: primaryView === 'local' ? 'block' : 'none' }}>
                        <video ref={localVideoRef} autoPlay playsInline muted
                            className={`w-full h-full object-cover ${isCameraOff ? 'opacity-0' : ''}`}
                            style={{ transform: 'rotateY(180deg)' }} />
                        {isCameraOff && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                                <div className="text-gray-500 flex flex-col items-center gap-2">
                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M1 1l22 22" /></svg>
                                    <span className="text-xs font-medium">Camera off</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Floating PiP */}
                    <div onClick={() => setPrimaryView(primaryView === 'remote' ? 'local' : 'remote')}
                        className="absolute bottom-36 right-4 w-28 sm:w-36 aspect-[3/4] sm:aspect-video bg-gray-900 rounded-2xl overflow-hidden border-2 border-white/15 shadow-2xl cursor-pointer hover:scale-105 transition-all group active:scale-95 z-50">
                        {primaryView === 'remote' ? (
                            <video autoPlay playsInline muted
                                ref={(el) => { if (el && localStream) { el.srcObject = localStream; el.play().catch(() => { }); } }}
                                className={`w-full h-full object-cover ${isCameraOff ? 'opacity-0' : ''}`}
                                style={{ transform: 'rotateY(180deg)' }} />
                        ) : (
                            <video autoPlay playsInline muted={false}
                                ref={(el) => { if (el && remoteStream) { el.srcObject = remoteStream; el.play().catch(() => { }); } }}
                                className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors rounded-2xl" />
                        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/50 backdrop-blur-md rounded text-[8px] text-white/80 font-bold uppercase tracking-widest">
                            {primaryView === 'remote' ? 'You' : (calling.peerName || 'Partner')}
                        </div>
                    </div>
                </div>
            )}

            {/* Top area: peer info */}
            <div className="relative z-50 flex flex-col items-center text-center pt-16 sm:pt-20 px-6">
                {/* Call type badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-6 rounded-full bg-white/5 border border-white/10 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                    {isVideo ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    )}
                    {isVideo ? 'Video Call' : 'Voice Call'}
                </div>

                {/* Avatar — hidden during active video */}
                <div className={`relative transition-all duration-700 ${isVideo && callAccepted ? 'opacity-0 scale-50 pointer-events-none h-0 mb-0' : 'opacity-100 mb-6'}`}>
                    <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping" style={{ animationDuration: '3s' }} />
                    <div className="absolute -inset-3 rounded-full border border-emerald-500/15 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
                    <div className="relative w-28 h-28 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white text-4xl font-black shadow-2xl shadow-emerald-500/20">
                        {(calling.peerName || 'P').charAt(0).toUpperCase()}
                    </div>
                </div>

                <h2 className={`text-2xl sm:text-3xl font-bold text-white tracking-tight transition-all duration-500 ${isVideo && callAccepted ? 'opacity-0 pointer-events-none' : ''}`}>
                    {calling.peerName || 'Partner'}
                </h2>

                {/* Status / timer */}
                <div className={`mt-2 transition-all duration-500 ${isVideo && callAccepted ? 'opacity-0' : ''}`}>
                    {callAccepted ? (
                        <span className="text-emerald-400 text-sm font-semibold tabular-nums tracking-wide">
                            {fmtTime(elapsed)}
                        </span>
                    ) : (
                        <span className="text-gray-400 text-sm font-medium animate-pulse">
                            {isVideo ? 'Video calling…' : 'Calling…'}
                        </span>
                    )}
                </div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Hidden audio element */}
            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

            {/* Controls */}
            <div className="relative z-50 flex flex-col items-center gap-4 px-4 pb-12 sm:pb-16 w-full">
                {callAccepted && audioBlocked && (
                    <button onClick={unblockAudio}
                        className="px-6 py-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-black uppercase tracking-widest animate-pulse hover:bg-emerald-500/30 transition-all">
                        Tap to Connect Audio
                    </button>
                )}

                {/* Control buttons */}
                <div className="flex items-center justify-center gap-4 sm:gap-6">
                    {/* Mute */}
                    <div className="flex flex-col items-center gap-2">
                        <button onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${isMuted ? 'bg-red-500 text-white shadow-lg shadow-red-500/40' : 'bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/10'}`}>
                            {isMuted ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                            )}
                        </button>
                        <span className="text-[10px] text-gray-400 font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
                    </div>

                    {/* Camera (video only) */}
                    {isVideo && (
                        <div className="flex flex-col items-center gap-2">
                            <button onClick={toggleCamera} title={isCameraOff ? 'Camera On' : 'Camera Off'}
                                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${isCameraOff ? 'bg-red-500 text-white shadow-lg shadow-red-500/40' : 'bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/10'}`}>
                                {isCameraOff ? (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 1l22 22" /></svg>
                                ) : (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                )}
                            </button>
                            <span className="text-[10px] text-gray-400 font-medium">{isCameraOff ? 'Cam On' : 'Cam Off'}</span>
                        </div>
                    )}

                    {/* END CALL (center, largest) */}
                    <div className="flex flex-col items-center gap-2">
                        <button onClick={endCall} title="End Call"
                            className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-red-600 flex items-center justify-center text-white hover:bg-red-500 transition-all duration-200 shadow-2xl shadow-red-600/50 active:scale-90 hover:scale-105"
                            style={{ width: '4.5rem', height: '4.5rem' }}>
                            <svg className="w-8 h-8 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6.62 10.79a15.15 15.15 0 006.59 6.59l2.2-2.2a1 1 0 011.17-.24c1.12.45 2.33.69 3.58.69a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011-1c0 1.25.24 2.46.69 3.58a1 1 0 01-.24 1.17l-2.2 2.2z" />
                            </svg>
                        </button>
                        <span className="text-[10px] text-red-400 font-medium">End Call</span>
                    </div>

                    {/* Screen Share (video only) */}
                    {isVideo && callAccepted && typeof navigator !== 'undefined' && !!(navigator.mediaDevices as any)?.getDisplayMedia && (
                        <div className="flex flex-col items-center gap-2">
                            <button onClick={toggleScreenShare} title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${isScreenSharing ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/40' : 'bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/10'}`}>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </button>
                            <span className="text-[10px] text-gray-400 font-medium">{isScreenSharing ? 'Stop Share' : 'Share'}</span>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
                @keyframes floatBubble { from { transform: translateY(0px) scale(1); } to { transform: translateY(-18px) scale(1.15); } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};
