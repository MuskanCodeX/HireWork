const { projects } = require('../models/db');
const { logActivity } = require('../utils/activityLogger');
const { detectOutsideCommunication, WARNING_MESSAGE } = require('../utils/sanitization');
const { screenProjectContent, WARN_THRESHOLD, BLOCK_THRESHOLD } = require('../utils/aiAssistant');
const { requestRemoteRecommendations, buildUserVector, scoreProjectLocally, buildRecommendationPayload } = require('../utils/recommendationEngine');
const { registerContactViolation } = require('../utils/contactPolicy');

// Use console.log which is already redirected to server_logs.txt by index.js
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { pushNotification } = require('../utils/notificationPusher');

const buildIdVariants = (id) => {
    const variants = [];
    if (!id) return variants;
    const str = typeof id === 'string' ? id : id.toString();
    variants.push(str);
    if (mongoose.Types.ObjectId.isValid(str)) {
        variants.push(new mongoose.Types.ObjectId(str));
    }
    return variants;
};

const log = (msg) => {
    console.log(`[PROJECT] ${msg}`);
};
const PROJECT_QUERY_TIMEOUT_MS = Math.max(1200, Number(process.env.PROJECT_QUERY_TIMEOUT_MS || 3000));


const createProject = async (req, res) => {
    try {
        const { title, description, budget } = req.body;

        if (!title || !description || !budget) {
            return res.status(400).json({ message: 'Please add all fields' });
        }

        // [SECURITY] Validate and sanitize input
        if (typeof title !== 'string' || title.trim().length < 10 || title.trim().length > 200) {
            return res.status(400).json({ message: 'Title must be between 10 and 200 characters' });
        }

        if (typeof description !== 'string' || description.trim().length < 50 || description.trim().length > 5000) {
            return res.status(400).json({ message: 'Description must be between 50 and 5000 characters' });
        }

        const normalizedTitle = title.trim();
        const normalizedDescription = description.trim();

        const numBudget = Number(budget);
        if (isNaN(numBudget) || numBudget <= 0) {
            return res.status(400).json({ message: 'Budget must be a valid positive number' });
        }

        if (numBudget > 10000000) {
            return res.status(400).json({ message: 'Budget cannot exceed ₹1,00,00,000' });
        }

        // Check for outside communication attempts
        const titleCheck = detectOutsideCommunication(normalizedTitle);
        const descCheck = detectOutsideCommunication(normalizedDescription);

        if (titleCheck || descCheck) {
            const violation = registerContactViolation(req.user._id.toString(), 'project_text');
            return res.status(violation.blocked ? 429 : 400).json({
                message: WARNING_MESSAGE,
                warning: true,
                detectedType: titleCheck?.type || descCheck?.type,
                label: titleCheck?.label || descCheck?.label,
                cooldownMs: violation.cooldownMs,
                violationCount: violation.warnings,
                aiWarning: {
                    score: 60,
                    severity: 'warn',
                    flags: [titleCheck?.label || descCheck?.label].filter(Boolean),
                    notes: 'Patterns resembling contact info were detected. Remove phone numbers, emails, or social handles.'
                }
            });
        }

        const { users } = require('../models/db');
        const user = await users.findOne({ _id: req.user._id });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const ownerVerified = Boolean(user.isAadhaarVerified || user.isPhoneVerified);

        // Prevent accidental duplicate submissions caused by multiple clicks / slow networks
        const duplicateWindowMs = Math.max(15000, Number(process.env.PROJECT_DUPLICATE_WINDOW_MS || 60000));
        const duplicateSince = new Date(Date.now() - duplicateWindowMs);
        const recentDuplicate = await projects.findOne({
            user: req.user._id,
            title: normalizedTitle,
            description: normalizedDescription,
            createdAt: { $gte: duplicateSince }
        }).lean().maxTimeMS(PROJECT_QUERY_TIMEOUT_MS);

        if (recentDuplicate) {
            log(`Duplicate submission blocked for user ${req.user._id}. Reusing project ${recentDuplicate._id}`);
            return res.status(200).json({
                ...recentDuplicate,
                duplicate: true,
                ownerVerified,
                message: 'This project was already posted moments ago. We reused the existing entry.'
            });
        }

        // Check Monthly Job Posting Limits
        const currentDate = new Date();
        let jobsPostedThisMonth = user.jobsPostedThisMonth || 0;
        const lastJobPostDate = user.lastJobPostDate;

        // Reset if it's a different month or year
        if (lastJobPostDate && (
            currentDate.getMonth() !== lastJobPostDate.getMonth() ||
            currentDate.getFullYear() !== lastJobPostDate.getFullYear()
        )) {
            jobsPostedThisMonth = 0;
        }

        // Determine posting limit based on badge
        let limit = 10; // Normal
        if (user.badge === 'Pro' || user.badge === 'Expert') {
            limit = Infinity;
        }

        if (jobsPostedThisMonth >= limit) {
            return res.status(403).json({
                error_code: 'POST_LIMIT_REACHED',
                message: `Your limit of ${limit} job posts per month reached. Upgrade to Pro or Expert to get unlimited postings.`
            });
        }

        // Deductions removed: Posting is now free. Credits deducted only at contract stage.

        // AI Screening
        let aiScreening = null;
        try {
            aiScreening = await screenProjectContent({ title, description });
        } catch (screenErr) {
            console.warn('[PROJECT] AI screening failed, allowing fallback:', screenErr.message);
        }

        if (aiScreening && (aiScreening.blocked || aiScreening.score >= BLOCK_THRESHOLD)) {
            const violation = registerContactViolation(req.user._id.toString(), 'project_ai');
            return res.status(violation.blocked ? 429 : 400).json({
                message: 'AI Trust & Safety flagged this project. Please remove sensitive or off-platform requests before posting.',
                warning: true,
                cooldownMs: violation.cooldownMs,
                violationCount: violation.warnings,
                aiWarning: aiScreening
            });
        }

        // Slug generation
        let baseSlug = normalizedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        if (!baseSlug) baseSlug = 'project';
        let slug = baseSlug;
        const existingSlug = await projects.findOne({ slug }).select('_id').lean().maxTimeMS(PROJECT_QUERY_TIMEOUT_MS);
        if (existingSlug) {
            const shortId = Math.random().toString(36).substring(2, 8);
            slug = `${baseSlug}-${shortId}`;
        }

        const project = await projects.create({
            user: req.user._id,
            userName: req.user.name,
            userBadge: req.user.badge,
            title: normalizedTitle,
            slug,
            description: normalizedDescription,
            budget: numBudget,
            bids: [],
            createdAt: new Date(),
            aiScreening: aiScreening ? { ...aiScreening, checkedAt: new Date() } : undefined,
        });

        // Update user's posted jobs count
        await users.updateOne(
            { _id: req.user._id },
            {
                $set: {
                    jobsPostedThisMonth: jobsPostedThisMonth + 1,
                    lastJobPostDate: currentDate
                }
            }
        );

        await logActivity(req.user._id, req.user.name, req.user.role, 'posted_project', `Posted a new job: ${title}`, project._id);

        log(`Project created successfully: ${project._id} by ${req.user.name}`);
        const responseBody = project.toObject ? project.toObject() : project;
        if (aiScreening && aiScreening.score >= WARN_THRESHOLD) {
            responseBody.aiWarning = aiScreening;
        }
        res.status(201).json({
            ...responseBody,
            ownerVerified,
            duplicate: false
        });
    } catch (err) {
        log(`ERROR creating project: ${err.message}`);
        res.status(500).json({ message: 'Server error while creating project' });
    }
};

