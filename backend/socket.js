const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { messages } = require('./models/db');
const { hasActiveAgreementBetweenUsers } = require('./utils/agreementAccess');

const AGREEMENT_REQUIRED_REASON = 'agreement_required';

let io;
// [SECURITY] Only enable debug in development, never in production
const SOCKET_DEBUG = process.env.NODE_ENV !== 'production' && process.env.SOCKET_DEBUG === 'true';
const socketLog = (...args) => {
    if (SOCKET_DEBUG) console.log(...args);
};

// [SECURITY] Rate limiting for socket events
const messageTimestamps = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_MESSAGES_PER_MINUTE = 30;
const MAX_CALLS_PER_MINUTE = 10;

const checkRateLimit = (userId, eventType) => {
    const now = Date.now();
    const key = `${userId}:${eventType}`;
    const timestamps = messageTimestamps.get(key) || [];
    
    // Filter out old timestamps
    const recentTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    
    if (recentTimestamps.length >= (eventType === 'message' ? MAX_MESSAGES_PER_MINUTE : MAX_CALLS_PER_MINUTE)) {
        return false; // Rate limit exceeded
    }
    
    recentTimestamps.push(now);
    messageTimestamps.set(key, recentTimestamps);
    return true;
};

// Cleanup old rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of messageTimestamps.entries()) {
        const recent = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
        if (recent.length === 0) {
            messageTimestamps.delete(key);
        } else {
            messageTimestamps.set(key, recent);
        }
    }
}, 5 * 60 * 1000); // 5 minutes

// Keep track of which user is on which socket
// Map: userId -> socketId
const userSocketMap = new Map();

