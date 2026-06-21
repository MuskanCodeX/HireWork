import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

/* ───────── types ───────── */
export interface CallInfo {
    peerId: string;
    peerName: string;
    type: 'voice' | 'video';
}

interface CallContextType {
    /* state */
    calling: CallInfo | null;          // outgoing or active call info
    incomingCall: CallInfo | null;     // incoming call waiting to be answered
    callAccepted: boolean;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    isMuted: boolean;
    isCameraOff: boolean;
    isScreenSharing: boolean;
    primaryView: 'remote' | 'local';
    audioBlocked: boolean;

    /* refs for media elements (set by the overlay) */
    localVideoRef: React.RefObject<HTMLVideoElement | null>;
    remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
    remoteAudioRef: React.RefObject<HTMLAudioElement | null>;

    /* actions */
    startCall: (peerId: string, peerName: string, type: 'voice' | 'video') => void;
    answerCall: () => void;
    declineCall: () => void;
    endCall: () => void;
    toggleMute: () => void;
    toggleCamera: () => void;
    toggleScreenShare: () => Promise<void>;
    setPrimaryView: (v: 'remote' | 'local') => void;
    unblockAudio: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

export const useCall = () => {
    const ctx = useContext(CallContext);
    if (!ctx) throw new Error('useCall must be used within CallProvider');
    return ctx;
};

/* ───────── provider ───────── */
export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { socket } = useSocket();
    const { user } = useAuth();

    /* state */
    const [calling, setCalling] = useState<CallInfo | null>(null);
    const [incomingCall, setIncomingCall] = useState<CallInfo | null>(null);
    const [callAccepted, setCallAccepted] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [primaryView, setPrimaryView] = useState<'remote' | 'local'>('remote');
    const [audioBlocked, setAudioBlocked] = useState(false);

    /* refs */
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
    const setupInProgress = useRef(false);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
    const ringtoneRef = useRef<{ stop: () => void } | null>(null);

    /* keep latest socket + callerPeerId accessible in callbacks */
    const socketRef = useRef(socket);
    useEffect(() => { socketRef.current = socket; }, [socket]);
    const callingRef = useRef(calling);
    useEffect(() => { callingRef.current = calling; }, [calling]);
    const incomingCallRef = useRef(incomingCall);
    useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

