const Achievement = require('../models/Achievement');
const User = require('../models/User');

// Achievement definitions
const ACHIEVEMENT_DEFINITIONS = {
    // Project milestones
    first_project: {
        title: 'First Steps',
        description: 'Complete your first project',
        icon: '🎯',
        category: 'project',
        tier: 'bronze',
        target: 1
    },
    projects_10: {
        title: 'Getting Started',
        description: 'Complete 10 projects',
        icon: '🚀',
        category: 'project',
        tier: 'silver',
        target: 10
    },
    projects_50: {
        title: 'Experienced Pro',
        description: 'Complete 50 projects',
        icon: '⭐',
        category: 'project',
        tier: 'gold',
        target: 50
    },
    projects_100: {
        title: 'Century Club',
        description: 'Complete 100 projects',
        icon: '💎',
        category: 'project',
        tier: 'platinum',
        target: 100
    },
    projects_500: {
        title: 'Master Freelancer',
        description: 'Complete 500 projects',
        icon: '👑',
        category: 'project',
        tier: 'diamond',
        target: 500
    },

    // Earnings milestones (in INR)
    earnings_bronze: {
        title: 'First Earnings',
        description: 'Earn ₹10,000 total',
        icon: '🥉',
        category: 'earnings',
        tier: 'bronze',
        target: 10000
    },
    earnings_silver: {
        title: 'Rising Star',
        description: 'Earn ₹50,000 total',
        icon: '🥈',
        category: 'earnings',
        tier: 'silver',
        target: 50000
    },
    earnings_gold: {
        title: 'High Earner',
        description: 'Earn ₹2,00,000 total',
        icon: '🥇',
        category: 'earnings',
        tier: 'gold',
        target: 200000
    },
    earnings_platinum: {
        title: 'Elite Earner',
        description: 'Earn ₹10,00,000 total',
        icon: '💰',
        category: 'earnings',
        tier: 'platinum',
        target: 1000000
    },

    // Verification achievements
    verified_email: {
        title: 'Email Verified',
        description: 'Verify your email address',
        icon: '✉️',
        category: 'verification',
        tier: 'bronze',
        target: 1
    },
    verified_phone: {
        title: 'Phone Verified',
        description: 'Verify your phone number',
        icon: '📱',
        category: 'verification',
        tier: 'bronze',
        target: 1
    },
    verified_aadhaar: {
        title: 'Identity Verified',
        description: 'Complete Aadhaar verification',
        icon: '🆔',
        category: 'verification',
        tier: 'silver',
        target: 1
    },
    verified_complete: {
        title: 'Fully Verified',
        description: 'Complete all verifications',
        icon: '✅',
        category: 'verification',
        tier: 'gold',
        target: 1
    },

    // Community achievements
    first_review: {
        title: 'First Feedback',
        description: 'Receive your first review',
        icon: '⭐',
        category: 'community',
        tier: 'bronze',
        target: 1
    },
    highly_rated: {
        title: 'Top Rated',
        description: 'Achieve 4.5+ average rating with 10+ reviews',
        icon: '🌟',
        category: 'community',
        tier: 'gold',
        target: 1
    },
    fast_responder: {
        title: 'Lightning Fast',
        description: 'Maintain average response time under 30 minutes',
        icon: '⚡',
        category: 'community',
        tier: 'silver',
        target: 1
    },

    // Special badges
    early_adopter: {
        title: 'Early Adopter',
        description: 'Joined HIREWORK in the first month',
        icon: '🎖️',
        category: 'special',
        tier: 'platinum',
        target: 1
    },
    badge_holder: {
        title: 'Premium Member',
        description: 'Purchase Pro or Expert badge',
        icon: '👑',
        category: 'special',
        tier: 'silver',
        target: 1
    }
};

// Calculate earnings tier based on total earnings
const calculateEarningsTier = (totalEarnings) => {
    if (totalEarnings >= 1000000) return 'platinum';
    if (totalEarnings >= 200000) return 'gold';
    if (totalEarnings >= 50000) return 'silver';
    if (totalEarnings >= 10000) return 'bronze';
    return '';
};

