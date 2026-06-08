const { reviews, contracts, users } = require('../models/db');
const { computeTrustScore, getTrustBadge, toObjectId } = require('../utils/trustScore');
const { logActivity } = require('../utils/activityLogger');
const { trackCommunityAchievements } = require('../utils/achievementTracker');
const REVIEW_QUERY_TIMEOUT_MS = Math.max(1000, Number(process.env.REVIEW_QUERY_TIMEOUT_MS || 2500));

const clampSubRating = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    if (num < 1 || num > 5) return null;
    return num;
};

const recalculateTrustMetrics = async (userId) => {
    const objectId = toObjectId(userId);
    if (!objectId) return;

    const summary = await reviews.aggregate([
        { $match: { revieweeId: objectId } },
        {
            $group: {
                _id: '$revieweeId',
                avgRating: { $avg: '$rating' },
                reviewCount: { $sum: 1 },
                avgCommunication: { $avg: '$communicationRating' },
                avgQuality: { $avg: '$qualityRating' },
                avgTimeliness: { $avg: '$timelinessRating' },
                recommendations: { $sum: { $cond: ['$wouldRecommend', 1, 0] } },
                onTimeDeliveries: { $sum: { $cond: ['$deliveredOnTime', 1, 0] } },
                lastReviewAt: { $max: '$createdAt' }
            }
        }
    ]).option({ maxTimeMS: REVIEW_QUERY_TIMEOUT_MS });

    const stats = summary[0];
    const userDoc = await users.findById(objectId).select('isAadhaarVerified role').lean();
    if (!userDoc) return;

    if (!stats) {
        await users.updateOne({ _id: objectId }, {
            $set: {
                avgRating: 0,
                reviewCount: 0,
                trustScore: 0,
                trustBadge: '',
                communicationRating: 0,
                qualityRating: 0,
                timelinessRating: 0,
                lastReviewAt: null
            }
        });
        return;
    }

    const {
        avgRating = 0,
        reviewCount = 0,
        avgCommunication = 0,
        avgQuality = 0,
        avgTimeliness = 0,
        recommendations = 0,
        lastReviewAt
    } = stats;

    const recommendationRate = reviewCount ? recommendations / reviewCount : 0;
    const trustScore = computeTrustScore({
        avgRating,
        reviewCount,
        communicationRating: avgCommunication || 0,
        qualityRating: avgQuality || 0,
        timelinessRating: avgTimeliness || 0,
        recommendationRate,
        isAadhaarVerified: userDoc.isAadhaarVerified
    });
    const trustBadge = getTrustBadge(trustScore, reviewCount);

    await users.updateOne({ _id: objectId }, {
        $set: {
            avgRating: Math.round((avgRating || 0) * 10) / 10,
            reviewCount,
            trustScore,
            trustBadge,
            communicationRating: Math.round((avgCommunication || 0) * 10) / 10,
            qualityRating: Math.round((avgQuality || 0) * 10) / 10,
            timelinessRating: Math.round((avgTimeliness || 0) * 10) / 10,
            lastReviewAt
        }
    });

    // Track community achievements after trust metrics update
    try {
        const updatedUser = await users.findById(objectId).lean();
        if (updatedUser) {
            await trackCommunityAchievements(objectId, {
                reviewCount: updatedUser.reviewCount || 0,
                avgRating: updatedUser.avgRating || 0,
                responseTimeAvg: updatedUser.responseTimeAvg || 0
            });
        }
    } catch (achievementErr) {
        console.error('[Achievement] Error tracking community achievements:', achievementErr.message);
    }
};

/**
 * POST /api/reviews
 * Body: { contractId, rating (1-5), comment }
 * Both employer and freelancer of a completed contract can submit a review for each other.
 */