const getProjects = async (req, res) => {
    try {
        const allProjects = await projects.aggregate([
            { $match: { status: { $in: ['open', 'awarded'] }, pendingAgreementTo: { $exists: false } } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'ownerInfo'
                }
            },
            { $unwind: { path: '$ownerInfo', preserveNullAndEmptyArrays: true } },
            { $match: { 'ownerInfo.isAadhaarVerified': true, 'ownerInfo.status': 'active' } },
            {
                $addFields: {
                    badgeWeight: {
                        $switch: {
                            branches: [
                                { case: { $eq: ['$ownerInfo.badge', 'Expert'] }, then: 3 },
                                { case: { $eq: ['$ownerInfo.badge', 'Pro'] }, then: 2 }
                            ],
                            default: 1
                        }
                    },
                    statusOrder: {
                        $cond: { if: { $eq: ['$status', 'open'] }, then: 0, else: 1 }
                    }
                }
            },
            { $sort: { statusOrder: 1, badgeWeight: -1, createdAt: -1 } }
        ]);

        const redactedProjects = allProjects.map(p => {
            const bids = p.bids || [];
            const { bids: _, ownerInfo, ...rest } = p;
            return {
                ...rest,
                bidCount: bids.length,
                bids: []
            };
        });

        log(`Found ${allProjects.length} verified projects.`);
        res.status(200).json(redactedProjects);
    } catch (err) {
        log(`CRITICAL ERROR in getProjects: ${err.message}`);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const getRecommendedProjects = async (req, res) => {
    try {
        const limit = Math.min(12, Math.max(4, Number(req.query.limit) || 8));
        const userVector = buildUserVector(req.user || {});

        const excludeUserId = req.user?._id;
        const query = {
            status: 'open',
            $or: [
                { pendingAgreementTo: { $exists: false } },
                { pendingAgreementTo: null }
            ]
        };
        if (excludeUserId) {
            query.user = { $ne: excludeUserId };
        }

        const candidateProjects = await projects.find(query)
            .populate('user', 'isAadhaarVerified status')
            .sort({ createdAt: -1 })
            .limit(100)
            .lean()
            .maxTimeMS(PROJECT_QUERY_TIMEOUT_MS);

        if (!candidateProjects.length) {
            return res.status(200).json({ recommendations: [] });
        }

        const verifiedCandidates = candidateProjects.filter(p => p.user && p.user.isAadhaarVerified && p.user.status === 'active');

        if (!verifiedCandidates.length) {
            return res.status(200).json({ recommendations: [] });
        }

        const payload = buildRecommendationPayload(userVector, verifiedCandidates.slice(0, 25));
        const remoteRecommendations = await requestRemoteRecommendations(payload);

        let recommendedProjects = [];
        if (remoteRecommendations.length) {
            const projectMap = new Map(candidateProjects.map((project) => [project._id.toString(), project]));
            recommendedProjects = remoteRecommendations
                .map((entry) => projectMap.get(entry.id?.toString?.()))
                .filter((project) => project && (!excludeUserId || project.user?.toString() !== excludeUserId.toString()))
                .slice(0, limit);
        }

        if (!recommendedProjects.length) {
            const normalizedSkills = (userVector.skills || [])
                .map((skill) => (typeof skill === 'string' ? skill.trim().toLowerCase() : ''))
                .filter(Boolean);

            const scoredCandidates = verifiedCandidates.map((project) => {
                const haystack = `${project.title || ''} ${project.description || ''}`.toLowerCase();
                const matchCount = normalizedSkills.reduce((acc, skill) => (skill && haystack.includes(skill) ? acc + 1 : acc), 0);
                return {
                    project,
                    score: scoreProjectLocally(project, userVector),
                    matchCount
                };
            });

            const strongMatches = scoredCandidates
                .filter((item) => item.matchCount > 0)
                .sort((a, b) => b.score - a.score);

            const fallbackPool = scoredCandidates.sort((a, b) => b.score - a.score);
            const seenProjects = new Set();
            const prioritized = [];

            for (const entry of strongMatches) {
                const pid = entry.project._id?.toString?.();
                if (!pid || seenProjects.has(pid)) continue;
                seenProjects.add(pid);
                prioritized.push(entry);
                if (prioritized.length >= limit) break;
            }

            if (prioritized.length < limit) {
                for (const entry of fallbackPool) {
                    const pid = entry.project._id?.toString?.();
                    if (!pid || seenProjects.has(pid)) continue;
                    seenProjects.add(pid);
                    prioritized.push(entry);
                    if (prioritized.length >= limit) break;
                }
            }

            recommendedProjects = prioritized.map((item) => item.project);
        }

        res.status(200).json({ recommendations: recommendedProjects });
    } catch (err) {
        console.error('[PROJECT] Recommendation error:', err.message);
        res.status(500).json({ message: 'Unable to generate recommendations right now.' });
    }
};

const getProjectById = async (req, res) => {
    const mongoose = require('mongoose');
    const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id) && (String(new mongoose.Types.ObjectId(req.params.id)) === req.params.id);
    const query = isObjectId ? { $or: [{ _id: req.params.id }, { slug: req.params.id }] } : { slug: req.params.id };
    const project = await projects.findOne(query).maxTimeMS(PROJECT_QUERY_TIMEOUT_MS);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const projectOwnerId = project.user ? project.user.toString() : '';
    let currentUserId = null;
    let authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer')) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            currentUserId = decoded.id ? decoded.id.toString() : '';
        } catch (e) { }
    }

    const { users } = require('../models/db');
    let owner = null;
    if (projectOwnerId) {
        try {
            owner = await users.findById(project.user).select('isAadhaarVerified status').maxTimeMS(PROJECT_QUERY_TIMEOUT_MS);
        } catch (e) {
            owner = null;
        }
    }

    if (!owner || owner.status === 'banned') {
        return res.status(404).json({ message: 'Project not found or owner is inactive' });
    }

    const projectObj = project.toObject ? project.toObject() : project;
    const { bids, ...rest } = projectObj;
    const rawBids = Array.isArray(bids) ? bids : [];

    // Fetch verification status for all unique bidders in this project
    const bidderIds = [...new Set(rawBids
        .map(b => b?.userId)
        .filter(Boolean)
        .map((id) => {
            try {
                return new mongoose.Types.ObjectId(id);
            } catch (err) {
                return null;
            }
        })
        .filter(Boolean)
    )];

    const verifiedBidders = bidderIds.length > 0
        ? await users.find({
            _id: { $in: bidderIds },
            isAadhaarVerified: true
        }).select('_id badge').lean()
        : [];
    const verifiedBidderSet = new Set(verifiedBidders.map(u => u._id.toString()));
    const bidderBadgeMap = verifiedBidders.reduce((acc, u) => {
        acc[u._id.toString()] = u.badge || '';
        return acc;
    }, {});

    const safeBids = rawBids.filter(bid => {
        const bidUserId = bid.userId ? bid.userId.toString() : '';
        const isBidderVerified = verifiedBidderSet.has(bidUserId);

        // Show bid if:
        // 1. Bidder is verified
        // 2. Viewer is the bidder (even if unverified)
        return isBidderVerified || (currentUserId && currentUserId === bidUserId);
    }).map(bid => {
        const bidUserId = bid.userId ? bid.userId.toString() : '';
        const badge = bidderBadgeMap[bidUserId] || '';
        return {
            ...bid,
            badge,
            isWaiting: !verifiedBidderSet.has(bidUserId)
        };
    }).sort((a, b) => {
        // Sort by badge weight, then by creation date
        const getWeight = (badge) => badge === 'Expert' ? 3 : (badge === 'Pro' ? 2 : 1);
        const weightA = getWeight(a.badge);
        const weightB = getWeight(b.badge);

        if (weightA !== weightB) {
            return weightB - weightA; // Descending weight
        }

        // Fallback to time (descending)
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const safeProject = {
        ...rest,
        user: projectOwnerId || '',
        userName: project.userName || 'User',
        isOwnerAadhaarVerified: owner ? owner.isAadhaarVerified : false,
        bidCount: safeBids.length,
        bids: safeBids
    };

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).json(safeProject);
};

