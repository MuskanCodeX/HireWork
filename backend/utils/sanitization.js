const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
};

const escapeHtml = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"'/]/g, char => HTML_ESCAPE_MAP[char] || char);
};

const sanitizeString = (str, maxLength = 10000) => {
    if (typeof str !== 'string') return str;
    return str.trim().slice(0, maxLength);
};

const sanitizeObject = (obj, fieldsToSanitize = []) => {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (fieldsToSanitize.includes(key) && typeof value === 'string') {
            sanitized[key] = escapeHtml(sanitizeString(value));
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
};

const sanitizeInput = (input, maxLength = 10000) => {
    if (typeof input === 'string') {
        return escapeHtml(sanitizeString(input, maxLength));
    }
    if (Array.isArray(input)) {
        return input.map(item => sanitizeInput(item, maxLength));
    }
    if (input && typeof input === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(input)) {
            sanitized[key] = sanitizeInput(value, maxLength);
        }
        return sanitized;
    }
    return input;
};

// Patterns to detect outside communication attempts (without global flag to avoid lastIndex issues)
const OUTSIDE_COMMUNICATION_PATTERNS = [
    // Phone numbers - various formats
    { pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/, type: 'phone', label: 'Phone Number' },
    { pattern: /\b\d{10}\b/, type: 'phone', label: 'Phone Number' },
    // Email addresses
    { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, type: 'email', label: 'Email Address' },
    // Instagram handles
    { pattern: /@[\w_.]{1,30}/, type: 'instagram', label: 'Instagram Handle' },
    { pattern: /\b(insta|instagram|ig|gram)\b/i, type: 'social_media', label: 'Instagram' },
    // WhatsApp
    { pattern: /\b(whatsapp|wa)\b[\s:.-]?\+?\d*/i, type: 'whatsapp', label: 'WhatsApp' },
    { pattern: /(\+?\d{1,3}[-.\s]?)?\d{10}[-.\s]?\d{0,5}/, type: 'phone_alt', label: 'Phone Number' },
    // Telegram
    { pattern: /\b(telegram|tg)\b[\s:.-]?@?[\w_]*/i, type: 'telegram', label: 'Telegram' },
    // Snapchat
    { pattern: /\b(snap|snapchat)\b/i, type: 'social_media', label: 'Snapchat' },
    // LinkedIn, Facebook, Twitter, X, Skype
    { pattern: /\b(linkedin|facebook|fb|twitter|tweet|skype)\b/i, type: 'social_media', label: 'Social Media' },
    // URLs (external links)
    { pattern: /https?:\/\/[^\s]+/, type: 'url', label: 'External Link' },
    { pattern: /www\.[^\s]+/i, type: 'url', label: 'External Link' },
    // Discord
    { pattern: /discord[\s:.-]?#?\d{0,4}/i, type: 'discord', label: 'Discord' },
    // Alternative ways to share contact
    { pattern: /\b(call|chat|msg|message|contact|reach|text|dm|pm)\s+(me|us|at|on|here|there)\b/i, type: 'contact_request', label: 'Contact Request' },
    { pattern: /\b(my number|my ph|my phone)\b/i, type: 'contact_request', label: 'Contact Request' },
    { pattern: /\b(hit me up|ping me)\b/i, type: 'contact_request', label: 'Contact Request' },
];

const WARNING_MESSAGE = '⚠️ WARNING: For your safety, please do not share contact information outside of HIREWORK. All communication should happen within our platform to ensure secure transactions and dispute resolution. Sharing personal contact information may result in account suspension.';

const normalizeText = (text) => {
    return text
        .toLowerCase()
        .replace(/zero/g, '0')
        .replace(/one/g, '1')
        .replace(/two/g, '2')
        .replace(/three/g, '3')
        .replace(/four/g, '4')
        .replace(/five/g, '5')
        .replace(/six/g, '6')
        .replace(/seven/g, '7')
        .replace(/eight/g, '8')
        .replace(/nine/g, '9')
        .replace(/[\s.-]+/g, ' ');
};

const detectOutsideCommunication = (text) => {
    if (!text || typeof text !== 'string') return null;
    const normalized = normalizeText(text);

    for (const { pattern, type, label } of OUTSIDE_COMMUNICATION_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags);
        if (regex.test(text) || regex.test(normalized)) {
            return {
                detected: true,
                type,
                label,
                message: WARNING_MESSAGE
            };
        }
    }
    return null;
};

const containsOutsideCommunication = (text) => {
    if (!text || typeof text !== 'string') return false;
    const normalized = normalizeText(text);

    for (const { pattern } of OUTSIDE_COMMUNICATION_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags);
        if (regex.test(text) || regex.test(normalized)) {
            return true;
        }
    }
    return false;
};

// Filter out contact info from text
const filterOutsideCommunication = (text) => {
    if (!text || typeof text !== 'string') return text;

    let filtered = text;
    for (const { pattern } of OUTSIDE_COMMUNICATION_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags);
        filtered = filtered.replace(regex, '[CONTACT REDACTED]');
    }
    return filtered;
};

module.exports = {
    escapeHtml,
    sanitizeString,
    sanitizeObject,
    sanitizeInput,
    detectOutsideCommunication,
    containsOutsideCommunication,
    filterOutsideCommunication,
    WARNING_MESSAGE
};