    const iceServers: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            // TURN relays – required for mobile / strict NAT
            { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
        ],
    };

    /* ── helpers ── */
    const playRingtone = (isOutgoing: boolean) => {
        ringtoneRef.current?.stop();
        try {
            const AC = ((window as any).AudioContext || (window as any).webkitAudioContext);
            const ctx = new AC();
            let stopped = false;
            const pulse = (freq: number, dur: number, delay: number) => {
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.connect(g); g.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
                g.gain.setValueAtTime(0, ctx.currentTime + delay);
                g.gain.linearRampToValueAtTime(0.1, ctx.currentTime + delay + 0.1);
                g.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + dur);
                osc.start(ctx.currentTime + delay);
                osc.stop(ctx.currentTime + delay + dur);
            };
            const iv = setInterval(() => {
                if (stopped) return;
                if (isOutgoing) { pulse(440, 0.5, 0); pulse(440, 0.5, 0.6); }
                else { pulse(554.37, 0.8, 0); pulse(440, 0.8, 0.1); }
            }, 2000);
            ringtoneRef.current = { stop: () => { stopped = true; clearInterval(iv); ctx.close(); ringtoneRef.current = null; } };
        } catch (e) { console.error('Ringtone fail: ', e); }
    };

    const cleanupCall = useCallback(() => {
        ringtoneRef.current?.stop();
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        if (remoteStream) remoteStream.getTracks().forEach(t => t.stop());
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        cameraTrackRef.current = null;
        peerConnection.current?.close();
        peerConnection.current = null;
        pendingCandidates.current = [];
        setupInProgress.current = false;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        setLocalStream(null);
        setRemoteStream(null);
        setCalling(null);
        setIncomingCall(null);
        setCallAccepted(false);
        setIsScreenSharing(false);
        setIsMuted(false);
        setIsCameraOff(false);
        setAudioBlocked(false);
        setPrimaryView('remote');
    }, [localStream, remoteStream]);

    /* ── setupWebRTC ── */
    const setupWebRTC = useCallback(async (isCaller: boolean, callInfo: CallInfo) => {
        if (setupInProgress.current) return;
        setupInProgress.current = true;
        try {
            const isVideo = callInfo.type === 'video';
            const stream = await navigator.mediaDevices.getUserMedia({
                video: isVideo ? { facingMode: 'user' } : false,
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
            if (isVideo) {
                const vt = stream.getVideoTracks()[0];
                if (vt) cameraTrackRef.current = vt;
            }
            setLocalStream(stream);

            const pc = new RTCPeerConnection(iceServers);
            peerConnection.current = pc;

            stream.getTracks().forEach(t => pc.addTrack(t, stream));

            pc.onicecandidate = (ev) => {
                if (ev.candidate && socketRef.current) {
                    socketRef.current.emit('webrtc_signal', {
                        to: callInfo.peerId,
                        signal: { candidate: ev.candidate },
                    });
                }
            };

            pc.ontrack = (ev) => {
                console.log('[CallCtx] Remote track:', ev.track.kind);
                const rs = ev.streams[0];
                setRemoteStream(rs);

                if (isVideo && remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = rs;
                    remoteVideoRef.current.play().catch(() => { });
                }
                if (remoteAudioRef.current) {
                    remoteAudioRef.current.srcObject = rs;
                    remoteAudioRef.current.volume = 1.0;
                    remoteAudioRef.current.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
                }
            };

            if (isCaller && socketRef.current) {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socketRef.current.emit('webrtc_signal', { to: callInfo.peerId, signal: offer });
            }
        } catch (err) {
            console.error('[CallCtx] WebRTC error:', err);
            cleanupCall();
        } finally {
            setupInProgress.current = false;
        }
    }, [cleanupCall, iceServers]);

    /* ── socket listeners ── */
    useEffect(() => {
        if (!socket) return;

        const handleIncomingCall = (data: { fromId: string; fromName: string; type: 'voice' | 'video' }) => {
            console.log('[CallCtx DEBUG] Incoming call event received:', data);
            console.log('[CallCtx DEBUG] Current user ID:', user?._id);
            if (!data || data.fromId === user?._id) {
                console.warn('[CallCtx DEBUG] Ignored incoming call: same as current user or no data.');
                return;
            }
            // Don't accept new incoming if already in a call
            if (callingRef.current) { console.warn('[CallCtx DEBUG] Ignored incoming call because already in a call:', callingRef.current); return; }
            setIncomingCall({ peerId: data.fromId, peerName: data.fromName, type: data.type });
            playRingtone(false);
        };

        const handleCallAnswered = async (data: { accepted: boolean }) => {
            console.log('[CallCtx DEBUG] Call answered event:', data);
            ringtoneRef.current?.stop();
            if (data.accepted && callingRef.current) {
                console.log('[CallCtx DEBUG] Call accepted, setting up WebRTC...');
                setCallAccepted(true);
                await setupWebRTC(true, callingRef.current);
            } else {
                console.log('[CallCtx DEBUG] Call declined or calling state lost.');
                setCalling(null);
            }
        };

        const handleCallEnded = () => {
            console.log('[CallCtx DEBUG] Call ended event received.');
            cleanupCall();
        };

        const handleWebRTCSignal = async (data: { fromId: string; signal: any }) => {
            if (!socketRef.current) return;
            const { signal } = data;
            console.log(`[CallCtx DEBUG] Signal received: ${signal.type || (signal.candidate ? 'candidate' : 'unknown')} from ${data.fromId}`);

            const currentCall = callingRef.current || incomingCallRef.current;
            if (!currentCall) {
                console.warn('[CallCtx DEBUG] Signal ignored: No active call state.');
                return;
            }

            // Create PC if needed
            if (!peerConnection.current && !setupInProgress.current) {
                console.log('[CallCtx DEBUG] First signal received, creating PeerConnection...');
                let guessType: 'voice' | 'video' = currentCall.type;
                if (data.signal?.sdp?.includes('m=video')) guessType = 'video';
                await setupWebRTC(false, { ...currentCall, type: guessType });
            }

            // Wait for PC
            let tries = 0;
            while (!peerConnection.current && tries < 30) {
                await new Promise(r => setTimeout(r, 200));
                tries++;
            }

            const pc = peerConnection.current;
            if (!pc) { console.error('[CallCtx] PC not created in time'); return; }

            try {
                if (signal.type === 'offer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socketRef.current.emit('webrtc_signal', { to: data.fromId, signal: answer });
                    // Flush buffered candidates
                    while (pendingCandidates.current.length) {
                        const c = pendingCandidates.current.shift();
                        if (c) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => { });
                    }
                } else if (signal.type === 'answer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                    while (pendingCandidates.current.length) {
                        const c = pendingCandidates.current.shift();
                        if (c) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => { });
                    }
                } else if (signal.candidate) {
                    if (pc.remoteDescription?.type) {
                        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => { });
                    } else {
                        pendingCandidates.current.push(signal.candidate);
                    }
                }
            } catch (e) { console.error('[CallCtx] Signal error:', e); }
        };

        socket.on('incoming_call', handleIncomingCall);
        socket.on('call_answered', handleCallAnswered);
        socket.on('call_ended', handleCallEnded);
        socket.on('webrtc_signal', handleWebRTCSignal);

        return () => {
            socket.off('incoming_call', handleIncomingCall);
            socket.off('call_answered', handleCallAnswered);
            socket.off('call_ended', handleCallEnded);
            socket.off('webrtc_signal', handleWebRTCSignal);
        };
    }, [socket, user?._id, setupWebRTC, cleanupCall]);

    /* ── assign streams to media elements when they change ── */
    useEffect(() => {
        const isVideo = calling?.type === 'video' || incomingCall?.type === 'video';
        if (localStream && localVideoRef.current && isVideo) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play().catch(() => { });
        }
    }, [localStream, calling, incomingCall]);

    useEffect(() => {
        const isVideo = calling?.type === 'video' || incomingCall?.type === 'video';
        if (!remoteStream) return;
        if (isVideo && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
        }
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
        }
    }, [remoteStream, calling, incomingCall]);

    /* ── actions ── */
    const ensureSocketConnected = useCallback(async () => {
        const activeSocket = socketRef.current;
        if (!activeSocket) return null;
        if (activeSocket.connected) return activeSocket;

        try { activeSocket.connect(); } catch (e) { }

        const connected = await new Promise<boolean>((resolve) => {
            let settled = false;
            const finish = (ok: boolean) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                activeSocket.off('connect', onConnect);
                activeSocket.off('connect_error', onError);
                resolve(ok);
            };
            const onConnect = () => finish(true);
            const onError = () => finish(false);
            const timeoutId = window.setTimeout(() => finish(false), 5000);

            activeSocket.on('connect', onConnect);
            activeSocket.on('connect_error', onError);
        });

        return connected ? activeSocket : null;
    }, []);

    const startCall = useCallback((peerId: string, peerName: string, type: 'voice' | 'video') => {
        try {
            console.log('[CallCtx DEBUG] startCall initiated', { peerId, peerName, type });
            if (calling) {
                console.warn('[CallCtx DEBUG] Already in a call state.');
                return;
            }
            const targetId = (peerId || '').trim();
            if (!targetId) throw new Error('Target peerId is empty');

            const info: CallInfo = { peerId: targetId, peerName, type };
            setCalling(info);

            try { playRingtone(true); } catch (e) { console.error('Ringtone failed but continuing...', e); }

            void (async () => {
                const readySocket = await ensureSocketConnected();
                if (!readySocket) {
                    ringtoneRef.current?.stop();
                    setCalling(null);
                    toast.error('Realtime connection failed. Please refresh and try again.');
                    return;
                }

                const payload = { to: targetId, fromId: user?._id, fromName: user?.name, type };
                console.log('[CallCtx DEBUG] EMITTING call_user to:', targetId, 'connected=', readySocket.connected);

                try {
                    (readySocket as any).timeout(5000).emit('call_user', payload, (err: any, ack: any) => {
                        if (err) {
                            ringtoneRef.current?.stop();
                            setCalling(null);
                            toast.error('Call failed: realtime server did not respond.');
                            return;
                        }

                        if (!ack?.ok) {
                            ringtoneRef.current?.stop();
                            setCalling(null);
                            if (ack?.reason === 'target_offline') {
                                toast.error(`${peerName || 'User'} is not online for calls right now.`);
                            } else if (ack?.reason === 'agreement_required') {
                                toast.error('Create an agreement first. Calls are available only after an active agreement is accepted.');
                            } else {
                                toast.error('Call could not be started. Please try again.');
                            }
                        }
                    });
                } catch (emitError: any) {
                    ringtoneRef.current?.stop();
                    setCalling(null);
                    toast.error(`Call failed: ${emitError?.message || 'unexpected signaling error'}`);
                }
            })();
        } catch (err: any) {
            console.error('[CallCtx DEBUG] startCall CRASHED:', err);
            toast.error('Call Failed: ' + err.message);
        }
    }, [calling, user, ensureSocketConnected]);

    (window as any).callDebug = () => ({ calling, incomingCall, socketId: socket?.id, userId: user?._id });

    const answerCall = useCallback(async () => {
        if (!incomingCall || !socket) return;
        ringtoneRef.current?.stop();
        const info = { ...incomingCall };
        setCalling(info);
        setCallAccepted(true);
        setIncomingCall(null);
        socket.emit('answer_call', { to: info.peerId, accepted: true });
        await setupWebRTC(false, info);
    }, [incomingCall, socket, setupWebRTC]);

    const declineCall = useCallback(() => {
        ringtoneRef.current?.stop();
        if (incomingCall && socket) {
            socket.emit('answer_call', { to: incomingCall.peerId, accepted: false, type: incomingCall.type });
        }
        setIncomingCall(null);
    }, [incomingCall, socket]);

    const endCall = useCallback(() => {
        const peerId = calling?.peerId || incomingCall?.peerId;
        const type = calling?.type || incomingCall?.type;
        const wasMissed = !callAccepted;
        if (peerId && socket) {
            socket.emit('hangup', { to: peerId, wasMissed, type });
        }
        cleanupCall();
    }, [calling, incomingCall, socket, cleanupCall, callAccepted]);

    const toggleMute = useCallback(() => {
        const shouldEnable = isMuted; // muted → enable, unmuted → disable
        if (localStream) {
            localStream.getAudioTracks().forEach(t => { t.enabled = shouldEnable; });
        }
        if (peerConnection.current) {
            peerConnection.current.getSenders().forEach(s => {
                if (s.track?.kind === 'audio') s.track.enabled = shouldEnable;
            });
        }
        setIsMuted(!shouldEnable);
    }, [isMuted, localStream]);

    const toggleCamera = useCallback(() => {
        const shouldEnable = isCameraOff;
        if (localStream) {
            localStream.getVideoTracks().forEach(t => { t.enabled = shouldEnable; });
        }
        if (peerConnection.current) {
            peerConnection.current.getSenders().forEach(s => {
                if (s.track?.kind === 'video') s.track.enabled = shouldEnable;
            });
        }
        setIsCameraOff(!shouldEnable);
    }, [isCameraOff, localStream]);

    const toggleScreenShare = useCallback(async () => {
        if (!peerConnection.current) return;
        if (isScreenSharing) {
            const cam = cameraTrackRef.current;
            if (cam) {
                const sender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
                if (sender) await sender.replaceTrack(cam);
                if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
            }
            screenStreamRef.current?.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
            setIsScreenSharing(false);
        } else {
            try {
                const ss = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
                screenStreamRef.current = ss;
                const st = ss.getVideoTracks()[0];
                const sender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
                if (sender) await sender.replaceTrack(st);
                if (localVideoRef.current) localVideoRef.current.srcObject = ss;
                st.onended = () => { toggleScreenShare(); };
                setIsScreenSharing(true);
            } catch (e) { console.error('[CallCtx] Screen share error:', e); }
        }
    }, [isScreenSharing, localStream]);

    const unblockAudio = useCallback(() => {
        remoteAudioRef.current?.play().then(() => setAudioBlocked(false)).catch(console.error);
        remoteVideoRef.current?.play().then(() => setAudioBlocked(false)).catch(console.error);
    }, []);

    return (
        <CallContext.Provider value={{
            calling, incomingCall, callAccepted,
            localStream, remoteStream,
            isMuted, isCameraOff, isScreenSharing, primaryView, audioBlocked,
            localVideoRef, remoteVideoRef, remoteAudioRef,
            startCall, answerCall, declineCall, endCall,
            toggleMute, toggleCamera, toggleScreenShare,
            setPrimaryView, unblockAudio,
        }}>
            {children}
        </CallContext.Provider>
    );
};
