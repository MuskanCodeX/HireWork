// Chat Moderation System
// Detects contact info sharing and uses AI for intent detection

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || '').trim();
const OLLAMA_MODEL = (process.env.OLLAMA_MODEL || 'llama3.2').trim();
const ENABLE_AI_INTENT_MODERATION = process.env.ENABLE_AI_INTENT_MODERATION === 'true';
const AI_INTENT_TIMEOUT_MS = Math.max(1000, Number(process.env.AI_INTENT_TIMEOUT_MS || 4000));
let hasWarnedMissingAiModerationConfig = false;

// =====================
// REGEX PATTERNS
// =====================

// Indian phone numbers (10 digits starting with 6,7,8,9)
const PHONE_REGEX = /(\+?91[-.\s]?)?[6-9]\d{9}/g;

// Email addresses
const EMAIL_REGEX = /\S+@\S+\.\S+/g;

// URLs (http, https)
const URL_REGEX = /(https?:\/\/)/gi;

// Messaging links
const MESSAGING_LINK_REGEX = /(wa\.me|t\.me|telegram\.me|discord\.gg|instagram\.com\/|fb\.com|messenger\.com)/gi;

// Contact keywords
const CONTACT_KEYWORDS = [
    'whatsapp', 'whats app', 'wa.me', 'call me', 'contact me',
    'telegram', 't.me', 'insta', 'instagram', 'send number',
    'msg me', 'dm me', 'text me', 'ping me', 'reach me',
    'my number', 'my phone', 'my mail', 'my email',
    'share number', 'share phone', 'share mail', 'share email',
    '+91', 'phone no', 'mobile no', 'call on', 'dial',
    'let me know your', 'give me your', 'drop your'
];

// Create regex from keywords
const CONTACT_KEYWORD_REGEX = new RegExp(
    CONTACT_KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
    'gi'
);

// =====================
// SPLIT PHONE DETECTION
// =====================

// Store for tracking partial phone numbers per user
const userPartialDigits = new Map();

// Max digits to track (10 digits = valid Indian phone)
const MAX_PARTIAL_DIGITS = 10;
const DIGIT_COMBINATION_TIMEOUT = 30000; // 30 seconds

class SplitPhoneDetector {
    constructor() {
        this.userDigits = new Map();
        this.userTimestamps = new Map();
    }

    // Add digits from a message
    addDigits(userId, newDigits) {
        const extractedDigits = newDigits.replace(/\D/g, '');
        if (!extractedDigits) return null;

        const now = Date.now();
        const userData = this.userDigits.get(userId) || { digits: '', timestamp: 0 };

        // Clear old data if timeout passed
        if (now - userData.timestamp > DIGIT_COMBINATION_TIMEOUT) {
            userData.digits = '';
        }

        // Append new digits
        userData.digits += extractedDigits;
        userData.timestamp = now;

        // Keep only last MAX_PARTIAL_DIGITS
        if (userData.digits.length > MAX_PARTIAL_DIGITS) {
            userData.digits = userData.digits.slice(-MAX_PARTIAL_DIGITS);
        }

        this.userDigits.set(userId, userData);

        // Check if valid Indian phone
        return this.checkValidPhone(userData.digits);
    }

    checkValidPhone(digits) {
        if (digits.length === 10 && /^[6-9]/.test(digits)) {
            return digits;
        }
        return null;
    }

    // Get combined digits for a user
    getCombinedDigits(userId) {
        const userData = this.userDigits.get(userId);
        if (!userData) return '';
        
        // Clear if timeout passed
        if (Date.now() - userData.timestamp > DIGIT_COMBINATION_TIMEOUT) {
            this.userDigits.delete(userId);
            return '';
        }
        
        return userData.digits;
    }

    // Clear user data
    clearUser(userId) {
        this.userDigits.delete(userId);
    }
}

const splitPhoneDetector = new SplitPhoneDetector();
const WARNING_EXPIRY_MS = 24 * 60 * 60 * 1000;

// =====================
// MODERATION RESULT
// =====================

class ModerationResult {
    constructor(allowed = true, reason = null, detectedType = null, severity = 'none') {
        this.allowed = allowed;
        this.reason = reason;
        this.detectedType = detectedType;
        this.severity = severity;
    }

    static allowed() {
        return new ModerationResult(true);
    }

    static blocked(reason, detectedType, severity = 'block') {
        return new ModerationResult(false, reason, detectedType, severity);
    }
}

// =====================
// WARNING SYSTEM
// =====================

class UserWarningSystem {
    constructor() {
        this.warnings = new Map();
    }

    // Warning thresholds
    static WARN_THRESHOLD = 1;  // First warning
    static BLOCK_THRESHOLD = 2;  // Second - block message
    static RESTRICT_THRESHOLD = 3; // Third - restrict chat

