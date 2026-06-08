const UserFeedback = require('../models/UserFeedback');

const submitFeedback = async (req, res) => {
    const { category, message, pagePath } = req.body || {};

    const trimmedMessage = String(message || '').trim();
    if (!trimmedMessage) {
        return res.status(400).json({ message: 'Please enter your feedback before submitting.' });
    }

    if (trimmedMessage.length > 2000) {
        return res.status(400).json({ message: 'Feedback must be 2000 characters or less.' });
    }

    const safeCategory = ['improvement', 'suggestion', 'bug', 'other'].includes(category)
        ? category
        : 'suggestion';

    const feedback = await UserFeedback.create({
        userId: req.user._id,
        userName: req.user.name || 'User',
        userEmail: req.user.email || '',
        userRole: req.user.role || 'user',
        category: safeCategory,
        message: trimmedMessage,
        pagePath: typeof pagePath === 'string' ? pagePath.slice(0, 300) : '',
    });

    res.status(201).json({
        message: 'Thanks for the feedback. We will review it soon.',
        feedbackId: feedback._id,
    });
};

const getAllFeedback = async (req, res) => {
    const { category, page = 1, limit = 20 } = req.query;
    
    const filter = {};
    if (category && ['improvement', 'suggestion', 'bug', 'other'].includes(category)) {
        filter.category = category;
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const feedback = await UserFeedback.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean();

    const total = await UserFeedback.countDocuments(filter);

    res.json({
        feedback,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
        }
    });
};

module.exports = {
    submitFeedback,
    getAllFeedback,
};