const submitReview = async (req, res) => {
    const { contractId, rating, comment, communicationRating, qualityRating, timelinessRating, wouldRecommend, deliveredOnTime } = req.body;

    if (!contractId || !rating) {
        return res.status(400).json({ message: 'contractId and rating are required' });
    }

    const numRating = Number(rating);
    if (numRating < 1 || numRating > 5 || !Number.isInteger(numRating)) {
        return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
    }

    const contract = await contracts.findOne({ _id: contractId }).maxTimeMS(REVIEW_QUERY_TIMEOUT_MS);
    if (!contract) return res.status(404).json({ message: 'Contract not found' });

    if (contract.status !== 'completed') {
        return res.status(400).json({ message: 'Can only review after all milestones are completed' });
    }

    const isEmployer = contract.employerId.toString() === req.user._id.toString();
    const isFreelancer = contract.freelancerId.toString() === req.user._id.toString();

    if (!isEmployer && !isFreelancer) {
        return res.status(403).json({ message: 'Only participants can submit a review' });
    }

    const revieweeId = isEmployer ? contract.freelancerId : contract.employerId;
    const revieweeName = isEmployer ? contract.freelancerName : contract.employerName;
    const fieldToCheck = isEmployer ? 'reviewedByEmployer' : 'reviewedByFreelancer';
    const reviewerRole = isEmployer ? 'employer' : 'freelancer';
    const revieweeRole = isEmployer ? 'freelancer' : 'employer';
    const safeCommunication = clampSubRating(communicationRating);
    const safeQuality = clampSubRating(qualityRating);
    const safeTimeliness = clampSubRating(timelinessRating);

    // Create the review FIRST, then mark contract as reviewed
    // This prevents permanent review block if review creation fails
    let review;
    try {
        review = await reviews.create({
            contractId,
            projectId: contract.projectId,
            projectTitle: contract.projectTitle,
            reviewerId: req.user._id,
            reviewerName: req.user.name,
            revieweeId,
            revieweeName,
            reviewerRole,
            revieweeRole,
            amount: contract.amount,
            rating: numRating,
            comment: comment ? comment.trim() : '',
            communicationRating: safeCommunication,
            qualityRating: safeQuality,
            timelinessRating: safeTimeliness,
            wouldRecommend: Boolean(wouldRecommend),
            deliveredOnTime: Boolean(deliveredOnTime),
            createdAt: new Date(),
        });
    } catch (createErr) {
        return res.status(500).json({ message: 'Failed to create review. Please try again.' });
    }

    // [SECURITY] Atomic update to prevent race condition allowing multiple review spam
    const updateResult = await contracts.updateOne(
        { _id: contractId, [fieldToCheck]: { $ne: true } },
        { $set: { [fieldToCheck]: true } }
    ).maxTimeMS(REVIEW_QUERY_TIMEOUT_MS);

    if (updateResult.modifiedCount === 0) {
        // Already reviewed — clean up the duplicate and return error
        await reviews.deleteOne({ _id: review._id });
        return res.status(400).json({ message: 'You have already reviewed this contract' });
    }

    await logActivity(req.user._id, req.user.name, req.user.role, 'submitted_review', `Left a ${numRating}-star review for ${revieweeName}`, contract.projectId);

    const { pushNotification } = require('../utils/notificationPusher');
    await pushNotification(
        revieweeId,
        'info',
        'New Review Received',
        `${req.user.name} left you a ${numRating}-star review for "${contract.projectTitle}".`,
        `/profile/${revieweeId}`
    );

    try {
        await recalculateTrustMetrics(revieweeId);
    } catch (err) {
        console.error('[TRUST] Failed to update trust metrics:', err.message);
    }

    res.status(201).json(review);
};

/**
 * GET /api/reviews/:userId
 * Public endpoint — returns all reviews for a user (as freelancer or employer), sorted newest first.
 */
const getReviewsForUser = async (req, res) => {
    try {
        const userId = req.params.userId;

        // 1. Check if the reviewee (the user whose profile we are viewing) is active
        const reviewee = await users.findById(userId).select('status').lean();
        if (!reviewee || reviewee.status !== 'active') {
            return res.status(404).json({ message: 'User not found or inactive' });
        }

        // 2. Fetch reviews and filter out those where the REVIEWER is banned/inactive
        // We use an aggregate to join with the users collection for the reviewer status
        const userReviews = await reviews.aggregate([
            { $match: { revieweeId: toObjectId(userId) } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'reviewerId',
                    foreignField: '_id',
                    as: 'reviewerInfo'
                }
            },
            { $unwind: { path: '$reviewerInfo', preserveNullAndEmptyArrays: true } },
            { $match: { 'reviewerInfo.status': 'active' } },
            { $sort: { createdAt: -1 } }
        ]).option({ maxTimeMS: REVIEW_QUERY_TIMEOUT_MS });

        // Cleanup: remove the joined reviewerInfo if desired, or keep pertinent parts
        const cleanedReviews = userReviews.map(r => {
            const { reviewerInfo, ...rest } = r;
            return rest;
        });

        res.status(200).json(cleanedReviews);
    } catch (err) {
        console.error('[REVIEW] getReviewsForUser error:', err);
        res.status(500).json({ message: 'Failed to fetch reviews' });
    }
};

module.exports = { submitReview, getReviewsForUser };