    // Get or create warning data for user
    getWarningData(userId) {
        if (!this.warnings.has(userId)) {
            this.warnings.set(userId, {
                count: 0,
                lastWarning: null,
                restricted: false,
                restrictUntil: null
            });
        }
        return this.warnings.get(userId);
    }

    // Record a violation
    recordViolation(userId) {
        const data = this.getWarningData(userId);
        data.count += 1;
        data.lastWarning = Date.now();

        // Check if should restrict
        if (data.count >= UserWarningSystem.RESTRICT_THRESHOLD) {
            data.restricted = true;
            // Restrict for 1 hour
            data.restrictUntil = Date.now() + (60 * 60 * 1000);
        }

        return {
            violationCount: data.count,
            isRestricted: data.restricted,
            severity: this.getSeverity(data.count)
        };
    }

    // Get severity level
    getSeverity(count) {
        if (count === 0) return 'none';
        if (count === 1) return 'warning';
        if (count === 2) return 'block';
        return 'restrict';
    }

    // Check if user is restricted
    isRestricted(userId) {
        const data = this.warnings.get(userId);
        if (!data || !data.restricted) return false;
        
        // Check if restriction expired
        if (data.restrictUntil && Date.now() > data.restrictUntil) {
            data.restricted = false;
            data.restrictUntil = null;
            // Reset count after restriction
            data.count = 0;
            return false;
        }
        
        return true;
    }

    // Get warning count for user
    getWarningCount(userId) {
        const data = this.warnings.get(userId);
        return data ? data.count : 0;
    }

    // Clear warnings (e.g., after project awarded)
    clearWarnings(userId) {
        this.warnings.delete(userId);
    }
}

const warningSystem = new UserWarningSystem();

// =====================
// PROJECT AWARD CHECK
// =====================

// Cache for checking if project is awarded
const projectAwardCache = new Map();
const PROJECT_CACHE_TTL = 60000; // 1 minute

const checkProjectAwarded = async (projectId, db) => {
    if (!projectId) return false;

    // Check cache first
    const cached = projectAwardCache.get(projectId);
    if (cached && Date.now() < cached.expiry) {
        return cached.awarded;
    }

    try {
        // Check contracts for this project
        const { contracts } = db;
        const awardedContract = await contracts.findOne({
            projectId: projectId,
            agreementStatus: 'accepted'
        }).lean();

        const awarded = !!awardedContract;

        // Cache result
        projectAwardCache.set(projectId, {
            awarded,
            expiry: Date.now() + PROJECT_CACHE_TTL
        });

        return awarded;
    } catch (error) {
        console.error('[MODERATION] Error checking project award:', error);
        return false;
    }
};

// Clear project cache (when project is awarded)
const clearProjectCache = (projectId) => {
    projectAwardCache.delete(projectId);
};

// =====================
// MAIN MODERATION FUNCTION
// =====================

const moderateMessage = async (message, userId, projectId, db) => {
    // Step 1: Check if user is restricted
    if (warningSystem.isRestricted(userId)) {
        return ModerationResult.blocked(
            'You have been temporarily restricted from chatting due to multiple violations. Please try again later.',
            'restricted',
            'restrict'
        );
    }

    // Step 2: Check if project is awarded (skip moderation after award)
    if (projectId) {
        const isAwarded = await checkProjectAwarded(projectId, db);
        if (isAwarded) {
            return ModerationResult.allowed();
        }
    }

    // Step 3: Check for contact keywords first (fast)
    const keywordMatch = message.match(CONTACT_KEYWORD_REGEX);
    if (keywordMatch) {
        const violation = warningSystem.recordViolation(userId);
        return ModerationResult.blocked(
            `Contact sharing detected: "${keywordMatch[0]}". Sharing contact details before project award is not allowed.`,
            'contact_keyword',
            violation.severity
        );
    }

    // Step 4: Check for Indian phone numbers
    const phoneMatches = message.match(PHONE_REGEX);
    if (phoneMatches) {
        const violation = warningSystem.recordViolation(userId);
        return ModerationResult.blocked(
            'Phone number detected. Sharing contact details before project award is not allowed.',
            'phone',
            violation.severity
        );
    }

    // Step 5: Check for split phone numbers
    const partialPhone = splitPhoneDetector.addDigits(userId, message);
    if (partialPhone) {
        const violation = warningSystem.recordViolation(userId);
        return ModerationResult.blocked(
            'Split phone number detected. Sharing contact details before project award is not allowed.',
            'split_phone',
            violation.severity
        );
    }

    // Step 6: Check for emails
    const emailMatch = message.match(EMAIL_REGEX);
    if (emailMatch) {
        const violation = warningSystem.recordViolation(userId);
        return ModerationResult.blocked(
            'Email address detected. Sharing contact details before project award is not allowed.',
            'email',
            violation.severity
        );
    }

    // Step 7: Check for URLs
    const urlMatch = message.match(URL_REGEX);
    if (urlMatch) {
        const violation = warningSystem.recordViolation(userId);
        return ModerationResult.blocked(
            'External link detected. Sharing links outside the platform before project award is not allowed.',
            'url',
            violation.severity
        );
    }

    // Step 8: Check for messaging app links
    const messagingMatch = message.match(MESSAGING_LINK_REGEX);
    if (messagingMatch) {
        const violation = warningSystem.recordViolation(userId);
        return ModerationResult.blocked(
            `Messaging link detected: "${messagingMatch[0]}". Sharing contact details before project award is not allowed.`,
            'messaging_link',
            violation.severity
        );
    }

    // Step 9: AI Intent Detection (only if all regex checks pass)
    try {
        const aiResult = await checkAIIntent(message);
        if (aiResult.shouldBlock) {
            const violation = warningSystem.recordViolation(userId);
            return ModerationResult.blocked(
                'This message appears to be attempting to share contact information. Sharing contact details before project award is not allowed.',
                'ai_detected',
                violation.severity
            );
        }
    } catch (error) {
        console.error('[MODERATION] AI check failed:', error);
        // Don't block if AI fails - allow message
    }

    // All checks passed - allow message
    return ModerationResult.allowed();
};

