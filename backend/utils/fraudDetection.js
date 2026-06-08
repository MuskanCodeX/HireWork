const { sanitizeIp, isPrivateIp } = require('../middleware/ipMiddleware');

const ipRegistry = new Map();
const userIpRegistry = new Map();

const MAX_ACCOUNTS_PER_IP = 50; // Increased for colleges/offices (was 3)
const MAX_IPS_PER_USER = 10; // Increased from 5
const REGISTRY_CLEANUP_INTERVAL = 60 * 60 * 1000;
const REGISTRY_EXPIRY = 24 * 60 * 60 * 1000;

const registerIpForUser = (ip, userId) => {
    if (isPrivateIp(ip) || ip === 'unknown') return { allowed: true, reason: 'private_ip' };
    
    const sanitizedIp = sanitizeIp(ip);
    
    if (!ipRegistry.has(sanitizedIp)) {
        ipRegistry.set(sanitizedIp, new Map());
    }
    
    const ipUsers = ipRegistry.get(sanitizedIp);
    const userCount = ipUsers.size;
    
    if (userCount >= MAX_ACCOUNTS_PER_IP) {
        console.log(`[FRAUD] Blocked: Too many accounts from IP ${sanitizedIp}. Current: ${userCount}`);
        return { 
            allowed: false, 
            reason: 'too_many_accounts',
            message: `Multiple accounts detected from this IP. Maximum ${MAX_ACCOUNTS_PER_IP} accounts allowed.`
        };
    }
    
    ipUsers.set(userId, Date.now());
    
    if (!userIpRegistry.has(userId)) {
        userIpRegistry.set(userId, new Set());
    }
    
    userIpRegistry.get(userId).add(sanitizedIp);
    
    return { allowed: true };
};

const registerLogin = (ip, userId) => {
    if (isPrivateIp(ip) || ip === 'unknown') return;
    
    const sanitizedIp = sanitizeIp(ip);
    
    if (!ipRegistry.has(sanitizedIp)) {
        ipRegistry.set(sanitizedIp, new Map());
    }
    
    const ipUsers = ipRegistry.get(sanitizedIp);
    if (!ipUsers.has(userId)) {
        ipUsers.set(userId, Date.now());
    }
};

const getIpAccountCount = (ip) => {
    const sanitizedIp = sanitizeIp(ip);
    const ipUsers = ipRegistry.get(sanitizedIp);
    return ipUsers ? ipUsers.size : 0;
};

const getUserIpCount = (userId) => {
    const userIps = userIpRegistry.get(userId);
    return userIps ? userIps.size : 0;
};

const checkFraudScore = (ip, userId) => {
    if (isPrivateIp(ip) || ip === 'unknown') return { score: 0, risks: [] };
    
    const sanitizedIp = sanitizeIp(ip);
    const risks = [];
    let score = 0;
    
    const ipAccountCount = getIpAccountCount(sanitizedIp);
    if (ipAccountCount > 1) {
        score += ipAccountCount * 10;
        risks.push(`Multiple accounts from same IP (${ipAccountCount})`);
    }
    
    const userIpCount = getUserIpCount(userId);
    if (userIpCount > MAX_IPS_PER_USER) {
        score += (userIpCount - MAX_IPS_PER_USER) * 5;
        risks.push(`User has ${userIpCount} different IPs`);
    }
    
    return { score, risks: risks.slice(0, 3) };
};

const cleanupRegistry = () => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [ip, users] of ipRegistry.entries()) {
        for (const [userId, timestamp] of users.entries()) {
            if (now - timestamp > REGISTRY_EXPIRY) {
                users.delete(userId);
                cleaned++;
                
                const userIps = userIpRegistry.get(userId);
                if (userIps) {
                    userIps.delete(ip);
                    if (userIps.size === 0) {
                        userIpRegistry.delete(userId);
                    }
                }
            }
        }
        
        if (users.size === 0) {
            ipRegistry.delete(ip);
        }
    }
    
    console.log(`[FRAUD] Registry cleanup: removed ${cleaned} old entries`);
};

setInterval(cleanupRegistry, REGISTRY_CLEANUP_INTERVAL);

const fraudReport = () => {
    return {
        totalTrackedIps: ipRegistry.size,
        totalTrackedUsers: userIpRegistry.size,
        highRiskIps: Array.from(ipRegistry.entries())
            .filter(([_, users]) => users.size > MAX_ACCOUNTS_PER_IP)
            .map(([ip, users]) => ({ ip, accountCount: users.size }))
    };
};

module.exports = {
    registerIpForUser,
    registerLogin,
    getIpAccountCount,
    getUserIpCount,
    checkFraudScore,
    fraudReport
};
