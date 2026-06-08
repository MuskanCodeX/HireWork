const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    
    if (forwarded) {
        const ips = forwarded.split(',').map(ip => ip.trim());
        return ips[0];
    }
    
    if (realIp) {
        return realIp;
    }
    
    return req.ip || req.connection?.remoteAddress || 'unknown';
};

const ipMiddleware = (req, res, next) => {
    const clientIp = getClientIp(req);
    
    req.clientIp = clientIp;
    req.ipInfo = {
        ip: clientIp,
        userAgent: req.headers['user-agent'] || 'unknown',
        timestamp: new Date()
    };
    
    next();
};

const sanitizeIp = (ip) => {
    if (!ip || typeof ip !== 'string') return 'unknown';
    
    if (ip.startsWith('::ffff:')) {
        return ip.substring(7);
    }
    
    if (ip === '::1' || ip === '127.0.0.1') {
        return 'localhost';
    }
    
    return ip;
};

const isPrivateIp = (ip) => {
    if (!ip || ip === 'localhost' || ip === 'unknown') return true;
    
    const parts = ip.split('.');
    if (parts.length !== 4) return true;
    
    const first = parseInt(parts[0], 10);
    const second = parseInt(parts[1], 10);
    
    if (first === 10) return true;
    if (first === 172 && second >= 16 && second <= 31) return true;
    if (first === 192 && second === 168) return true;
    if (first === 127) return true;
    
    return false;
};

module.exports = {
    getClientIp,
    ipMiddleware,
    sanitizeIp,
    isPrivateIp
};
