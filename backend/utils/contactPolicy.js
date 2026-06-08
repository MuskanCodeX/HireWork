const DEFAULT_WARNING_LIMIT = Number(process.env.CONTACT_WARNING_LIMIT || 2);
const CONTACT_WINDOW_MS = Number(process.env.CONTACT_WINDOW_MS || 15 * 60 * 1000);
const COOLDOWN_MS = Number(process.env.CONTACT_COOLDOWN_MS || 10 * 60 * 1000);

const userViolations = new Map();

const cleanupEntry = (entry, now) => {
    entry.warnings = (entry.warnings || []).filter(ts => now - ts <= CONTACT_WINDOW_MS);
    if (entry.blockedUntil && entry.blockedUntil <= now) {
        entry.blockedUntil = 0;
    }
    return entry;
};

const registerContactViolation = (userId, context = 'general') => {
    if (!userId) return { blocked: false, cooldownMs: 0, warnings: 0, context };
    const now = Date.now();
    let entry = userViolations.get(userId) || { warnings: [], blockedUntil: 0 };
    entry = cleanupEntry(entry, now);

    if (entry.blockedUntil && entry.blockedUntil > now) {
        return {
            blocked: true,
            cooldownMs: entry.blockedUntil - now,
            warnings: entry.warnings.length,
            context
        };
    }

    entry.warnings.push(now);
    let blocked = false;
    let cooldownMs = 0;

    if (entry.warnings.length >= DEFAULT_WARNING_LIMIT) {
        entry.blockedUntil = now + COOLDOWN_MS;
        entry.warnings = [];
        blocked = true;
        cooldownMs = COOLDOWN_MS;
    }

    userViolations.set(userId, entry);

    return {
        blocked,
        cooldownMs,
        warnings: entry.warnings.length,
        context
    };
};

const getContactCooldown = (userId) => {
    if (!userId) return { blocked: false, cooldownMs: 0 };
    const now = Date.now();
    const entry = cleanupEntry(userViolations.get(userId) || { warnings: [], blockedUntil: 0 }, now);
    if (entry.blockedUntil && entry.blockedUntil > now) {
        return { blocked: true, cooldownMs: entry.blockedUntil - now };
    }
    return { blocked: false, cooldownMs: 0 };
};

module.exports = {
    registerContactViolation,
    getContactCooldown
};
