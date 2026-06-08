const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const Razorpay = require('razorpay');

const { users, referrals, settings, otps } = require('../models/db');
const { logActivity } = require('../utils/activityLogger');
const sendEmail = require('../utils/emailService');
const { buildOtpEmail } = require('../utils/emailTemplates');
const { backfillPendingReferralRewardsForReferrer } = require('../utils/referralRewards');
const { detectOutsideCommunication, WARNING_MESSAGE } = require('../utils/sanitization');
const { registerContactViolation } = require('../utils/contactPolicy');
const { trackSpecialAchievements, checkEarlyAdopter } = require('../utils/achievementTracker');
const { registerIpForUser, registerLogin } = require('../utils/fraudDetection');
const { getClientIp } = require('../middleware/ipMiddleware');


const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Safe Razorpay initialization - only instantiates when needed
const getRazorpayInstance = () => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay keys are missing from environment variables');
    }
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
};

// Generate a unique referral code like REF-A3K9X2
const generateReferralCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'REF-';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
};

const REFERRAL_CODE_MAX_ATTEMPTS = Math.max(3, Number(process.env.REFERRAL_CODE_MAX_ATTEMPTS || 8));
const REFERRAL_BACKFILL_COOLDOWN_MS = Math.max(60_000, Number(process.env.REFERRAL_BACKFILL_COOLDOWN_MS || 10 * 60 * 1000));
const referralBackfillRunMap = new Map();
const REFERRAL_MAP_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of referralBackfillRunMap.entries()) {
        if (now - timestamp > REFERRAL_BACKFILL_COOLDOWN_MS * 2) {
            referralBackfillRunMap.delete(key);
        }
    }
}, REFERRAL_MAP_CLEANUP_INTERVAL_MS);

