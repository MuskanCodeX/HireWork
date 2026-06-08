const rateLimit = require('express-rate-limit');
const { getClientIp, isPrivateIp } = require('./ipMiddleware');

const createIpRateLimiter = (options = {}) => {
    const {
        windowMs = 15 * 60 * 1000,
        max = 100,
        message = 'Too many requests from this IP',
        keyGenerator = (req) => getClientIp(req)
    } = options;

    const limiter = rateLimit({
        windowMs,
        max: (req, res) => {
            const ip = keyGenerator(req);
            
            if (isPrivateIp(ip)) {
                return max * 10;
            }
            
            return max;
        },
        message: { message, code: 'RATE_LIMIT_EXCEEDED' },
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req, res) => {
            const ip = keyGenerator(req);
            return isPrivateIp(ip);
        },
        keyGenerator
    });

    return limiter;
};

const strictIpLimiter = createIpRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 50,
    message: 'Too many requests. Your IP has been temporarily blocked.'
});

const registrationIpLimiter = createIpRateLimiter({
    windowMs: 24 * 60 * 60 * 1000,
    max: 50, // Increased for colleges/offices (was 5)
    message: 'Too many accounts created from this IP. Please try again tomorrow.'
});

const paymentIpLimiter = createIpRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many payment attempts from this IP.'
});

module.exports = {
    createIpRateLimiter,
    strictIpLimiter,
    registrationIpLimiter,
    paymentIpLimiter
};
