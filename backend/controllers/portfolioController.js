const { portfolios, users } = require('../models/db');
const asyncHandler = require('express-async-handler');
const { logActivity } = require('../utils/activityLogger');
const { pushNotification } = require('../utils/notificationPusher');

// @desc    Submit a new portfolio item
// @route   POST /api/portfolio
// @access  Private
const submitPortfolio = asyncHandler(async (req, res) => {
    const { title, description, externalLink } = req.body;
    const images = req.files ? req.files.map(f => `/uploads/portfolio/${f.filename}`) : [];

    if (!title || !description) {
        res.status(400);
        throw new Error('Title and description are required');
    }

    const portfolio = await portfolios.create({
        user: req.user._id,
        title,
        description,
        externalLink,
        images,
        status: 'pending'
    });

    await logActivity(req.user._id, req.user.name, req.user.role, 'submitted_portfolio', `Submitted portfolio item: ${title}`);

    res.status(201).json(portfolio);
});

// @desc    Get user's own portfolio items (including pending/rejected)
// @route   GET /api/portfolio/me
// @access  Private
const getMyPortfolio = asyncHandler(async (req, res) => {
    const items = await portfolios.find({ user: req.user._id })
        .populate('user', 'name')
        .sort({ createdAt: -1 });
    res.json(items);
});

// @desc    Get public portfolio items for a user (only approved)
// @route   GET /api/portfolio/user/:userId
// @access  Public
const getUserPortfolio = asyncHandler(async (req, res) => {
    const items = await portfolios.find({
        user: req.params.userId,
        status: 'approved'
    })
        .populate('user', 'name')
        .sort({ createdAt: -1 });
    res.json(items);
});

// @desc    Get all pending portfolio items for admin review
// @route   GET /api/portfolio/admin/pending
// @access  Private/Admin
const getPendingPortfolios = asyncHandler(async (req, res) => {
    const items = await portfolios.find({ status: 'pending' })
        .populate('user', 'name email avatar')
        .sort({ createdAt: 1 });
    res.json(items);
});

// @desc    Approve or reject a portfolio item
// @route   PUT /api/portfolio/admin/:id/resolve
// @access  Private/Admin
const resolvePortfolio = asyncHandler(async (req, res) => {
    const { action, feedback } = req.body; // action: 'approve' or 'reject'
    const portfolio = await portfolios.findById(req.params.id);

    if (!portfolio) {
        res.status(404);
        throw new Error('Portfolio item not found');
    }

    if (action === 'approve') {
        portfolio.status = 'approved';
        portfolio.adminFeedback = '';
        await portfolio.save();

        await logActivity(req.user._id, req.user.name, req.user.role, 'approved_portfolio', `Approved portfolio item: ${portfolio.title}`, portfolio.user);

        await pushNotification(
            portfolio.user,
            'success',
            'Portfolio Approved',
            `Your portfolio item "${portfolio.title}" has been approved and is now live!`,
            '/profile'
        );

        res.json({ message: 'Portfolio item approved' });
    } else if (action === 'reject') {
        portfolio.status = 'rejected';
        portfolio.adminFeedback = feedback || 'No feedback provided.';
        await portfolio.save();

        await logActivity(req.user._id, req.user.name, req.user.role, 'rejected_portfolio', `Rejected portfolio item: ${portfolio.title}`, portfolio.user);

        await pushNotification(
            portfolio.user,
            'warning',
            'Portfolio Rejected',
            `Your portfolio item "${portfolio.title}" was rejected. Reason: ${portfolio.adminFeedback}`,
            '/profile'
        );

        res.json({ message: 'Portfolio item rejected' });
    } else {
        res.status(400);
        throw new Error('Invalid action');
    }
});

module.exports = {
    submitPortfolio,
    getMyPortfolio,
    getUserPortfolio,
    getPendingPortfolios,
    resolvePortfolio
};
