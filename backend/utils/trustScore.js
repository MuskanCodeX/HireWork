const mongoose = require('mongoose');

const TRUST_BADGES = ['bronze', 'silver', 'gold', 'platinum'];

const getTrustBadge = (score = 0, reviews = 0) => {
    if (!reviews || reviews < 3) return '';
    if (score >= 85) return 'platinum';
    if (score >= 70) return 'gold';
    if (score >= 55) return 'silver';
    if (score >= 35) return 'bronze';
    return '';
};

const computeTrustScore = ({
    avgRating = 0,
    reviewCount = 0,
    communicationRating = 0,
    qualityRating = 0,
    timelinessRating = 0,
    recommendationRate = 0,
    isAadhaarVerified = false
}) => {
    const ratingWeight = (avgRating / 5) * 60;
    const reviewWeight = Math.min(reviewCount, 60) / 60 * 20;
    const reliabilityWeight = ((communicationRating + qualityRating + timelinessRating) / 15) * 10;
    const recommendationWeight = recommendationRate * 10;
    const verificationBonus = isAadhaarVerified ? 5 : 0;
    const score = ratingWeight + reviewWeight + reliabilityWeight + recommendationWeight + verificationBonus;
    return Math.min(100, Math.round(score));
};

const toObjectId = (id) => {
    try {
        return new mongoose.Types.ObjectId(id);
    } catch (err) {
        return null;
    }
};

module.exports = {
    TRUST_BADGES,
    computeTrustScore,
    getTrustBadge,
    toObjectId
};
