const jwt = require('jsonwebtoken');
const { users } = require('../models/db');

const authDebug = process.env.AUTH_DEBUG === 'true';
const authLog = (...args) => {
    if (authDebug) console.log(...args);
};
const LAST_ACTIVE_INTERVAL_MS = Math.max(60_000, Number(process.env.LAST_ACTIVE_UPDATE_INTERVAL_MS || 5 * 60 * 1000));
const lastActiveMap = new Map();

// [SECURITY] Cleanup old entries from lastActiveMap to prevent memory leak
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_MAP_SIZE = 10000;
setInterval(() => {
    const now = Date.now();
    let deleted = 0;
    for (const [key, timestamp] of lastActiveMap.entries()) {
        if (now - timestamp > LAST_ACTIVE_INTERVAL_MS * 2) {
            lastActiveMap.delete(key);
            deleted++;
        }
    }
    // If map is still too large, clear oldest entries
    if (lastActiveMap.size > MAX_MAP_SIZE) {
        const entries = Array.from(lastActiveMap.entries());
        entries.sort((a, b) => a[1] - b[1]);
        const toDelete = entries.slice(0, Math.floor(MAX_MAP_SIZE * 0.3));
        for (const [key] of toDelete) {
            lastActiveMap.delete(key);
        }
    }
    if (deleted > 0 || lastActiveMap.size > MAX_MAP_SIZE * 0.7) {
        console.log(`[AUTH] Cleaned up ${deleted} entries from lastActiveMap. Current size: ${lastActiveMap.size}`);
    }
}, CLEANUP_INTERVAL_MS);

const protect = async (req, res, next) => {
    let token;
    const authHeader = req.get('Authorization');

    try {
        if (authHeader && authHeader.startsWith('Bearer')) {
            token = authHeader.split(' ')[1];
            if (!token) return res.status(401).json({ message: 'Not authorized, no token' });
            
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                console.error('[Auth ERROR] JWT_SECRET not configured');
                return res.status(500).json({ message: 'Server configuration error' });
            }
            
            authLog('[Protect DEBUG] Verifying token...');
            const decoded = jwt.verify(token, secret);

            authLog('[Protect DEBUG] Token decoded. ID:', decoded.id);
            const User = require('../models/User');
            req.user = await User.findById(decoded.id).lean(); // Use .lean() for plain object

            if (req.user) {
                authLog('[Protect DEBUG] User found:', req.user._id);
                // Check badge expiration (minimal logic for now to avoid crashes)
                if (req.user.badge && req.user.badgeSubscriptionEnd) {
                    const now = new Date();
                    const end = new Date(req.user.badgeSubscriptionEnd);
                    if (now > end) {
                        authLog('[Protect DEBUG] Badge expired, unsetting.');
                        await User.updateOne({ _id: req.user._id }, { $unset: { badge: 1, badgeSubscriptionEnd: 1 } });
                        req.user.badge = '';
                    }
                }

                const { password, ...userWithoutPassword } = req.user;
                req.user = userWithoutPassword;

                const userKey = req.user._id?.toString?.();
                if (userKey) {
                    const nowTs = Date.now();
                    const lastTs = lastActiveMap.get(userKey) || 0;
                    if (nowTs - lastTs > LAST_ACTIVE_INTERVAL_MS) {
                        lastActiveMap.set(userKey, nowTs);
                        users.updateOne({ _id: userKey }, { $set: { lastActiveAt: new Date() } })
                            .catch((err) => console.warn('[AUTH] Failed to bump lastActiveAt:', err.message));
                    }
                }
                return next();
            } else {
                if (authDebug) console.warn('[Protect DEBUG] User NOT found in DB for ID:', decoded.id);
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }
        } else {
            return res.status(401).json({ message: 'Not authorized, no token' });
        }
    } catch (error) {
        console.error('[Protect ERROR] Authentication failed:', error.message);
        return res.status(error.name === 'TokenExpiredError' ? 401 : 500).json({
            message: 'Authentication check failed'
        });
    }
};

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Admins only' });
    }
};

module.exports = { protect, admin };