const placeBid = async (req, res) => {
    const { amount, proposal } = req.body;
    const projectId = req.params.id;

    if (!amount || !proposal) {
        return res.status(400).json({ message: 'Please add amount and proposal' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ message: 'Bid amount must be a valid positive number' });
    }
    if (numAmount > 10000000) {
        return res.status(400).json({ message: 'Bid amount cannot exceed ₹1,00,00,000' });
    }

    if (typeof proposal !== 'string' || proposal.trim().length < 20 || proposal.trim().length > 5000) {
        return res.status(400).json({ message: 'Proposal must be between 20 and 5000 characters' });
    }

    const proposalCheck = detectOutsideCommunication(proposal);
    if (proposalCheck) {
        const violation = registerContactViolation(req.user._id.toString(), 'bid_proposal');
        return res.status(violation.blocked ? 429 : 400).json({
            message: WARNING_MESSAGE,
            warning: true,
            detectedType: proposalCheck.type,
            label: proposalCheck.label,
            cooldownMs: violation.cooldownMs,
            violationCount: violation.warnings
        });
    }

    const mongoose = require('mongoose');
    const isObjectId = mongoose.Types.ObjectId.isValid(projectId) && (String(new mongoose.Types.ObjectId(projectId)) === projectId);
    const query = isObjectId ? { $or: [{ _id: projectId }, { slug: projectId }] } : { slug: projectId };
    const project = await projects.findOne(query).maxTimeMS(PROJECT_QUERY_TIMEOUT_MS);

    if (!project) {
        return res.status(404).json({ message: 'Project not found' });
    }

    if (project.status === 'awarded') {
        return res.status(400).json({ message: 'This project has already been awarded and is closed to new bids' });
    }

    const { users } = require('../models/db');
    const user = await users.findOne({ _id: req.user._id }).maxTimeMS(PROJECT_QUERY_TIMEOUT_MS);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isUserVerified = Boolean(user.isAadhaarVerified || user.isPhoneVerified);

    const currentDate = new Date();
    let jobsAppliedThisMonth = user.jobsAppliedThisMonth || 0;
    const lastJobApplyDate = user.lastJobApplyDate;

    if (lastJobApplyDate && (currentDate.getMonth() !== lastJobApplyDate.getMonth() || currentDate.getFullYear() !== lastJobApplyDate.getFullYear())) {
        jobsAppliedThisMonth = 0;
    }

    let limit = 50;
    if (user.badge === 'Pro') limit = 100;
    else if (user.badge === 'Expert') limit = Infinity;

    if (jobsAppliedThisMonth >= limit) {
        return res.status(403).json({
            error_code: 'LIMIT_REACHED',
            message: `Your limit of ${limit} bids per month reached. Upgrade to Pro or Expert to get more.`
        });
    }

    if (project.user && project.user.toString() === req.user._id.toString()) {
        return res.status(400).json({ message: 'You cannot bid on your own project' });
    }

    const existingBid = project.bids.find(b => b.userId && b.userId.toString() === req.user._id.toString());
    if (existingBid) {
        return res.status(400).json({ message: 'You have already submitted a bid for this project' });
    }

    const bid = {
        userId: req.user._id,
        userName: req.user.name,
        amount: numAmount,
        proposal,
        createdAt: new Date(),
    };

    const updateProjectResult = await projects.updateOne(
        { _id: project._id, status: { $ne: 'awarded' }, "bids.userId": { $ne: req.user._id } },
        { $push: { bids: bid } }
    ).maxTimeMS(PROJECT_QUERY_TIMEOUT_MS);

    if (updateProjectResult.modifiedCount === 0) {
        return res.status(400).json({ message: 'Could not place bid. The project may be awarded or you have already bid.' });
    }

    await users.updateOne(
        { _id: req.user._id },
        {
            $set: {
                jobsAppliedThisMonth: jobsAppliedThisMonth + 1,
                lastJobApplyDate: currentDate
            }
        }
    );

    await pushNotification(
        project.user,
        'info',
        'New Bid Received',
        `${req.user.name} placed a ₹${numAmount} bid on "${project.title}".`,
        `/projects/${project._id}`
    );

    res.status(200).json({
        ...bid,
        requiresVerification: !isUserVerified
    });
};