// Check if user qualifies for early adopter (joined within first 30 days of platform launch)
const checkEarlyAdopter = (userCreatedAt) => {
    // Set your platform launch date here
    const PLATFORM_LAUNCH_DATE = new Date('2026-02-01'); // Adjust this date
    const EARLY_ADOPTER_CUTOFF = new Date(PLATFORM_LAUNCH_DATE.getTime() + 30 * 24 * 60 * 60 * 1000);
    return new Date(userCreatedAt) <= EARLY_ADOPTER_CUTOFF;
};

// Update or create achievement for user
const updateAchievement = async (userId, achievementId, currentProgress) => {
    const definition = ACHIEVEMENT_DEFINITIONS[achievementId];
    if (!definition) return null;

    try {
        const isCompleted = currentProgress >= definition.target;
        
        // Check if achievement already exists to see if it was previously completed
        const existingAchievement = await Achievement.findOne({ userId, achievementId });
        const wasCompleted = existingAchievement?.isCompleted || false;

        const achievement = await Achievement.findOneAndUpdate(
            { userId, achievementId },
            {
                $set: {
                    title: definition.title,
                    description: definition.description,
                    icon: definition.icon,
                    category: definition.category,
                    tier: definition.tier,
                    targetProgress: definition.target,
                    currentProgress,
                    isCompleted,
                    ...(isCompleted && !wasCompleted ? { completedAt: new Date() } : {})
                }
            },
            { upsert: true, new: true }
        );

        return achievement;
    } catch (err) {
        console.error(`[Achievement] Error updating ${achievementId} for user ${userId}:`, err.message);
        return null;
    }
};

// Track project completion achievements
const trackProjectAchievements = async (userId, completedProjectCount) => {
    const achievements = [];
    
    if (completedProjectCount >= 1) {
        achievements.push(await updateAchievement(userId, 'first_project', completedProjectCount));
    }
    if (completedProjectCount >= 10) {
        achievements.push(await updateAchievement(userId, 'projects_10', completedProjectCount));
    }
    if (completedProjectCount >= 50) {
        achievements.push(await updateAchievement(userId, 'projects_50', completedProjectCount));
    }
    if (completedProjectCount >= 100) {
        achievements.push(await updateAchievement(userId, 'projects_100', completedProjectCount));
    }
    if (completedProjectCount >= 500) {
        achievements.push(await updateAchievement(userId, 'projects_500', completedProjectCount));
    }

    return achievements.filter(Boolean);
};

// Track earnings achievements
const trackEarningsAchievements = async (userId, totalEarnings) => {
    const achievements = [];
    
    if (totalEarnings >= 10000) {
        achievements.push(await updateAchievement(userId, 'earnings_bronze', totalEarnings));
    }
    if (totalEarnings >= 50000) {
        achievements.push(await updateAchievement(userId, 'earnings_silver', totalEarnings));
    }
    if (totalEarnings >= 200000) {
        achievements.push(await updateAchievement(userId, 'earnings_gold', totalEarnings));
    }
    if (totalEarnings >= 1000000) {
        achievements.push(await updateAchievement(userId, 'earnings_platinum', totalEarnings));
    }

    // Update earnings tier on user
    const tier = calculateEarningsTier(totalEarnings);
    await User.findByIdAndUpdate(userId, { 
        totalEarnings, 
        earningsTier: tier 
    });

    return achievements.filter(Boolean);
};

// Track verification achievements
const trackVerificationAchievements = async (userId, verificationStatus) => {
    const achievements = [];
    
    if (verificationStatus.isEmailVerified) {
        achievements.push(await updateAchievement(userId, 'verified_email', 1));
    }
    if (verificationStatus.isPhoneVerified) {
        achievements.push(await updateAchievement(userId, 'verified_phone', 1));
    }
    if (verificationStatus.isAadhaarVerified) {
        achievements.push(await updateAchievement(userId, 'verified_aadhaar', 1));
    }
    if (verificationStatus.isEmailVerified && verificationStatus.isPhoneVerified && verificationStatus.isAadhaarVerified) {
        achievements.push(await updateAchievement(userId, 'verified_complete', 1));
    }

    return achievements.filter(Boolean);
};