// =====================
// AI INTENT DETECTION
// =====================

let aiCache = new Map();
const AI_CACHE_TTL = 300000; // 5 minutes

setInterval(() => {
    const now = Date.now();

    for (const [userId, data] of warningSystem.warnings.entries()) {
        if (!data?.lastWarning || now - data.lastWarning > WARNING_EXPIRY_MS) {
            warningSystem.warnings.delete(userId);
        }
    }

    for (const [projectId, data] of projectAwardCache.entries()) {
        if (!data?.expiry || now > data.expiry) {
            projectAwardCache.delete(projectId);
        }
    }

    for (const [message, data] of aiCache.entries()) {
        if (!data?.expiry || now > data.expiry) {
            aiCache.delete(message);
        }
    }

    for (const [userId, data] of splitPhoneDetector.userDigits.entries()) {
        if (!data?.timestamp || now - data.timestamp > DIGIT_COMBINATION_TIMEOUT) {
            splitPhoneDetector.userDigits.delete(userId);
        }
    }
}, 15 * 60 * 1000);

const checkAIIntent = async (message) => {
    if (!ENABLE_AI_INTENT_MODERATION || !OLLAMA_BASE_URL) {
        if (!hasWarnedMissingAiModerationConfig) {
            hasWarnedMissingAiModerationConfig = true;
            console.log('[MODERATION] AI intent moderation disabled. Regex-based moderation remains active.');
        }
        return { shouldBlock: false, skipped: true };
    }

    // Check cache first
    const cached = aiCache.get(message);
    if (cached && Date.now() < cached.expiry) {
        return cached.result;
    }

    try {
        const prompt = `You are a moderation system.
Determine if the following message attempts to move conversation outside the platform or share contact information such as phone, WhatsApp, Telegram, email, or social media.

Reply ONLY with YES or NO.

Message: ${message}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), AI_INTENT_TIMEOUT_MS);
        const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.1,
                    top_p: 0.9
                }
            })
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.response?.trim().toUpperCase() || 'NO';

        const result = {
            shouldBlock: aiResponse === 'YES',
            response: aiResponse
        };

        // Cache result
        aiCache.set(message, {
            result,
            expiry: Date.now() + AI_CACHE_TTL
        });

        return result;
    } catch (error) {
        console.error('[MODERATION] AI Intent Check Error:', error.message || error);
        // Return safe default - don't block
        return { shouldBlock: false, error: error.message };
    }
};

// =====================
// HELPER FUNCTIONS
// =====================

// Get warning count for user
const getUserWarningCount = (userId) => {
    return warningSystem.getWarningCount(userId);
};

// Check if user is restricted
const isUserRestricted = (userId) => {
    return warningSystem.isRestricted(userId);
};

// Clear warnings (call when project is awarded)
const clearUserWarnings = (userId) => {
    warningSystem.clearWarnings(userId);
    splitPhoneDetector.clearUser(userId);
};

// Clear project cache
const clearProjectAwardCache = clearProjectCache;

// Get project award status
const getProjectAwardStatus = checkProjectAwarded;

// =====================
// EXPORTS
// =====================

module.exports = {
    moderateMessage,
    checkAIIntent,
    getUserWarningCount,
    isUserRestricted,
    clearUserWarnings,
    clearProjectAwardCache,
    getProjectAwardStatus,
    ModerationResult,
    warningSystem,
    splitPhoneDetector
};