const initSocket = (server) => {
    // Build strict CORS origin list (no fallback to true)
    const clientUrl = (process.env.CLIENT_URL || '').trim();
    const allowedOrigins = [
        ...(clientUrl ? clientUrl.split(',').map(s => s.trim()) : []),
        "https://hirework-freelance-platform.vercel.app",
        "https://hirework-freelance-platform.vercel.app",
        "https://hirework-freelance-platform.vercel.app"
    ].filter(Boolean);

    socketLog('[Socket DEBUG] Allowed Origins:', allowedOrigins);

    if (process.env.NODE_ENV !== 'production') {
        allowedOrigins.push("http://localhost:5173", "http://localhost:5000");
    }

    io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                if (
                    allowedOrigins.includes(origin) ||
                    origin.endsWith('.vercel.app') ||
                    origin.includes('localhost')
                ) {
                    return callback(null, true);
                }
                return callback(new Error(`Blocked by Socket CORS: ${origin}`));
            },
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Authenticate socket connections via JWT
    io.use((socket, next) => {
        const token = (socket.handshake.auth?.token || '').trim();
        const secret = process.env.JWT_SECRET;

        if (!token) {
            console.error('[Socket ERROR] Authentication failed: Token missing');
            return next(new Error("Authentication required"));
        }

        if (!secret) {
            console.error('[Socket ERROR] JWT_SECRET not configured');
            return next(new Error("Server configuration error"));
        }

        try {
            const decoded = jwt.verify(token, secret);
            socket.userId = (decoded.id?.toString() || '').trim();
            if (!socket.userId) {
                console.error('[Socket ERROR] Invalid token payload: ID missing');
                return next(new Error("Invalid token payload"));
            }
            next();
        } catch (err) {
            console.error('[Socket ERROR] JWT verification failed:', err.message);
            return next(new Error("Invalid or expired token"));
        }
    });

    io.on("connection", (socket) => {
        const roomName = (socket.userId || '').trim();
        socketLog(`[Socket] Authenticated user ${socket.userId} connected: ${socket.id}`);

        if (SOCKET_DEBUG) {
            socket.onAny((event) => {
                socketLog(`[Socket EVENT] ${socket.userId} emitted: ${event}`);
            });
        }

        // HEARTBEAT
        socket.on("client_heartbeat", () => {
            socketLog(`[Socket HEARTBEAT] User ${socket.userId} is alive.`);
        });

        // AUTOMATIC REGISTRATION: Join room immediately on auth
        if (roomName) {
            // Keep only one active socket per user to avoid connection buildup on shared hosting.
            const previousSocketId = userSocketMap.get(socket.userId);
            if (previousSocketId && previousSocketId !== socket.id) {
                const previousSocket = io.sockets.sockets.get(previousSocketId);
                if (previousSocket) {
                    socketLog(`[Socket DEBUG] Disconnecting previous socket ${previousSocketId} for user ${socket.userId}`);
                    previousSocket.disconnect(true);
                }
            }

            socket.join(roomName);
            userSocketMap.set(socket.userId, socket.id);
            socketLog(`[Socket DEBUG] User ${socket.userId} auto-joined room '${roomName}'.`);
            socketLog(`[Socket DEBUG] Current rooms for socket ${socket.id}:`, Array.from(socket.rooms));
        }

        // Broadcast online users
        io.emit("online_users", Array.from(userSocketMap.keys()));

        // 1. Keep legacy event for compatibility
        socket.on("register_user", () => {
            socketLog(`[Socket DEBUG] register_user received (redundant for ${socket.userId})`);
        });

        // Get online users on demand
        socket.on("get_online_users", () => {
            socket.emit("online_users", Array.from(userSocketMap.keys()));
        });

        // 2. Joining a specific chat room (Internal tracking only)
        socket.on("join_chat", (chatRoomId) => {
            socketLog(`[Socket] Socket ${socket.id} focused chat with ${chatRoomId}`);
        });

        // 3. Sender emits a message to receiver
        socket.on("send_message", (data) => {
            try {
                // [SECURITY] Rate limiting
                if (!checkRateLimit(socket.userId, 'message')) {
                    socket.emit('rate_limit_exceeded', { message: 'Too many messages. Please slow down.' });
                    return;
                }

                // [SECURITY] Validate message data
                const { receiverId, messageObj } = data;
                if (!receiverId || !messageObj) {
                    return;
                }

                // [SECURITY] Validate message content length
                const content = messageObj.content || '';
                if (typeof content !== 'string' || content.length > 5000) {
                    socket.emit('error', { message: 'Message too long or invalid' });
                    return;
                }

                if (receiverId) {
                    io.to(receiverId.toString().trim()).emit("receive_message", messageObj);
                }
            } catch (e) {
                console.error('[Socket ERROR] send_message failed:', e.message);
            }
        });

        // 4. Voice/Video Call Signaling
        socket.on("call_user", async (data, ack) => {
            // [SECURITY] Rate limiting
            if (!checkRateLimit(socket.userId, 'call')) {
                socket.emit('rate_limit_exceeded', { message: 'Too many calls. Please slow down.' });
                return;
            }

            const safeAck = typeof ack === 'function' ? ack : () => { };
            const { to, fromName, type } = data || {};
            const senderId = socket.userId?.trim();
            const targetId = to?.toString().trim();

            socketLog(`[Socket DEBUG] Call request: ${senderId} -> ${targetId} (type: ${type})`);

            if (!targetId || !senderId || targetId === senderId) {
                socketLog(`[Socket DEBUG] Call ignored: invalid 'to' or self-call. to=${targetId}, sender=${senderId}`);
                safeAck({ ok: false, reason: 'invalid_target' });
                return;
            }

            const hasAccess = await hasActiveAgreementBetweenUsers(senderId, targetId);
            if (!hasAccess) {
                safeAck({ ok: false, reason: AGREEMENT_REQUIRED_REASON });
                return;
            }

            const roomName = targetId;
            // Check if target user is actually online/in room
            const roomClients = io.sockets.adapter.rooms.get(roomName);
            const receiverCount = roomClients ? roomClients.size : 0;
            socketLog(`[Socket DEBUG] Target room '${roomName}' has ${receiverCount} clients. Clients:`, roomClients ? Array.from(roomClients) : []);

            if (!receiverCount) {
                // Target is offline -> Missed Call
                (async () => {
                    try {
                        const content = type === 'video' ? '[MISSED_VIDEO_CALL]' : '[MISSED_VOICE_CALL]';
                        const msgData = {
                            senderId: senderId,
                            receiverId: targetId,
                            content,
                            createdAt: new Date(),
                            read: false
                        };
                        const savedMsg = await messages.create(msgData);
                        // Send it back to the caller so they see it in their chat history
                        io.to(senderId).emit("receive_message", savedMsg);
                    } catch (e) {
                        socketLog('[Socket ERROR] Failed to save offline missed call:', e);
                    }
                })();
                safeAck({ ok: false, reason: 'target_offline' });
                return;
            }

            io.to(roomName).emit("incoming_call", {
                fromId: senderId,
                fromName,
                type
            });
            socketLog(`[Socket DEBUG] 'incoming_call' emitted to room '${roomName}' from ${senderId}`);
            safeAck({ ok: true, deliveredTo: receiverCount });
        });

        socket.on("answer_call", async (data) => {
            const { to, accepted, type } = data;
            const senderId = socket.userId?.trim();
            socketLog(`[Socket DEBUG] Call answer by ${socket.userId} for ${to}, accepted: ${accepted}`);
            if (!to || !senderId) {
                return;
            }

            const hasAccess = await hasActiveAgreementBetweenUsers(senderId, to.toString().trim());
            if (!hasAccess) {
                socket.emit('call_access_denied', { reason: AGREEMENT_REQUIRED_REASON });
                return;
            }

            if (to) {
                io.to(to.toString()).emit("call_answered", { accepted });
                socketLog(`[Socket DEBUG] 'call_answered' emitted to ${to}`);

                if (!accepted && senderId) {
                    // Target declined -> Missed Call
                    (async () => {
                        try {
                            const content = type === 'video' ? '[MISSED_VIDEO_CALL]' : '[MISSED_VOICE_CALL]';
                            const msgData = {
                                senderId: to.toString(), // The person who initiated the call
                                receiverId: senderId,    // The person declining it
                                content,
                                createdAt: new Date(),
                                read: false
                            };
                            const savedMsg = await messages.create(msgData);
                            // Broadcast to both parties
                            io.to(senderId).emit("receive_message", savedMsg);
                            io.to(to.toString()).emit("receive_message", savedMsg);
                        } catch (e) {
                            socketLog('[Socket ERROR] Failed to save declined missed call:', e);
                        }
                    })();
                }
            }
        });

        socket.on("hangup", async (data) => {
            const { to, wasMissed, type } = data;
            const senderId = socket.userId?.trim();
            socketLog(`[Socket] Hangup from ${socket.userId} to ${to}`);
            if (!to || !senderId) {
                return;
            }

            const hasAccess = await hasActiveAgreementBetweenUsers(senderId, to.toString().trim());
            if (!hasAccess) {
                return;
            }

            if (to) {
                io.to(to.toString()).emit("call_ended");

                if (wasMissed && senderId) {
                    // Caller hung up before answering -> Missed Call
                    (async () => {
                        try {
                            const content = type === 'video' ? '[MISSED_VIDEO_CALL]' : '[MISSED_VOICE_CALL]';
                            const msgData = {
                                senderId: senderId,
                                receiverId: to.toString(),
                                content,
                                createdAt: new Date(),
                                read: false
                            };
                            const savedMsg = await messages.create(msgData);
                            // Broadcast to both parties
                            io.to(senderId).emit("receive_message", savedMsg);
                            io.to(to.toString()).emit("receive_message", savedMsg);
                        } catch (e) {
                            socketLog('[Socket ERROR] Failed to save hung-up missed call:', e);
                        }
                    })();
                } else if (!wasMissed && senderId) {
                    // Call was answered and then hung up -> Completed Call
                    (async () => {
                        try {
                            const content = type === 'video' ? '[COMPLETED_VIDEO_CALL]' : '[COMPLETED_VOICE_CALL]';
                            const msgData = {
                                senderId: senderId, // Whoever hung up
                                receiverId: to.toString(), // The other participant
                                content,
                                createdAt: new Date(),
                                read: false
                            };
                            const savedMsg = await messages.create(msgData);
                            // Broadcast to both parties
                            io.to(senderId).emit("receive_message", savedMsg);
                            io.to(to.toString()).emit("receive_message", savedMsg);
                        } catch (e) {
                            socketLog('[Socket ERROR] Failed to save completed call:', e);
                        }
                    })();
                }
            }
        });

        // 5. WebRTC Signaling (SDP & ICE)
        socket.on("webrtc_signal", async (data) => {
            try {
                const { to, signal } = data;
                const senderId = socket.userId?.trim();
                const targetId = to?.toString().trim();
                if (targetId && senderId && targetId !== senderId) {
                    const hasAccess = await hasActiveAgreementBetweenUsers(senderId, targetId);
                    if (!hasAccess) {
                        socket.emit('call_access_denied', { reason: AGREEMENT_REQUIRED_REASON });
                        return;
                    }

                    socketLog(`[Socket DEBUG] WebRTC signal ${signal.type || (signal.candidate ? 'candidate' : 'unknown')} from ${senderId} to ${targetId}`);
                    io.to(targetId).emit("webrtc_signal", {
                        fromId: senderId,
                        signal
                    });
                }
            } catch (e) {
                console.error('[Socket ERROR] webrtc_signal failed:', e.message);
            }
        });

        socket.on("disconnect", () => {
            socketLog(`[Socket] User disconnected: ${socket.id}`);
            if (socket.userId) {
                // Delete mapping only if this socket is still the current one for the user.
                if (userSocketMap.get(socket.userId) === socket.id) {
                    userSocketMap.delete(socket.userId);
                }
                io.emit("online_users", Array.from(userSocketMap.keys()));
            }
        });
    });

    return io;
};

const getIo = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

module.exports = { initSocket, getIo };