const getMyProjectBids = async (req, res) => {
    const mongoose = require('mongoose');
    const projectId = req.params.id;
    const isObjectId = mongoose.Types.ObjectId.isValid(projectId) && (String(new mongoose.Types.ObjectId(projectId)) === projectId);
    const query = isObjectId ? { $or: [{ _id: projectId }, { slug: projectId }] } : { slug: projectId };
    const project = await projects.findOne(query).maxTimeMS(PROJECT_QUERY_TIMEOUT_MS);

    if (!project) {
        return res.status(404).json({ message: 'Project not found' });
    }

    if (!project.user || project.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to view bids for this project' });
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { users } = require('../models/db');
    const rawBids = project.bids || [];
    const bidderIds = [...new Set(rawBids
        .map(b => b?.userId)
        .filter(Boolean)
        .map((id) => {
            try {
                return new mongoose.Types.ObjectId(id);
            } catch (err) {
                return null;
            }
        })
        .filter(Boolean)
    )];

    const verifiedBidders = bidderIds.length > 0
        ? await users.find({
            _id: { $in: bidderIds },
            isAadhaarVerified: true
        }).select('_id badge').lean()
        : [];

    const verifiedBidderSet = new Set(verifiedBidders.map(u => u._id.toString()));
    const bidderBadgeMap = verifiedBidders.reduce((acc, u) => {
        acc[u._id.toString()] = u.badge || '';
        return acc;
    }, {});

    const normalizedBids = rawBids
        .filter(bid => verifiedBidderSet.has(bid.userId ? bid.userId.toString() : ''))
        .map((bid) => {
            const plainBid = bid && typeof bid.toObject === 'function' ? bid.toObject() : (bid || {});
            const bidUserId = plainBid.userId ? plainBid.userId.toString() : '';
            return {
                ...plainBid,
                userId: bidUserId,
                userName: plainBid.userName || 'User',
                amount: Number.isFinite(Number(plainBid.amount)) ? Number(plainBid.amount) : 0,
                proposal: typeof plainBid.proposal === 'string' ? plainBid.proposal : '',
                createdAt: plainBid.createdAt || new Date(),
                badge: bidderBadgeMap[bidUserId] || ''
            };
        })
        .sort((a, b) => {
            const getWeight = (badge) => badge === 'Expert' ? 3 : (badge === 'Pro' ? 2 : 1);
            const weightA = getWeight(a.badge);
            const weightB = getWeight(b.badge);
            if (weightA !== weightB) return weightB - weightA;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

    res.status(200).json(normalizedBids);
};

const getMyProjects = async (req, res) => {
    try {
        const userId = req.user._id;
        const userIdStr = userId.toString();
        const { contracts } = require('../models/db');

        log(`Fetching projects for user: ${userIdStr}`);

        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const variants = buildIdVariants(userId);

        const directProjects = await projects.find({
            $or: [
                { user: userId },
                { user: userIdStr },
                { user: { $in: variants } },
                { awardedTo: userId },
                { awardedTo: userIdStr },
                { awardedTo: { $in: variants } }
            ]
        }).sort({ createdAt: -1 }).lean().maxTimeMS(PROJECT_QUERY_TIMEOUT_MS);

        const myContracts = await contracts.find({
            $or: [
                { employerId: userId },
                { employerId: userIdStr },
                { employerId: { $in: variants } },
                { freelancerId: userId },
                { freelancerId: userIdStr },
                { freelancerId: { $in: variants } }
            ]
        }).lean().maxTimeMS(PROJECT_QUERY_TIMEOUT_MS);

        const employerProjectIds = new Set();
        const freelancerProjectIds = new Set();
        const contractStateByProjectId = new Map();
        for (const c of myContracts) {
            const pid = c.projectId ? c.projectId.toString() : null;
            if (!pid) continue;
            const empId = c.employerId ? c.employerId.toString() : '';
            const freeId = c.freelancerId ? c.freelancerId.toString() : '';
            if (empId === userIdStr) employerProjectIds.add(pid);
            if (freeId === userIdStr) freelancerProjectIds.add(pid);

            const existing = contractStateByProjectId.get(pid);
            const contractUpdatedAt = new Date(c.updatedAt || c.completedAt || c.createdAt || 0).getTime();
            const existingUpdatedAt = existing ? new Date(existing.updatedAt || 0).getTime() : 0;
            const nextState = {
                status: c.status,
                completedAt: c.completedAt || null,
                updatedAt: c.updatedAt || c.completedAt || c.createdAt || null,
            };

            if (!existing) {
                contractStateByProjectId.set(pid, nextState);
                continue;
            }

            if (c.status === 'completed' && existing.status !== 'completed') {
                contractStateByProjectId.set(pid, nextState);
                continue;
            }

            if (contractUpdatedAt >= existingUpdatedAt) {
                contractStateByProjectId.set(pid, nextState);
            }
        }

        const seenIds = new Set();
        const mergedProjects = [];

        for (const p of directProjects) {
            const pid = p._id ? p._id.toString() : null;
            if (pid && !seenIds.has(pid)) {
                seenIds.add(pid);
                mergedProjects.push(p);
            }
        }

        const contractPids = [...employerProjectIds, ...freelancerProjectIds];
        const missingPids = contractPids.filter(id => !seenIds.has(id));
        if (missingPids.length > 0) {
            const extraProjects = await projects.find({ _id: { $in: missingPids } }).lean().maxTimeMS(PROJECT_QUERY_TIMEOUT_MS);
            for (const p of extraProjects) {
                const pid = p._id ? p._id.toString() : null;
                if (pid && !seenIds.has(pid)) {
                    seenIds.add(pid);
                    mergedProjects.push(p);
                }
            }
        }

        const users = require('../models/db').users;
        const ownerIds = mergedProjects.map(p => p.user).filter(Boolean);
        const verifiedOwners = await users.find({ _id: { $in: ownerIds }, isAadhaarVerified: true }).select('_id').lean();
        const verifiedOwnerIds = new Set(verifiedOwners.map(u => u._id.toString()));

        const normalized = mergedProjects.map((p) => {
            const pObj = { ...p };
            const pid = p._id ? p._id.toString() : null;
            const contractState = pid ? contractStateByProjectId.get(pid) : null;
            pObj._id = pid;
            pObj.user = p.user ? p.user.toString() : null;
            pObj.awardedTo = p.awardedTo ? p.awardedTo.toString() : null;
            if (!pObj.bids) pObj.bids = [];

            if (contractState?.status === 'completed') {
                pObj.status = 'completed';
                if (!pObj.completedAt && contractState.completedAt) {
                    pObj.completedAt = contractState.completedAt;
                }
            }

            const isOwner = pObj.user === userIdStr || employerProjectIds.has(pid);
            const isWorker = pObj.awardedTo === userIdStr || freelancerProjectIds.has(pid);
            pObj.isOwner = isOwner;
            pObj.isWorker = isWorker;
            pObj.myRole = isOwner ? 'owner' : (isWorker ? 'worker' : null);
            pObj.isOwnerAadhaarVerified = verifiedOwnerIds.has(pObj.user);
            return pObj;
        });

        normalized.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.status(200).json(normalized);
    } catch (err) {
        log(`CRITICAL ERROR in getMyProjects: ${err.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

const debugMyProjects = async (req, res) => {
    try {
        const userId = req.user._id;
        const userIdStr = userId.toString();
        const { contracts } = require('../models/db');
        const sampleLimit = Math.min(20, Math.max(5, Number(req.query.limit || 12)));

        const idInfo = {
            raw: userId,
            rawType: typeof userId,
            str: userIdStr,
            isObjectId: mongoose.Types.ObjectId.isValid(userIdStr),
            constructorName: userId ? userId.constructor.name : 'null'
        };

        const variants = buildIdVariants(userId);

        const [projectsForUser, contractsForUser, allProjectsInDb, allContracts] = await Promise.all([
            projects.find({
                $or: [
                    { user: { $in: variants } },
                    { awardedTo: { $in: variants } }
                ]
            }).lean().maxTimeMS(PROJECT_QUERY_TIMEOUT_MS),
            contracts.find({
                $or: [
                    { employerId: { $in: variants } },
                    { freelancerId: { $in: variants } }
                ]
            }).lean().maxTimeMS(PROJECT_QUERY_TIMEOUT_MS),
            projects.find({}).sort({ createdAt: -1 }).limit(sampleLimit).lean().maxTimeMS(PROJECT_QUERY_TIMEOUT_MS),
            contracts.find({}).sort({ createdAt: -1 }).limit(sampleLimit).lean().maxTimeMS(PROJECT_QUERY_TIMEOUT_MS),
        ]);

        const byUserIdCount = projectsForUser.filter(p => p.user && p.user.toString() === userIdStr).length;
        const byAwardedIdCount = projectsForUser.filter(p => p.awardedTo && p.awardedTo.toString() === userIdStr).length;
        const byUserInCount = projectsForUser.length;
        const contractsByEmpCount = contractsForUser.filter(c => c.employerId && c.employerId.toString() === userIdStr).length;
        const contractsByFreeCount = contractsForUser.filter(c => c.freelancerId && c.freelancerId.toString() === userIdStr).length;

        res.status(200).json({
            userIdInfo: idInfo,
            variants: variants.map(v => ({ value: v.toString(), type: typeof v, constructor: v.constructor.name })),
            queries: {
                'projects.find({ user: ObjectId })': byUserIdCount,
                'projects.find({ user: string })': byUserIdCount,
                'projects.find({ user: $in })': byUserInCount,
                'projects.find({ awardedTo: ObjectId })': byAwardedIdCount,
                'projects.find({ awardedTo: string })': byAwardedIdCount,
            },
            contracts: {
                'employerId=ObjectId': contractsByEmpCount,
                'employerId=string': contractsByEmpCount,
                'freelancerId=ObjectId': contractsByFreeCount,
                'freelancerId=string': contractsByFreeCount,
            },
            allProjectsSample: allProjectsInDb.map(p => ({
                _id: p._id?.toString(),
                title: p.title,
                status: p.status,
                user: p.user?.toString(),
                userType: p.user ? p.user.constructor.name : 'null',
                awardedTo: p.awardedTo?.toString(),
            })),
            allContractsSample: allContracts.map(c => ({
                _id: c._id?.toString(),
                projectTitle: c.projectTitle,
                employerId: c.employerId?.toString(),
                freelancerId: c.freelancerId?.toString(),
                status: c.status,
            })),
        });
    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
};

const deleteProject = async (req, res) => {
    try {
        const projectId = req.params.id;
        const mongoose = require('mongoose');
        const isObjectId = mongoose.Types.ObjectId.isValid(projectId) && (String(new mongoose.Types.ObjectId(projectId)) === projectId);
        const query = isObjectId ? { $or: [{ _id: projectId }, { slug: projectId }] } : { slug: projectId };
        const project = await projects.findOne(query).maxTimeMS(PROJECT_QUERY_TIMEOUT_MS);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        if (!project.user || project.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this project' });
        }
        if (project.status === 'awarded') {
            return res.status(400).json({ message: 'Cannot delete an awarded project. Contact support if needed.' });
        }
        await projects.deleteOne({ _id: project._id });
        await logActivity(req.user._id, req.user.name, req.user.role, 'deleted_project', `Deleted project: ${project.title}`, project._id);
        log(`Project deleted successfully: ${project._id} by ${req.user.name}`);
        res.status(200).json({ message: 'Project deleted successfully' });
    } catch (err) {
        log(`CRITICAL ERROR in deleteProject: ${err.message}`);
        res.status(500).json({ message: 'Server error while deleting project' });
    }
};

module.exports = {
    createProject,
    getProjects,
    getRecommendedProjects,
    getProjectById,
    placeBid,
    getMyProjectBids,
    getMyProjects,
    debugMyProjects,
    deleteProject
};
