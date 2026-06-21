import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { API_BASE } from '../config';

// Create a context for the socket
interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    onlineUsers: string[];
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    onlineUsers: [],
});

// Custom hook to use the socket context
export const useSocket = () => {
    return useContext(SocketContext);
};

interface SocketProviderProps {
    children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
    const { user, login } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const [pathName, setPathName] = useState<string>(() => window.location.pathname || '/');
    const latestUserRef = useRef(user);
    const latestLoginRef = useRef(login);
    const userId = user?._id;
    const userToken = user?.token;
    const isSocketRoute = pathName === '/inbox' || pathName.startsWith('/messages/') || pathName.startsWith('/contract');
    const realtimeToggleRaw = String(import.meta.env.VITE_ENABLE_REALTIME ?? import.meta.env.VITE_ENABLE_REALTIM ?? '').toLowerCase();
    const realtimeEnabled = realtimeToggleRaw === '' ? true : ['1', 'true', 'yes', 'on'].includes(realtimeToggleRaw);
    const forceGlobalSocket = String(import.meta.env.VITE_SOCKET_GLOBAL || 'true').toLowerCase() !== 'false';
    const websocketOnly = String(import.meta.env.VITE_SOCKET_WEBSOCKET_ONLY || '').toLowerCase() === 'true';
    const socketPath = String(import.meta.env.VITE_SOCKET_PATH || '/socket.io').trim() || '/socket.io';
    const shouldConnectSocket = realtimeEnabled && (forceGlobalSocket || isSocketRoute);

    useEffect(() => {
        const timer = window.setInterval(() => {
            const current = window.location.pathname || '/';
            setPathName((prev) => (prev === current ? prev : current));
        }, 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        latestUserRef.current = user;
    }, [user]);

    useEffect(() => {
        latestLoginRef.current = login;
    }, [login]);

    useEffect(() => {
        if (userId && userToken && shouldConnectSocket) {
            // Always connect by origin (not /api path) to avoid accidental namespace mismatches.
            let socketOrigin = window.location.origin;
            try {
                socketOrigin = new URL(API_BASE, window.location.origin).origin;
            } catch (e) {
                socketOrigin = window.location.origin;
            }

            // Connect to the Socket.io server with auth token
            const newSocket = io(socketOrigin, {
                auth: { token: userToken },
                path: socketPath,
                // WebSocket preferred, polling fallback for hosts where WS upgrade is flaky.
                transports: websocketOnly ? ['websocket'] : ['websocket', 'polling'],
                upgrade: !websocketOnly,
                tryAllTransports: true,
                rememberUpgrade: true,
                reconnection: true,
                reconnectionAttempts: 20,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 15000,
                timeout: 10000
            });

            const onConnect = () => {
                console.log('[Socket DEBUG] Connected to server:', socketOrigin, 'path=', socketPath);
                setIsConnected(true);
                newSocket.emit('register_user');
                console.log('[Socket DEBUG] Emitted register_user');
            };

            (window as any).socket = newSocket;
            console.log('[Socket DEBUG] window.socket is now available.');

            const onDisconnect = () => {
                console.log('[Socket] Disconnected');
                setIsConnected(false);
            };

            const onConnectError = (err: Error) => {
                const msg = String(err?.message || '');
                console.error('[Socket] Connection error:', msg);

                // Invalid/expired token should not keep reconnecting forever.
                if (msg.includes('Authentication required') || msg.includes('Invalid or expired token')) {
                    newSocket.disconnect();
                    setIsConnected(false);
                }
            };

            newSocket.on('connect', onConnect);
            newSocket.on('disconnect', onDisconnect);
            newSocket.on('connect_error', onConnectError);
            newSocket.on('online_users', (users: string[]) => setOnlineUsers(users));
            newSocket.on('credits_updated', (newCredits: number) => {
                const latestUser = latestUserRef.current;
                if (latestUser) {
                    latestLoginRef.current({ ...latestUser, credits: newCredits } as any);
                }
            });

            // If already connected for some reason
            if (newSocket.connected) {
                onConnect();
            }

            setSocket(newSocket);

            // Cleanup on unmount or when user changes
            return () => {
                newSocket.off('connect', onConnect);
                newSocket.off('disconnect', onDisconnect);
                newSocket.off('connect_error', onConnectError);
                newSocket.off('online_users');
                newSocket.off('credits_updated');
                newSocket.disconnect();
            };
        } else {
            // If user logs out, disconnect socket
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setIsConnected(false);
            }
        }
    }, [userId, userToken, shouldConnectSocket]);

    const value = useMemo(() => ({ socket, isConnected, onlineUsers }), [socket, isConnected, onlineUsers]);

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};
