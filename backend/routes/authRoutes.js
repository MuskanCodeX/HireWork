const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const {
    registerUser, loginUser, getMe, updateProfile,
    getProfileById, uploadAvatar, uploadCover, uploadQr, profileUpload, qrUpload,
    purchaseBadge, createBadgeOrder, verifyBadgePayment,
    getReferralInfo, claimReferralCredit, redeemReferralCredits, googleAuth, googleCallback,
    purchaseCredits, createCreditOrder, verifyCreditPayment,
    sendOTP, resetPasswordWithOTP, getPaymentInfo, exchangeAuthCode
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { registrationIpLimiter, paymentIpLimiter } = require('../middleware/ipRateLimiter');

// Strict rate limiter for OTP endpoints
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 5 : 50,
    message: { message: 'Too many OTP requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Strict rate limiter for payment endpoints
const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 20 : 1000,
    message: { message: 'Too many payment attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Inject req.user if token exists, but do not fail if token is missing/invalid.
const optionalTokenMiddleware = async (req, res, next) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = { _id: decoded.id };
        } catch (error) {
            console.log('Optional token middleware: Invalid token, proceeding without user context.');
        }
    }
    next();
};

router.post('/register', registrationIpLimiter, asyncHandler(registerUser));
router.post('/login', asyncHandler(loginUser));
router.post('/google', asyncHandler(googleAuth));
router.post('/google/callback', asyncHandler(googleCallback));
router.post('/exchange', asyncHandler(exchangeAuthCode));
router.post('/send-otp', otpLimiter, asyncHandler(sendOTP));
router.post('/reset-password-otp', otpLimiter, asyncHandler(resetPasswordWithOTP));

router.get('/me', protect, asyncHandler(getMe));
router.put('/profile', protect, asyncHandler(updateProfile));
router.post('/upload-avatar', protect, profileUpload.single('avatar'), asyncHandler(uploadAvatar));
router.post('/upload-cover', protect, profileUpload.single('cover'), asyncHandler(uploadCover));
router.post('/upload-qr', protect, qrUpload.single('qr'), asyncHandler(uploadQr));
router.post('/create-badge-order', protect, paymentIpLimiter, asyncHandler(createBadgeOrder));
router.post('/verify-badge-payment', protect, paymentIpLimiter, asyncHandler(verifyBadgePayment));
router.post('/purchase-credits', protect, paymentIpLimiter, asyncHandler(purchaseCredits));
router.post('/create-credit-order', protect, paymentIpLimiter, asyncHandler(createCreditOrder));
router.post('/verify-credit-payment', protect, paymentIpLimiter, asyncHandler(verifyCreditPayment));
router.get('/referral-info', protect, asyncHandler(getReferralInfo));
router.post('/claim-referral-credit', protect, paymentIpLimiter, asyncHandler(claimReferralCredit));
router.post('/redeem-referral-credits', protect, paymentIpLimiter, asyncHandler(redeemReferralCredits));
router.get('/:id/payment-info', protect, asyncHandler(getPaymentInfo));

// Keep dynamic route last so static routes like /referral-info are not shadowed.
router.get('/:id', optionalTokenMiddleware, asyncHandler(getProfileById));

module.exports = router;
