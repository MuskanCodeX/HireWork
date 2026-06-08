const mongoose = require('mongoose');
const { contracts } = require('../models/db');
const GigOrder = require('../models/GigOrder');
const buildIdVariants = (id) => {
    if (!id) return [];
    const stringId = typeof id === 'string' ? id : id.toString();
    const variants = [stringId, id];
    if (mongoose.Types.ObjectId.isValid(stringId)) {
        variants.push(new mongoose.Types.ObjectId(stringId));
    }
    return variants;
};
const getActiveAgreementBetweenUsers = async (userA, userB) => {
    const userAVariants = buildIdVariants(userA);
    const userBVariants = buildIdVariants(userB);
    if (!userAVariants.length || !userBVariants.length) {
        return null;
    }
    return contracts.findOne({
        agreementStatus: 'accepted',
        status: 'active',
        $or: [
            { employerId: { $in: userAVariants }, freelancerId: { $in: userBVariants } },
            { employerId: { $in: userBVariants }, freelancerId: { $in: userAVariants } },
        ],
    }).lean();
};
const hasActiveAgreementBetweenUsers = async (userA, userB) => {
    const agreement = await getActiveAgreementBetweenUsers(userA, userB);
    if (agreement) return true;
    // Also grant access when an accepted (active) gig order exists between the two users
    const userAVariants = buildIdVariants(userA);
    const userBVariants = buildIdVariants(userB);
    if (!userAVariants.length || !userBVariants.length) return false;
    const gigOrder = await GigOrder.findOne({
        status: 'active',
        $or: [
            { buyerId: { $in: userAVariants }, sellerId: { $in: userBVariants } },
            { buyerId: { $in: userBVariants }, sellerId: { $in: userAVariants } },
        ],
    }).lean();
    return Boolean(gigOrder);
};
module.exports = {
    getActiveAgreementBetweenUsers,
    hasActiveAgreementBetweenUsers,
};
