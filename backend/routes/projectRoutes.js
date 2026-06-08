const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { createProject, getProjects, getRecommendedProjects, getProjectById, placeBid, getMyProjectBids, getMyProjects, debugMyProjects, deleteProject } = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');
const { createIpRateLimiter } = require('../middleware/ipRateLimiter');

// 10 bids per 15 minutes
const bidLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: 'Too many bids placed. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// 5 project creates per hour
const createProjectLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { message: 'Too many projects created. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// IP-based rate limiters for projects (increased for colleges/offices)
const projectIpLimiter = createIpRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 100, // Increased from 20
    message: 'Too many project actions from this IP.'
});

const bidIpLimiter = createIpRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 200, // Increased from 30
    message: 'Too many bid actions from this IP.'
});
router.get('/', asyncHandler(getProjects));
router.get('/my', protect, asyncHandler(getMyProjects));
router.get('/my-debug', protect, asyncHandler(debugMyProjects));
router.get('/feed/recommended', protect, asyncHandler(getRecommendedProjects));
router.post('/', protect, projectIpLimiter, createProjectLimiter, asyncHandler(createProject));
router.get('/:id', asyncHandler(getProjectById));
router.post('/:id/bid', protect, bidIpLimiter, bidLimiter, asyncHandler(placeBid));
router.get('/:id/bids', protect, asyncHandler(getMyProjectBids));
router.delete('/:id', protect, asyncHandler(deleteProject));

module.exports = router;
