const { 
    checkAllAchievements, 
    getUserAchievements, 
    getAchievementSummary,
    ACHIEVEMENT_DEFINITIONS 
} = require('../utils/achievementTracker');
const Achievement = require('../models/Achievement');

// Get all available achievement definitions
const getAchievementDefinitions = async (req, res) => {
    res.json({ 
        achievements: Object.entries(ACHIEVEMENT_DEFINITIONS).map(([id, def]) => ({
            id,
            ...def
        }))
    });
};

// Get user's achievements
const getMyAchievements = async (req, res) => {
    try {
        const achievements = await getUserAchievements(req.user._id);
        const summary = await getAchievementSummary(req.user._id);
        
        res.json({ 
            achievements,
            summary
        });
    } catch (err) {
        console.error('[Achievement] Error fetching achievements:', err.message);
        res.status(500).json({ message: 'Error fetching achievements' });
    }
};

// Get another user's achievements (public view)
const getUserAchievementsPublic = async (req, res) => {
    const { userId } = req.params;
    
    if (!userId) {
        return res.status(400).json({ message: 'userId is required' });
    }

    try {
        const achievements = await Achievement.find({ 
            userId, 
            isVisible: true,
            isCompleted: true 
        }).sort({ isPinned: -1, completedAt: -1 });
        
        const summary = await getAchievementSummary(userId);
        
        res.json({ 
            achievements,
            summary
        });
    } catch (err) {
        console.error('[Achievement] Error fetching public achievements:', err.message);
        res.status(500).json({ message: 'Error fetching achievements' });
    }
};

// Manually trigger achievement check (useful after major events)
const refreshAchievements = async (req, res) => {
    try {
        const newAchievements = await checkAllAchievements(req.user._id);
        const summary = await getAchievementSummary(req.user._id);
        
        res.json({ 
            message: 'Achievements refreshed',
            newAchievements: newAchievements.filter(a => a && a.isCompleted),
            summary
        });
    } catch (err) {
        console.error('[Achievement] Error refreshing achievements:', err.message);
        res.status(500).json({ message: 'Error refreshing achievements' });
    }
};

// Pin/unpin achievement
const togglePinAchievement = async (req, res) => {
    const { achievementId } = req.params;
    
    if (!achievementId) {
        return res.status(400).json({ message: 'achievementId is required' });
    }

    try {
        const achievement = await Achievement.findOne({ 
            _id: achievementId, 
            userId: req.user._id 
        });

        if (!achievement) {
            return res.status(404).json({ message: 'Achievement not found' });
        }

        achievement.isPinned = !achievement.isPinned;
        await achievement.save();

        res.json({ 
            message: achievement.isPinned ? 'Achievement pinned' : 'Achievement unpinned',
            achievement
        });
    } catch (err) {
        console.error('[Achievement] Error toggling pin:', err.message);
        res.status(500).json({ message: 'Error updating achievement' });
    }
};

// Hide/show achievement
const toggleVisibilityAchievement = async (req, res) => {
    const { achievementId } = req.params;
    
    if (!achievementId) {
        return res.status(400).json({ message: 'achievementId is required' });
    }

    try {
        const achievement = await Achievement.findOne({ 
            _id: achievementId, 
            userId: req.user._id 
        });

        if (!achievement) {
            return res.status(404).json({ message: 'Achievement not found' });
        }

        achievement.isVisible = !achievement.isVisible;
        await achievement.save();

        res.json({ 
            message: achievement.isVisible ? 'Achievement shown' : 'Achievement hidden',
            achievement
        });
    } catch (err) {
        console.error('[Achievement] Error toggling visibility:', err.message);
        res.status(500).json({ message: 'Error updating achievement' });
    }
};

// Get leaderboard (top users by achievement count)
const getLeaderboard = async (req, res) => {
    const { category = 'all', limit = 50 } = req.query;

    try {
        const User = require('../models/User');
        
        let sortCriteria = {};
        let filter = { status: 'active' };

        switch (category) {
            case 'projects':
                sortCriteria = { completedProjects: -1, trustScore: -1 };
                filter.completedProjects = { $gte: 1 };
                break;
            case 'earnings':
                sortCriteria = { totalEarnings: -1, trustScore: -1 };
                filter.totalEarnings = { $gte: 1000 };
                break;
            case 'achievements':
                sortCriteria = { achievementCount: -1, trustScore: -1 };
                filter.achievementCount = { $gte: 1 };
                break;
            case 'rating':
                sortCriteria = { avgRating: -1, reviewCount: -1 };
                filter.reviewCount = { $gte: 5 };
                filter.avgRating = { $gte: 4.0 };
                break;
            default:
                sortCriteria = { trustScore: -1, completedProjects: -1 };
        }

        const leaderboard = await User.find(filter)
            .select('name avatar role skills avgRating reviewCount trustScore trustBadge completedProjects totalEarnings earningsTier achievementCount isEarlyAdopter badge')
            .sort(sortCriteria)
            .limit(parseInt(limit))
            .lean();

        res.json({ 
            category,
            leaderboard: leaderboard.map((user, index) => ({
                rank: index + 1,
                ...user
            }))
        });
    } catch (err) {
        console.error('[Achievement] Error fetching leaderboard:', err.message);
        res.status(500).json({ message: 'Error fetching leaderboard' });
    }
};

module.exports = {
    getAchievementDefinitions,
    getMyAchievements,
    getUserAchievementsPublic,
    refreshAchievements,
    togglePinAchievement,
    toggleVisibilityAchievement,
    getLeaderboard
};
