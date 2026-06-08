const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect } = require('../middleware/authMiddleware');
const {
    getAchievementDefinitions,
    getMyAchievements,
    getUserAchievementsPublic,
    refreshAchievements,
    togglePinAchievement,
    toggleVisibilityAchievement,
    getLeaderboard
} = require('../controllers/achievementController');

const router = express.Router();

// Get all available achievement definitions
router.get('/definitions', asyncHandler(getAchievementDefinitions));

// Get current user's achievements
router.get('/my', protect, asyncHandler(getMyAchievements));

// Get another user's public achievements
router.get('/user/:userId', asyncHandler(getUserAchievementsPublic));

// Refresh/recalculate user achievements
router.post('/refresh', protect, asyncHandler(refreshAchievements));

// Pin/unpin achievement
router.patch('/:achievementId/pin', protect, asyncHandler(togglePinAchievement));

// Hide/show achievement
router.patch('/:achievementId/visibility', protect, asyncHandler(toggleVisibilityAchievement));

// Get leaderboard
router.get('/leaderboard', asyncHandler(getLeaderboard));

module.exports = router;