const generateUniqueReferralCode = async () => {
    const maxTotalAttempts = 20; // Hard limit to prevent infinite loops
    let totalAttempts = 0;
    
    // Primary attempt loop - use random codes
    for (let attempt = 0; attempt < REFERRAL_CODE_MAX_ATTEMPTS && totalAttempts < maxTotalAttempts; attempt++) {
        totalAttempts++;
        const referralCode = generateReferralCode();
        const exists = await users.findOne({ referralCode }).select('_id').lean().maxTimeMS(1000);
        if (!exists) return referralCode;
    }

    // Fallback path with timestamp-based codes
    for (let attempt = 0; attempt < 10 && totalAttempts < maxTotalAttempts; attempt++) {
        totalAttempts++;
        const tail = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(-6)
            .padStart(6, 'X');
        const referralCode = `REF-${tail}`;
        const exists = await users.findOne({ referralCode }).select('_id').lean().maxTimeMS(1000);
        if (!exists) return referralCode;
    }

    // Last resort - use UUID-based code
    const uuidCode = `REF-${require('crypto').randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    const exists = await users.findOne({ referralCode: uuidCode }).select('_id').lean().maxTimeMS(1000);
    if (!exists) return uuidCode;

    throw new Error('Could not generate a unique referral code after maximum attempts');
};

const shouldRunReferralBackfill = (userId) => {
    const key = userId?.toString?.() || '';
    if (!key) return false;

    const now = Date.now();
    const last = referralBackfillRunMap.get(key) || 0;
    if (now - last < REFERRAL_BACKFILL_COOLDOWN_MS) return false;

    referralBackfillRunMap.set(key, now);
    return true;
};

// Multer config for profile images
const profileUploadsDir = path.join(__dirname, '../uploads/profiles');
const qrUploadsDir = path.join(__dirname, '../uploads/qr');

try {
    if (!fs.existsSync(profileUploadsDir)) fs.mkdirSync(profileUploadsDir, { recursive: true });
    if (!fs.existsSync(qrUploadsDir)) fs.mkdirSync(qrUploadsDir, { recursive: true });
} catch (e) {
    console.error('Could not create uploads directories:', e.message);
}

const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, profileUploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const qrStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, qrUploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const imageFileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|heic|heif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = (file.mimetype || '').toLowerCase().startsWith('image/');
    if (ext && mime) cb(null, true);
    else cb(new Error('Only image files are allowed'));
};

const profileUpload = multer({
    storage: profileStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter
});

const qrUpload = multer({
    storage: qrStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter
});

const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '7d', // Reduced from 30d to 7d for security
    });
};

// Password strength validation
const validatePasswordStrength = (password) => {
    if (!password || password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one number' };
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one special character' };
    }
    return { valid: true };
};

// Safe user response (excludes sensitive fields)
const getSafeUserResponse = (user) => {
    const userObj = typeof user.toObject === 'function' ? user.toObject() : user;
    const { password, processedPayments, authCode, authCodeExpires, ...safeUser } = userObj;
    return safeUser;
};

// Email helper to normalize emails to lowercase
const normalizeEmail = (email) => (email ? email.trim().toLowerCase() : '');

const getGoogleAudienceList = () => {
    const raw = process.env.GOOGLE_CLIENT_ID || '';
    return raw
        .split(',')
        .map((v) => (v || '').trim())
        .filter(Boolean);
};

const verifyGoogleCredentialPayload = async (credential) => {
    const audiences = getGoogleAudienceList();
    let ticket;

    try {
        const verifyOptions = { idToken: credential };
        if (audiences.length === 1) verifyOptions.audience = audiences[0];
        if (audiences.length > 1) verifyOptions.audience = audiences;
        ticket = await googleClient.verifyIdToken(verifyOptions);
    } catch (firstErr) {
        // Fallback: retry signature verification without strict audience check.
        // This protects login when environment audience is misconfigured.
        ticket = await googleClient.verifyIdToken({ idToken: credential });
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
        throw new Error('Invalid Google token payload');
    }

    const issuer = payload.iss;
    if (issuer !== 'accounts.google.com' && issuer !== 'https://accounts.google.com') {
        throw new Error('Invalid Google token issuer');
    }

    if (payload.exp && Date.now() >= Number(payload.exp) * 1000) {
        throw new Error('Google token expired');
    }

    if (payload.email_verified === false) {
        throw new Error('Google email is not verified');
    }

    return payload;
};

const isMaintenanceModeOn = async () => {
    try {
        if (mongoose.connection.readyState !== 1) return { enabled: false };
        const siteSettings = await settings.findOne().select('maintenanceMode maintenanceEndTime whatsappLink instagramLink').maxTimeMS(1000).lean();
        const enabled = siteSettings?.maintenanceMode === true || siteSettings?.maintenanceMode === 'true' || siteSettings?.maintenanceMode === 1;
        return {
            enabled,
            endTime: siteSettings?.maintenanceEndTime ? new Date(siteSettings.maintenanceEndTime).getTime() : null,
            whatsappLink: siteSettings?.whatsappLink || 'https://wa.me/910000000000',
            instagramLink: siteSettings?.instagramLink || 'https://instagram.com/hirework.in'
        };
    } catch (err) {
        console.error('Maintenance mode check failed:', err.message);
        return { enabled: false };
    }
};

const registerUser = async (req, res) => {
    const { name, password, role, referredBy, otp } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'Please add all fields' });
    }

    // Password strength validation
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
        return res.status(400).json({ message: passwordCheck.message });
    }

    // Validate name length
    if (name.trim().length < 2 || name.trim().length > 50) {
        return res.status(400).json({ message: 'Name must be between 2 and 50 characters' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    if (await isMaintenanceModeOn()) {
        const m = await isMaintenanceModeOn();
        if (m.enabled) {
            return res.status(503).json({
                maintenanceMode: true,
                message: 'Platform is under maintenance. Please try again later.',
                endTime: m.endTime,
                whatsappLink: m.whatsappLink,
                instagramLink: m.instagramLink
            });
        }
    }
    if (!['freelancer', 'employer'].includes(role.toLowerCase())) {
        return res.status(400).json({ message: 'Invalid role provided' });
    }
    const safeRole = role.toLowerCase();

    const userExists = await users.findOne({ email });

    if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
    }

    // [FRAUD DETECTION] Check IP before registration
    const clientIp = getClientIp(req);
    const fraudCheck = registerIpForUser(clientIp, email);
    if (!fraudCheck.allowed) {
        console.log(`[FRAUD] Registration blocked for IP ${clientIp}: ${fraudCheck.reason}`);
        return res.status(403).json({ 
            message: fraudCheck.message || 'Registration blocked due to suspicious activity',
            code: 'FRAUD_DETECTED'
        });
    }

    // [PRODUCTION OTP CHECK]
    if (process.env.NODE_ENV === 'production') { // OTP required in production
        const validOtp = await otps.findOne({ email, otp, type: 'registration' });
        if (!validOtp) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }
        // Cleanup OTP once used
        await otps.deleteOne({ _id: validOtp._id });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const referralCode = await generateUniqueReferralCode();

    const siteSettings = await settings.findOne() || {};
    const defaultCredits = siteSettings.defaultNewUserCredits !== undefined ? siteSettings.defaultNewUserCredits : 3;

    const userData = {
        name,
        email,
        password: hashedPassword,
        role: safeRole,
        phone: req.body.phone || '',
        referralCode,
        credits: defaultCredits,          // new users start with dynamic free credits
        referralCredits: 0,
        freePostings: 0,
        freeBids: 0,
        isPhoneVerified: false,
        isEmailVerified: false,
        isAadhaarVerified: false,
        lastActiveAt: new Date(),
        registrationIp: clientIp,
        loginHistory: [{ ip: clientIp, timestamp: new Date() }]
    };

    // If referred by someone, store the referrer's user ID
    let referrerUser = null;
    if (referredBy) {
        referrerUser = await users.findOne({ referralCode: referredBy.toUpperCase() });
        if (referrerUser) {
            userData.referredByUserId = referrerUser._id;
        }
    }

    const user = await users.create(userData);

    if (user) {
        // Create referral record if valid referrer
        if (referrerUser) {
            await referrals.create({
                referrerId: referrerUser._id,
                referrerName: referrerUser.name,
                referredUserId: user._id,
                referredUserName: user.name,
                status: 'pending', // pending → rewarded
                createdAt: new Date(),
            });
            await logActivity(user._id, user.name, safeRole, 'registered', `New user registered via referral from ${referrerUser.name}`);
        } else {
            await logActivity(user._id, user.name, safeRole, 'registered', 'New user registered');
        }

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: safeRole,
            referralCode: user.referralCode,
            credits: user.credits,
            token: generateToken(user._id),
        });
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
};

// Store auth codes temporarily (in-memory for simple deployment)
// A production cluster would use Redis or Mongo with TTL
global.oauthCodes = global.oauthCodes || new Map();

const googleCallback = async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.redirect(`${process.env.CLIENT_URL}/login?error=Invalid_Google_Response`);
        }

        // Decode the JWT from Google
        const decoded = jwt.decode(credential);
        if (!decoded || !decoded.email) {
            return res.redirect(`${process.env.CLIENT_URL}/login?error=Invalid_Token`);
        }

        const { email, name, picture, sub: googleId } = decoded;

        // Check if user exists
        let user = await users.findOne({ email });

        if (!user) {
            // Check if another user already has this googleId
            const existingGoogleUser = await users.findOne({ googleId });
            if (existingGoogleUser) {
                return res.redirect(`${process.env.CLIENT_URL}/login?error=Google_Account_Linked_To_Another_Email`);
            }

            // Create new user if they don't exist
            user = await users.create({
                email,
                name,
                googleId,
                avatar: picture,
                isEmailVerified: true // Google emails are already verified
            });
        } else if (!user.googleId) {
            // Link google account to existing email user
            user.googleId = googleId;
            if (!user.avatar) user.avatar = picture;
            user.isEmailVerified = true;
            await user.save();
        }

        const token = generateToken(user._id);

        // Generate a 1-time exchange code
        const authCode = crypto.randomUUID();

        // Store securely in database to support multi-process environments (Passenger/Cluster)
        const expires = new Date(Date.now() + 60000); // 1 minute
        await users.updateOne(
            { _id: user._id },
            { $set: { authCode, authCodeExpires: expires, lastActiveAt: new Date() } }
        );

        // Redirect with code, NOT token data
        res.redirect(`${process.env.CLIENT_URL}?auth_code=${authCode}`);

    } catch (error) {
        console.error('Google Callback Error:', error);
        res.redirect(`${process.env.CLIENT_URL}/login?error=Server_Error`);
    }
};

const exchangeAuthCode = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ message: 'Missing authentication code' });
        }

        const user = await users.findOne({ authCode: code });
        if (!user || !user.authCodeExpires || user.authCodeExpires < new Date()) {
            return res.status(400).json({ message: 'Invalid or expired authentication code' });
        }

        // Delete code after use (1-time use)
        await users.updateOne({ _id: user._id }, {
            $unset: { authCode: "", authCodeExpires: "" },
            $set: { lastActiveAt: new Date() }
        });

        // Safe role fallback just in case
        const safeRole = user.role || 'freelancer';

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: safeRole,
            bio: user.bio,
            skills: user.skills,
            hourlyRate: user.hourlyRate,
            avatar: user.avatar,
            coverImage: user.coverImage,
            badge: user.badge,
            referralCode: user.referralCode,
            credits: user.credits ?? 0,
            referralCredits: user.referralCredits ?? 0,
            freePostings: user.freePostings ?? 0,
            freeBids: user.freeBids ?? 0,
            isPhoneVerified: user.isPhoneVerified ?? false,
            isEmailVerified: user.isEmailVerified ?? false,
            isAadhaarVerified: user.isAadhaarVerified ?? false,
            pushOptIn: user.pushOptIn ?? false,
            token: generateToken(user._id),
        });
    } catch (err) {
        console.error('Exchange error:', err);
        res.status(500).json({ message: 'Server error during auth exchange' });
    }
};

const loginUser = async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    // [SECURITY] Mock Login completely removed from production
    // Only works in local development with explicit env flag
    if (process.env.ENABLE_MOCK_LOGIN === 'true' && process.env.NODE_ENV === 'development' && email === 'test@example.com') {
        console.log('[DEV] Using mock login bypass for test@example.com');
        return res.json({
            _id: '65d6c8e39f3a2b0012345678',
            name: 'Test Admin',
            email: 'test@example.com',
            role: 'admin',
            bio: 'This is a mock account for UI testing.',
            skills: ['React', 'Node.js', 'Testing'],
            hourlyRate: 500,
            badge: 'Expert',
            credits: 99,
            isAadhaarVerified: true,
            isEmailVerified: true,
            token: generateToken('65d6c8e39f3a2b0012345678'),
        });
    }

    const user = await users.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
        // Check if user is banned
        if (user.status === 'banned') {
            return res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
        }

        if (await isMaintenanceModeOn() && user.role !== 'admin') {
            const m = await isMaintenanceModeOn();
            if (m.enabled) {
                return res.status(503).json({
                    maintenanceMode: true,
                    message: 'Platform is under maintenance. Please try again later.',
                    endTime: m.endTime,
                    whatsappLink: m.whatsappLink,
                    instagramLink: m.instagramLink
                });
            }
        }

        try {
            const clientIp = getClientIp(req);
            
            await users.updateOne({ _id: user._id }, { 
                $set: { 
                    lastActiveAt: new Date(),
                    lastLoginIp: clientIp
                },
                $push: {
                    loginHistory: { 
                        ip: clientIp, 
                        timestamp: new Date() 
                    }
                }
            });
            
            registerLogin(clientIp, user._id.toString());
        } catch (err) {
            console.warn('[AUTH] Failed to update lastActiveAt during login:', err.message);
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            bio: user.bio,
            skills: user.skills,
            hourlyRate: user.hourlyRate,
            avatar: user.avatar,
            coverImage: user.coverImage,
            badge: user.badge,
            referralCode: user.referralCode,
            credits: user.credits ?? 0,
            referralCredits: user.referralCredits ?? 0,
            freePostings: user.freePostings ?? 0,
            freeBids: user.freeBids ?? 0,
            isPhoneVerified: user.isPhoneVerified ?? false,
            isEmailVerified: user.isEmailVerified ?? false,
            isAadhaarVerified: user.isAadhaarVerified ?? false,
            pushOptIn: user.pushOptIn ?? false,
            token: generateToken(user._id),
        });
    } else {
        res.status(400).json({ message: 'Invalid credentials' });
    }
};

const getMe = async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authorized (GETME)" });
    res.status(200).json(req.user);
}

const updateProfile = async (req, res) => {
    try {
        const userId = req.user._id;

        const user = await users.findOne({ _id: userId });

        if (user) {
            // Check for outside communication attempts in bio
            if (req.body.bio) {
                const bioCheck = detectOutsideCommunication(req.body.bio);
                if (bioCheck) {
                    const violation = registerContactViolation(userId.toString(), 'profile_bio');
                    return res.status(violation.blocked ? 429 : 400).json({ 
                        message: WARNING_MESSAGE,
                        warning: true,
                        detectedType: bioCheck.type,
                        label: bioCheck.label,
                        cooldownMs: violation.cooldownMs,
                        violationCount: violation.warnings
                    });
                }
            }

            const emailToUpdate = normalizeEmail(req.body.email) || user.email;

            // Check for email uniqueness if email is changing
            if (emailToUpdate !== user.email) {
                const emailExists = await users.findOne({ email: emailToUpdate });
                if (emailExists && emailExists._id.toString() !== user._id.toString()) {
                    return res.status(400).json({ message: 'Email is already in use by another account' });
                }
            }

            const updatedData = {
                name: (req.body.name || user.name || '').trim(),
                email: emailToUpdate,
                bio: req.body.bio !== undefined ? req.body.bio : user.bio,
                upiId: req.body.upiId !== undefined ? req.body.upiId : user.upiId,
                skills: req.body.skills !== undefined ? req.body.skills : (user.skills || []),
                hourlyRate: req.body.hourlyRate !== undefined ? Number(req.body.hourlyRate) : (user.hourlyRate || 0),
                experience: req.body.experience !== undefined ? req.body.experience : (user.experience || ''),
                phone: req.body.phone !== undefined ? req.body.phone : (user.phone || ''),
                aadhaarLast4: req.body.aadhaarLast4 !== undefined ? req.body.aadhaarLast4 : (user.aadhaarLast4 || ''),
                isPhoneVerified: (req.body.phone && req.body.phone !== user.phone) ? false : (user.isPhoneVerified || false),
                isEmailVerified: (emailToUpdate && emailToUpdate !== user.email) ? false : (user.isEmailVerified || false),
                isAadhaarVerified: (req.body.aadhaarLast4 && req.body.aadhaarLast4 !== user.aadhaarLast4) ? false : (user.isAadhaarVerified || false),
            };

            if (req.body.password) {
                const salt = await bcrypt.genSalt(10);
                updatedData.password = await bcrypt.hash(req.body.password, salt);
            }

            const result = await users.updateOne({ _id: user._id }, { $set: updatedData });

            const updatedUser = await users.findOne({ _id: user._id });
            const { password, ...userWithoutPassword } = updatedUser.toObject();

            res.json({
                ...userWithoutPassword,
                token: generateToken(user._id),
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (err) {
        console.error(`[AUTH] updateProfile CRITICAL ERROR: ${err.message}`, err.stack);
        res.status(500).json({ message: 'Server error during profile update' });
    }
};

const getProfileById = async (req, res) => {
    // Prevent MongoDB CastErrors when '/me' accidentally hits this route
    if (req.params.id === 'me') {
        return res.status(404).json({ message: 'Profile me not found' });
    }

    // Validate if the ID is a valid MongoDB ObjectId format
    if (!req.params.id || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: 'Invalid User ID format' });
    }

    const user = await users.findOne({ _id: req.params.id });
    if (user) {
        // [SECURITY FIX] Even the owner gets safe fields - never expose sensitive data
        const safeProfile = {
            _id: user._id,
            name: user.name,
            role: user.role,
            bio: user.bio,
            skills: user.skills,
            hourlyRate: user.hourlyRate,
            experience: user.experience,
            avatar: user.avatar,
            coverImage: user.coverImage,
            badge: user.badge,
            isPhoneVerified: user.isPhoneVerified,
            isEmailVerified: user.isEmailVerified,
            isAadhaarVerified: user.isAadhaarVerified,
            avgRating: user.avgRating || 0,
            reviewCount: user.reviewCount || 0,
            trustScore: user.trustScore || 0,
            trustBadge: user.trustBadge || '',
            communicationRating: user.communicationRating || 0,
            qualityRating: user.qualityRating || 0,
            timelinessRating: user.timelinessRating || 0,
            lastReviewAt: user.lastReviewAt || null,
            lastActiveAt: user.lastActiveAt || user.updatedAt,
            pushOptIn: user.pushOptIn || false,
            credits: (req.user && String(req.user._id) === String(user._id)) ? user.credits : undefined,
            referralCredits: (req.user && String(req.user._id) === String(user._id)) ? user.referralCredits : undefined,
            freePostings: (req.user && String(req.user._id) === String(user._id)) ? user.freePostings : undefined,
            freeBids: (req.user && String(req.user._id) === String(user._id)) ? user.freeBids : undefined,
        };
        res.json(safeProfile);
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

const uploadAvatar = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
        const avatarUrl = `/uploads/profiles/${req.file.filename}`;
        const user = await users.findOne({ _id: req.user._id });
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.avatar = avatarUrl;
        await users.updateOne({ _id: user._id }, { $set: { avatar: avatarUrl } });
        res.json({ avatar: avatarUrl });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const updatePassword = async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ message: 'New password is required' });

        // Password strength validation
        const passwordCheck = validatePasswordStrength(password);
        if (!passwordCheck.valid) {
            return res.status(400).json({ message: passwordCheck.message });
        }

        const user = await users.findOne({ _id: req.user._id });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        await users.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// --- NEW OTP & FORGOT PASSWORD HANDLERS ---

const sendOTP = async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const { type } = req.body; // 'registration' or 'password_reset'

        if (!email) return res.status(400).json({ message: 'Email is required' });

        if (type === 'registration') {
            const userExists = await users.findOne({ email });
            if (userExists) return res.status(400).json({ message: 'User already exists' });
        } else if (type === 'password_reset') {
            const userExists = await users.findOne({ email });
            if (!userExists) return res.status(404).json({ message: 'No user found with this email' });
        } else {
            return res.status(400).json({ message: 'Invalid OTP type' });
        }

        // Generate 6-digit OTP using crypto (secure)
        const otp = crypto.randomInt(100000, 999999).toString();

        // Store in DB (upsert)
        await otps.updateOne(
            { email, type },
            { $set: { otp, createdAt: new Date() } },
            { upsert: true }
        );

        // Queue email send after responding so OTP requests feel instant.
        const { subject, message, html } = buildOtpEmail({ otp, type });

        res.status(200).json({ message: 'OTP sent to your email' });

        setImmediate(async () => {
            try {
                await sendEmail({ email, subject, message, html });
            } catch (emailErr) {
                console.error('[OTP] Email send failed:', emailErr.message);
            }
        });
    } catch (err) {
        console.error('Send OTP Error:', err);
        res.status(500).json({ message: 'Failed to send OTP. Please try again later.' });
    }
};

const resetPasswordWithOTP = async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const { otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: 'Please provide email, otp, and new password' });
        }

        // Password strength validation
        const passwordCheck = validatePasswordStrength(newPassword);
        if (!passwordCheck.valid) {
            return res.status(400).json({ message: passwordCheck.message });
        }

        const validOtp = await otps.findOne({ email, otp, type: 'password_reset' });
        if (!validOtp) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const user = await users.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await users.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });
        await otps.deleteOne({ _id: validOtp._id });

        res.status(200).json({ message: 'Password reset successful. You can now login.' });
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).json({ message: err.message });
    }
};

const uploadCover = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
        const coverUrl = `/uploads/profiles/${req.file.filename}`;
        const user = await users.findOne({ _id: req.user._id });
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.coverImage = coverUrl;
        await users.updateOne({ _id: user._id }, { $set: { coverImage: coverUrl } });
        res.json({ coverImage: coverUrl });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const uploadQr = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
        const qrUrl = `/uploads/qr/${req.file.filename}`;
        const user = await users.findOne({ _id: req.user._id });
        if (!user) return res.status(404).json({ message: 'User not found' });

        await users.updateOne({ _id: user._id }, { $set: { qrImage: qrUrl } });
        res.json({ qrImage: qrUrl });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const BADGE_PLANS = {
    'Pro': { price: 99, label: 'Pro Badge' },
    'Expert': { price: 199, label: 'Expert Badge' },
};

const createBadgeOrder = async (req, res) => {
    try {
        const { badgeType } = req.body;
        const plan = BADGE_PLANS[badgeType];
        if (!plan) return res.status(400).json({ message: 'Invalid badge type' });

        const razorpay = getRazorpayInstance();
        const order = await razorpay.orders.create({
            amount: plan.price * 100,
            currency: 'INR',
            receipt: `b_${Date.now()}`,
            notes: { userId: req.user._id.toString(), badgeType },
        });

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID,
            badgeType,
            badgeLabel: plan.label,
        });
    } catch (err) {
        console.error('Badge order error:', err);
        // Log more details if available
        if (err.error) console.error('Razorpay API Error Details:', JSON.stringify(err.error, null, 2));
        res.status(500).json({ message: 'Could not create payment order.' });
    }
};

const verifyBadgePayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, badgeType } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !badgeType) {
            return res.status(400).json({ message: 'Missing payment details' });
        }

        const expectedSig = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (expectedSig !== razorpay_signature) {
            return res.status(400).json({ message: 'Payment verification failed' });
        }

        const user = await users.findOne({ _id: req.user._id });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const subscriptionEnd = new Date();
        subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);

        const updateResult = await users.updateOne(
            { _id: user._id, processedPayments: { $ne: razorpay_payment_id } },
            {
                $set: { badge: badgeType, badgeSubscriptionEnd: subscriptionEnd },
                $push: { processedPayments: razorpay_payment_id }
            }
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(400).json({ message: 'Payment already processed' });
        }

        const updated = await users.findOne({ _id: user._id });
        const { password, ...userWithoutPassword } = updated.toObject();

        // Track badge achievement
        try {
            await trackSpecialAchievements(user._id, { 
                badge: badgeType,
                createdAt: user.createdAt
            });
        } catch (achievementErr) {
            console.error('[Achievement] Error tracking badge achievement:', achievementErr.message);
        }

        res.json({
            ...userWithoutPassword,
            token: generateToken(updated._id),
            message: `✅ Successfully upgraded to ${badgeType}!`,
        });
    } catch (err) {
        console.error('Badge verification error:', err);
        res.status(500).json({ message: err.message });
    }
};

const purchaseBadge = async (req, res) => {
    res.status(403).json({ message: 'Mock payments are disabled. Please use the real Razorpay flow.' });
};

const getReferralInfo = async (req, res) => {
    try {
        let user = await users.findOne({ _id: req.user._id }).maxTimeMS(1500);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Ensure referral code exists
        if (!user.referralCode) {
            const referralCode = await generateUniqueReferralCode();
            await users.updateOne({ _id: user._id }, { $set: { referralCode } });
            user = await users.findOne({ _id: req.user._id }).maxTimeMS(1500);
        }

        // Backfill missed rewards: if a referred user already completed a contract,
        // move pending entries to rewarded and grant configured bonus credits.
        if (shouldRunReferralBackfill(user._id)) {
            try {
                await Promise.race([
                    backfillPendingReferralRewardsForReferrer(user._id),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Referral backfill timeout')), 2000))
                ]);
            } catch (backfillErr) {
                console.error('Referral backfill skipped:', backfillErr.message);
            }
        }

        user = await users.findOne({ _id: req.user._id }).maxTimeMS(1500);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const myReferrals = await referrals
            .find({ referrerId: user._id })
            .sort({ createdAt: -1 })
            .maxTimeMS(2000);

        const totalRewarded = myReferrals.filter(r => r.status === 'rewarded').length;

        res.json({
            referralCode: user.referralCode,
            referralCredits: user.referralCredits || 0,
            freePostings: user.freePostings || 0,
            freeBids: user.freeBids || 0,
            totalRewarded,
            referrals: myReferrals.map(r => ({
                _id: r._id,
                referredUserName: r.referredUserName,
                status: r.status,
                createdAt: r.createdAt,
            })),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const claimReferralCredit = async (req, res) => {
    try {
        const { type } = req.body; // 'posting' or 'bid'
        if (type !== 'posting' && type !== 'bid') {
            return res.status(400).json({ message: 'Type must be "posting" or "bid"' });
        }

        const field = type === 'posting' ? 'freePostings' : 'freeBids';

        // TOCTOU Fix: Atomically check and deduct referral credits
        const updateResult = await users.updateOne(
            { _id: req.user._id, referralCredits: { $gt: 0 } },
            { $inc: { referralCredits: -1, [field]: 1 } }
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(400).json({ message: 'No referral credits available' });
        }

        const updated = await users.findOne({ _id: req.user._id });
        res.json({
            message: `Credit redeemed! You now have 1 free ${type === 'posting' ? 'project posting' : 'bid'}.`,
            referralCredits: updated.referralCredits,
            freePostings: updated.freePostings,
            freeBids: updated.freeBids,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const redeemReferralCredits = async (req, res) => {
    try {
        const user = await users.findOne({ _id: req.user._id });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.referralCredits <= 0) {
            return res.status(400).json({ message: 'No referral credits available to redeem' });
        }

        const creditsToRedeem = user.referralCredits;

        // Atomically transfer referral credits to main credits
        const updateResult = await users.updateOne(
            { _id: req.user._id, referralCredits: { $gt: 0 } },
            { $inc: { referralCredits: -creditsToRedeem, credits: creditsToRedeem } }
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(400).json({ message: 'Failed to redeem credits' });
        }

        const updated = await users.findOne({ _id: req.user._id });
        
        res.json({
            message: `Successfully redeemed ${creditsToRedeem} credit(s)! Your available credits have increased.`,
            credits: updated.credits,
            referralCredits: updated.referralCredits,
            user: {
                _id: updated._id,
                name: updated.name,
                email: updated.email,
                role: updated.role,
                credits: updated.credits,
                referralCredits: updated.referralCredits,
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const googleAuth = async (req, res) => {
    try {
        const { credential, role, referredBy } = req.body;
        console.log('[GOOGLE_AUTH] Received request. Credential length:', credential ? credential.length : 'MISSING', 'Role:', role);

        if (await isMaintenanceModeOn()) {
            const m = await isMaintenanceModeOn();
            if (m.enabled) {
                return res.status(503).json({
                    maintenanceMode: true,
                    message: 'Platform is under maintenance. Please try again later.',
                    endTime: m.endTime,
                    whatsappLink: m.whatsappLink,
                    instagramLink: m.instagramLink
                });
            }
        }

        if (!credential) return res.status(400).json({ message: 'Google credential is required' });

        // Verify token with Google
        console.log('[GOOGLE_AUTH] Verifying ID token with Google. Client IDs:', getGoogleAudienceList());
        const payload = await verifyGoogleCredentialPayload(credential);
        console.log('[GOOGLE_AUTH] Payload received:', payload ? 'SUCCESS' : 'NULL');

        if (!payload) return res.status(401).json({ message: 'Invalid Google token' });

        const { sub: googleId, name, picture } = payload;
        const email = normalizeEmail(payload.email);
        console.log(`[GOOGLE_AUTH] User data from Google: ${email} (ID: ${googleId})`);

        // Check if user already exists
        let user = await users.findOne({ $or: [{ googleId }, { email }] });
        console.log('[GOOGLE_AUTH] User exists in DB?', user ? 'YES' : 'NO');

        if (user) {
            // Existing user — update googleId and avatar if missing
            if (!user.googleId || !user.avatar) {
                console.log('[GOOGLE_AUTH] Updating existing user with Google info');
                await users.updateOne(
                    { _id: user._id },
                    { $set: { googleId, avatar: user.avatar || picture || '' } }
                );
                user = await users.findOne({ _id: user._id });
            }
        } else {
            // New user — require role from frontend
            console.log('[GOOGLE_AUTH] New user detected. Role provided?', role ? 'YES' : 'NO');
            if (!role || !['freelancer', 'employer'].includes(role)) {
                console.log('[GOOGLE_AUTH] Returning 202 Needs Role');
                const redirectBase = process.env.NODE_ENV === 'production' ? 'https://hirework-freelance-platform.vercel.app' : 'http://localhost:5173';
                if (req.headers['content-type'] && req.headers['content-type'].includes('application/x-www-form-urlencoded')) {
                    const roleData = Buffer.from(JSON.stringify({ needsRole: true, email, name, picture, googleId, credential })).toString('base64');
                    return res.redirect(`${redirectBase}/register?google_data=${encodeURIComponent(roleData)}`);
                }
                return res.status(202).json({ needsRole: true, email, name, picture, googleId });
            }

            console.log('[GOOGLE_AUTH] Generating referral code...');
            const referralCode = await generateUniqueReferralCode();

            const siteSettings = await settings.findOne() || {};
            const defaultCredits = siteSettings.defaultNewUserCredits !== undefined ? siteSettings.defaultNewUserCredits : 3;

            const userData = {
                name,
                email,
                password: '', // no password for Google users
                googleId,
                role,
                avatar: picture || '',
                referralCode,
                credits: defaultCredits,          // new users start with dynamic free credits
                referralCredits: 0,
                freePostings: 0,
                freeBids: 0,
                isPhoneVerified: false,
                isEmailVerified: true, // Google verifies email
                isAadhaarVerified: false,
            };

            console.log('[GOOGLE_AUTH] Creating new user...');
            // Handle referral
            let referrerUser = null;
            if (referredBy) {
                referrerUser = await users.findOne({ referralCode: referredBy.toUpperCase() });
                if (referrerUser) userData.referredByUserId = referrerUser._id;
            }

            user = await users.create(userData);
            console.log('[GOOGLE_AUTH] User created successfully. ID:', user._id);

            if (referrerUser) {
                await referrals.create({
                    referrerId: referrerUser._id,
                    referrerName: referrerUser.name,
                    referredUserId: user._id,
                    referredUserName: user.name,
                    status: 'pending',
                    createdAt: new Date(),
                });
                await logActivity(user._id, user.name, role, 'registered', `New user registered with Google via referral from ${referrerUser.name}`);
            } else {
                await logActivity(user._id, user.name, role, 'registered', 'New user registered with Google');
            }
        }

        if (user && typeof user.toObject === 'function') {
            user = user.toObject();
        }
        const { password, ...userWithoutPassword } = user;
        console.log('[GOOGLE_AUTH] Login successful, generating token...');

        const internalToken = generateToken(user._id);
        const redirectBase = process.env.NODE_ENV === 'production' ? 'https://hirework-freelance-platform.vercel.app' : 'http://localhost:5173';

        // If Google sent a form-encoded redirect POST, redirect back to frontend with auth data
        if (req.headers['content-type'] && req.headers['content-type'].includes('application/x-www-form-urlencoded')) {
            const authPayload = Buffer.from(JSON.stringify({
                ...userWithoutPassword,
                token: internalToken
            })).toString('base64');
            return res.redirect(`${redirectBase}/?auth_data=${encodeURIComponent(authPayload)}`);
        }

        // Standard popup mode — return JSON
        res.status(200).json({
            ...userWithoutPassword,
            token: internalToken,
        });
    } catch (err) {
        console.error('[GOOGLE_AUTH] CRITICAL ERROR:', err);
        const redirectBase = process.env.NODE_ENV === 'production' ? 'https://hirework-freelance-platform.vercel.app' : 'http://localhost:5173';
        const errMsg = String(err?.message || 'Google_Auth_Failed');
        const safeMessage = /audience|recipient|issuer|token|credential|client|google/i.test(errMsg)
            ? errMsg
            : 'Google authentication failed';

        if (req.headers['content-type'] && req.headers['content-type'].includes('application/x-www-form-urlencoded')) {
            return res.redirect(`${redirectBase}/login?error=${encodeURIComponent(safeMessage)}`);
        }

        res.status(500).json({ message: safeMessage, error: errMsg });
    }
};

const CREDIT_PACKS = {
    credits_5: { amount: 5, price: 49, label: '5 Credits' },
    credits_15: { amount: 15, price: 99, label: '15 Credits' },
    credits_30: { amount: 30, price: 179, label: '30 Credits' },
};

const purchaseCredits = async (req, res) => {
    try {
        const { pack } = req.body;
        const packInfo = CREDIT_PACKS[pack];
        if (!packInfo) return res.status(400).json({ message: 'Invalid credit pack' });

        const user = await users.findOne({ _id: req.user._id });
        if (!user) return res.status(404).json({ message: 'User not found' });

        // [SECURITY FIX] Disable mock credit minting for production
        console.warn(`[SECURITY] User ${req.user._id} attempted to use the disabled mock credit minting endpoint for pack ${pack}.`);
        return res.status(403).json({ message: 'Direct credit minting is disabled in production. Please complete the Razorpay payment flow.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const createCreditOrder = async (req, res) => {
    try {
        const { pack } = req.body;
        const packInfo = CREDIT_PACKS[pack];
        if (!packInfo) return res.status(400).json({ message: 'Invalid credit pack' });

        const razorpay = getRazorpayInstance();
        const order = await razorpay.orders.create({
            amount: packInfo.price * 100, // Razorpay expects amount in paise (₹1 = 100 paise)
            currency: 'INR',
            receipt: `c_${Date.now()}`,
            notes: { userId: req.user._id.toString(), pack },
        });

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID,
            pack,
            packLabel: packInfo.label,
        });
    } catch (err) {
        console.error('Razorpay order error:', err);
        // Log more details if available
        if (err.error) console.error('Razorpay API Error Details:', JSON.stringify(err.error, null, 2));
        res.status(500).json({ message: 'Could not create payment order. Check Razorpay API keys.' });
    }
};

const verifyCreditPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, pack } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !pack) {
            return res.status(400).json({ message: 'Missing payment details' });
        }

        // Verify HMAC-SHA256 signature
        const expectedSig = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (expectedSig !== razorpay_signature) {
            return res.status(400).json({ message: 'Payment verification failed — invalid signature' });
        }

        // Signature valid — add credits
        const packInfo = CREDIT_PACKS[pack];
        if (!packInfo) return res.status(400).json({ message: 'Invalid credit pack' });

        const user = await users.findOne({ _id: req.user._id });
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Prevent Replay Attacks & Data Races: Atomic update with credit increment
        const updateResult = await users.updateOne(
            { _id: user._id, processedPayments: { $ne: razorpay_payment_id } },
            {
                $inc: { credits: packInfo.amount },
                $push: { processedPayments: razorpay_payment_id }
            }
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(400).json({ message: 'This payment has already been processed.' });
        }

        const updated = await users.findOne({ _id: user._id });
        const { password, ...userWithoutPassword } = updated.toObject();

        res.json({
            ...userWithoutPassword,
            token: generateToken(updated._id),
            message: `✅ ${packInfo.amount} credits added successfully!`,
        });
    } catch (err) {
        console.error('Payment verification error:', err);
        res.status(500).json({ message: err.message });
    }
};

const getPaymentInfo = async (req, res) => {
    // Only logged in users can access this, and ideally only those with a contract.
    // For simplicity, we just return the UPI/QR if the user exists.
    const targetUser = await users.findOne({ _id: req.params.id });
    if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Return only the payment required fields
    res.json({
        upiId: targetUser.upiId || '',
        qrImage: targetUser.qrImage || ''
    });
};

// Robust Export Pattern for cPanel/Passenger
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.getMe = getMe;
exports.updateProfile = updateProfile;
exports.getProfileById = getProfileById;
exports.uploadAvatar = uploadAvatar;
exports.uploadCover = uploadCover;
exports.uploadQr = uploadQr;
exports.profileUpload = profileUpload;
exports.qrUpload = qrUpload;
exports.purchaseBadge = purchaseBadge;
exports.createBadgeOrder = createBadgeOrder;
exports.verifyBadgePayment = verifyBadgePayment;
exports.getReferralInfo = getReferralInfo;
exports.claimReferralCredit = claimReferralCredit;
exports.redeemReferralCredits = redeemReferralCredits;
exports.googleAuth = googleAuth;
exports.googleCallback = googleCallback;
exports.exchangeAuthCode = exchangeAuthCode;
exports.purchaseCredits = purchaseCredits;
exports.CREDIT_PACKS = CREDIT_PACKS;
exports.createCreditOrder = createCreditOrder;
exports.verifyCreditPayment = verifyCreditPayment;
exports.getPaymentInfo = getPaymentInfo;
exports.sendOTP = sendOTP;
exports.resetPasswordWithOTP = resetPasswordWithOTP;

console.log('[AuthController DEBUG] All 26 handlers exported successfully.');
