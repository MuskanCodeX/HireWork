const mongoose = require('mongoose');

const isValidObjectId = (id) => {
    if (!id) return false;
    if (typeof id === 'string' && id.length !== 24) return false;
    return mongoose.Types.ObjectId.isValid(id);
};

const isValidObjectIdStrict = (id) => {
    if (!id) return false;
    const strId = String(id);
    if (strId.length !== 24) return false;
    return mongoose.Types.ObjectId.isValid(strId) && String(new mongoose.Types.ObjectId(strId)) === strId;
};

const sanitizeString = (str, maxLength = 1000) => {
    if (typeof str !== 'string') return '';
    return str.trim().slice(0, maxLength);
};

const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim().toLowerCase());
};

const isValidPhone = (phone) => {
    if (!phone || typeof phone !== 'string') return false;
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
};

const isValidBudget = (budget) => {
    const num = Number(budget);
    return Number.isFinite(num) && num > 0 && num <= 10000000;
};

const isValidAmount = (amount, min = 0, max = Infinity) => {
    const num = Number(amount);
    return Number.isFinite(num) && num >= min && num <= max;
};

const sanitizeHtml = (str) => {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};

const validateRequiredFields = (data, fields) => {
    const missing = [];
    for (const field of fields) {
        if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
            missing.push(field);
        }
    }
    return missing.length > 0 ? { valid: false, missing } : { valid: true };
};

module.exports = {
    isValidObjectId,
    isValidObjectIdStrict,
    sanitizeString,
    isValidEmail,
    isValidPhone,
    isValidBudget,
    isValidAmount,
    sanitizeHtml,
    validateRequiredFields
};
