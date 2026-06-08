const mongoose = require('mongoose');
const { users, referrals, contracts, settings } = require('../models/db');
const REFERRAL_QUERY_TIMEOUT_MS = Math.max(800, Number(process.env.REFERRAL_QUERY_TIMEOUT_MS || 2000));
const REFERRAL_BACKFILL_MAX_PENDING = Math.max(25, Number(process.env.REFERRAL_BACKFILL_MAX_PENDING || 250));
const REFERRAL_BACKFILL_MAX_REWARDS_PER_RUN = Math.max(10, Number(process.env.REFERRAL_BACKFILL_MAX_REWARDS_PER_RUN || 100));

const buildIdVariants = (id) => {
    const variants = [];
    if (!id) return variants;
    const str = typeof id === 'string' ? id : id.toString();
    variants.push(str, id);
    if (mongoose.Types.ObjectId.isValid(str)) {
        variants.push(new mongoose.Types.ObjectId(str));
    }
    return variants;
};

const getReferralBonusCredits = async () => {
    const siteSettings = await settings.findOne().select('referralBonusCredits').lean().maxTimeMS(REFERRAL_QUERY_TIMEOUT_MS);
    const parsed = Number(siteSettings?.referralBonusCredits);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(0, Math.floor(parsed));
};

const markReferralRewarded = async (referralDoc, bonus) => {
    const markResult = await referrals.updateOne(
        { _id: referralDoc._id, status: 'pending' },
        { $set: { status: 'rewarded', rewardType: 'credit', rewardedAt: new Date() } }
    ).maxTimeMS(REFERRAL_QUERY_TIMEOUT_MS);

    if (markResult.modifiedCount === 0) {
        return false;
    }

    if (bonus > 0) {
        await Promise.all([
            users.updateOne({ _id: referralDoc.referrerId }, { $inc: { referralCredits: bonus } }).maxTimeMS(REFERRAL_QUERY_TIMEOUT_MS),
            users.updateOne({ _id: referralDoc.referredUserId }, { $inc: { referralCredits: bonus } }).maxTimeMS(REFERRAL_QUERY_TIMEOUT_MS)
        ]);
    }

    return true;
};

const rewardReferralForFirstCompletedContract = async (referredUserId, completedContractId) => {
    const referredUser = await users.findOne({ _id: { $in: buildIdVariants(referredUserId) } })
        .select('_id referredByUserId')
        .lean()
        .maxTimeMS(REFERRAL_QUERY_TIMEOUT_MS);
    if (!referredUser || !referredUser.referredByUserId) {
        return { rewarded: false, reason: 'not_referred' };
    }

    const pendingReferral = await referrals.findOne({
        referrerId: referredUser.referredByUserId,
        referredUserId: referredUser._id,
        status: 'pending'
    }).sort({ createdAt: 1 }).maxTimeMS(REFERRAL_QUERY_TIMEOUT_MS);

    if (!pendingReferral) {
        return { rewarded: false, reason: 'no_pending_referral' };
    }

    const previousCompletedCount = await contracts.countDocuments({
        status: 'completed',
        _id: { $ne: completedContractId },
        $or: [
            { employerId: { $in: buildIdVariants(referredUser._id) } },
            { freelancerId: { $in: buildIdVariants(referredUser._id) } }
        ]
    }).maxTimeMS(REFERRAL_QUERY_TIMEOUT_MS);

    if (previousCompletedCount < 2) {
        return { rewarded: false, reason: 'need_3_completions' };
    }

    const bonus = await getReferralBonusCredits();
    const rewarded = await markReferralRewarded(pendingReferral, bonus);
    return { rewarded, reason: rewarded ? 'rewarded_after_3_completions' : 'already_processed', bonus };
};

const rewardReferralBonusesForCompletedContract = async (contractDoc) => {
    if (!contractDoc || !contractDoc._id || contractDoc.status !== 'completed') {
        return [];
    }

    const participants = [contractDoc.employerId, contractDoc.freelancerId]
        .filter(Boolean)
        .map((id) => id.toString());
    const uniqueParticipants = [...new Set(participants)];

    const results = [];
    for (const participantId of uniqueParticipants) {
        // eslint-disable-next-line no-await-in-loop
        const result = await rewardReferralForFirstCompletedContract(participantId, contractDoc._id);
        results.push({ participantId, ...result });
    }

    return results;
};

const backfillPendingReferralRewardsForReferrer = async (referrerId) => {
    const pending = await referrals.find({
        referrerId: { $in: buildIdVariants(referrerId) },
        status: 'pending'
    })
        .select('_id referrerId referredUserId createdAt')
        .sort({ createdAt: 1 })
        .limit(REFERRAL_BACKFILL_MAX_PENDING)
        .lean()
        .maxTimeMS(REFERRAL_QUERY_TIMEOUT_MS);

    if (!pending.length) return 0;

    const bonus = await getReferralBonusCredits();
    const processedReferred = new Set();
    const eligibleReferredIds = [];

    for (const referral of pending) {
        const referredKey = referral.referredUserId ? referral.referredUserId.toString() : '';
        if (!referredKey || processedReferred.has(referredKey)) continue;
        processedReferred.add(referredKey);
        eligibleReferredIds.push(referredKey);
    }

    if (!eligibleReferredIds.length) return 0;

    const idVariants = [];
    for (const referredKey of eligibleReferredIds) {
        idVariants.push(...buildIdVariants(referredKey));
    }

    const completedContracts = await contracts.find({
        status: 'completed',
        $or: [
            { employerId: { $in: idVariants } },
            { freelancerId: { $in: idVariants } }
        ]
    })
        .select('employerId freelancerId')
        .lean()
        .limit(REFERRAL_BACKFILL_MAX_PENDING * 20)
        .maxTimeMS(Math.max(REFERRAL_QUERY_TIMEOUT_MS, 3000));

    const completedParticipantIds = new Set();
    completedContracts.forEach(contract => {
        if (contract.employerId) completedParticipantIds.add(contract.employerId.toString());
        if (contract.freelancerId) completedParticipantIds.add(contract.freelancerId.toString());
    });

    let rewardedCount = 0;

    for (const referral of pending) {
        if (rewardedCount >= REFERRAL_BACKFILL_MAX_REWARDS_PER_RUN) break;
        const referredKey = referral.referredUserId ? referral.referredUserId.toString() : '';
        if (!referredKey || !completedParticipantIds.has(referredKey)) continue;

        // eslint-disable-next-line no-await-in-loop
        const rewarded = await markReferralRewarded(referral, bonus);
        if (rewarded) rewardedCount += 1;
    }

    return rewardedCount;
};

module.exports = {
    rewardReferralBonusesForCompletedContract,
    backfillPendingReferralRewardsForReferrer
};