// Track community achievements
const trackCommunityAchievements = async (userId, userStats) => {
    const achievements = [];
    
    // First review
    if (userStats.reviewCount >= 1) {
        achievements.push(await updateAchievement(userId, 'first_review', userStats.reviewCount));
    }

    // Highly rated
    if (userStats.avgRating >= 4.5 && userStats.reviewCount >= 10) {
        achievements.push(await updateAchievement(userId, 'highly_rated', 1));
    }

    // Fast responder
    if (userStats.responseTimeAvg > 0 && userStats.responseTimeAvg <= 30) {
        achievements.push(await updateAchievement(userId, 'fast_responder', 1));
    }

    return achievements.filter(Boolean);
};

// Track special achievements
const trackSpecialAchievements = async (userId, userData) => {
    const achievements = [];
    
    // Early adopter
    if (checkEarlyAdopter(userData.createdAt)) {
        achievements.push(await updateAchievement(userId, 'early_adopter', 1));
        await User.findByIdAndUpdate(userId, { isEarlyAdopter: true });
    }

    // Badge holder
    if (userData.badge === 'Pro' || userData.badge === 'Expert') {
        achievements.push(await updateAchievement(userId, 'badge_holder', 1));
    }

    return achievements.filter(Boolean);
};

// Check all achievements for a user
const checkAllAchievements = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) return [];

        const allAchievements = [];

        // Project achievements
        allAchievements.push(...await trackProjectAchievements(userId, user.completedProjects || 0));

        // Earnings achievements
        allAchievements.push(...await trackEarningsAchievements(userId, user.totalEarnings || 0));

        // Verification achievements
        allAchievements.push(...await trackVerificationAchievements(userId, {
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
            isAadhaarVerified: user.isAadhaarVerified
        }));

        // Community achievements
        allAchievements.push(...await trackCommunityAchievements(userId, {
            reviewCount: user.reviewCount || 0,
            avgRating: user.avgRating || 0,
            responseTimeAvg: user.responseTimeAvg || 0
        }));

        // Special achievements
        allAchievements.push(...await trackSpecialAchievements(userId, user));

        // Update achievement count on user
        const completedCount = await Achievement.countDocuments({ userId, isCompleted: true });
        await User.findByIdAndUpdate(userId, { achievementCount: completedCount });

        return allAchievements;
    } catch (err) {
        console.error('[Achievement] Error checking achievements:', err.message);
        return [];
    }
};

// Get user's achievements
const getUserAchievements = async (userId) => {
    try {
        const achievements = await Achievement.find({ userId }).sort({ isPinned: -1, completedAt: -1 });
        return achievements;
    } catch (err) {
        console.error('[Achievement] Error getting achievements:', err.message);
        return [];
    }
};

// Get achievement progress summary
const getAchievementSummary = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) return null;

        const achievements = await Achievement.find({ userId });
        const completed = achievements.filter(a => a.isCompleted).length;
        const total = Object.keys(ACHIEVEMENT_DEFINITIONS).length;
        const inProgress = achievements.filter(a => !a.isCompleted && a.currentProgress > 0).length;

        return {
            completed,
            total,
            inProgress,
            completionPercentage: Math.round((completed / total) * 100),
            earningsTier: user.earningsTier || '',
            totalEarnings: user.totalEarnings || 0,
            completedProjects: user.completedProjects || 0,
            isEarlyAdopter: user.isEarlyAdopter || false
        };
    } catch (err) {
        console.error('[Achievement] Error getting summary:', err.message);
        return null;
    }
};

module.exports = {
    ACHIEVEMENT_DEFINITIONS,
    calculateEarningsTier,
    checkEarlyAdopter,
    updateAchievement,
    trackProjectAchievements,
    trackEarningsAchievements,
    trackVerificationAchievements,
    trackCommunityAchievements,
    trackSpecialAchievements,
    checkAllAchievements,
    getUserAchievements,
    getAchievementSummary
};
