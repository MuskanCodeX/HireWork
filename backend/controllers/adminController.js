const { users, projects, contracts, reports, activityLogs, settings, messages, portfolios, gigs, gigOrders, reviews, notifications, verificationRequests, referrals, pushSubscriptions } = require('../models/db');
const { logActivity } = require('../utils/activityLogger');
const { rewardReferralBonusesForCompletedContract } = require('../utils/referralRewards');
const { fraudReport } = require('../utils/fraudDetection');


/**
 * GET /api/admin/stats
 * Overview numbers for the admin dashboard
 */
const MONTHS_TO_TRACK = 6;

const buildMonthBuckets = (months = MONTHS_TO_TRACK) => {
    const buckets = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0);
        const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        buckets.push({
            key,
            label: date.toLocaleString('default', { month: 'short' }),
            date
        });
    }
    return { buckets, start: buckets[0]?.date || new Date(now.getFullYear(), now.getMonth(), 1) };
};

const formatTrend = (buckets, raw = [], valueKey = 'count') => {
    const map = new Map();
    raw.forEach(item => {
        const key = `${item._id.year}-${item._id.month}`;
        map.set(key, item[valueKey] || 0);
    });
    return buckets.map(bucket => ({
        label: bucket.label,
        value: Math.round(map.get(bucket.key) || 0)
    }));
};

const getDashboardStats = async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const activeSince = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
        const { buckets, start: monthRangeStart } = buildMonthBuckets();

        const [
            totalUsers,
            newUsers,
            totalProjects,
            activeProjects,
            completedProjects,
            pendingReports,
            pendingPortfolios,
            disputeCount,
            activeFreelancers,
            activeEmployers,
            returningUsers,
            userTrendRaw,
            revenueTrendRaw,
            projectTrendRaw,
            completionAgg
        ] = await Promise.all([
            users.countDocuments().maxTimeMS(2000),
            users.countDocuments({ createdAt: { $gte: startOfDay } }).maxTimeMS(2000),
            projects.countDocuments().maxTimeMS(2000),
            projects.countDocuments({ status: 'open' }).maxTimeMS(2000),
            contracts.countDocuments({ status: 'completed' }).maxTimeMS(2000),
            reports.countDocuments({ status: 'pending' }).maxTimeMS(2000),
            portfolios.countDocuments({ status: 'pending' }).maxTimeMS(2000),
            contracts.countDocuments({ status: 'disputed' }).maxTimeMS(2000),
            users.countDocuments({ role: 'freelancer', lastActiveAt: { $gte: activeSince } }).maxTimeMS(2000),
            users.countDocuments({ role: 'employer', lastActiveAt: { $gte: activeSince } }).maxTimeMS(2000),
            users.countDocuments({ lastActiveAt: { $gte: activeSince }, createdAt: { $lt: activeSince } }).maxTimeMS(2000),
            users.aggregate([
                { $match: { createdAt: { $gte: monthRangeStart } } },
                {
                    $group: {
                        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                        count: { $sum: 1 }
                    }
                }
            ]).option({ maxTimeMS: 2000 }),
            contracts.aggregate([
                { $match: { status: 'completed', updatedAt: { $gte: monthRangeStart } } },
                {
                    $group: {
                        _id: { year: { $year: '$updatedAt' }, month: { $month: '$updatedAt' } },
                        amount: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                }
            ]).option({ maxTimeMS: 2000 }),
            projects.aggregate([
                { $match: { createdAt: { $gte: monthRangeStart } } },
                {
                    $group: {
                        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                        count: { $sum: 1 }
                    }
                }
            ]).option({ maxTimeMS: 2000 }),
            contracts.aggregate([
                { $match: { status: 'completed', createdAt: { $exists: true }, updatedAt: { $exists: true } } },
                { $sort: { updatedAt: -1 } },
                { $limit: 200 },
                {
                    $project: {
                        durationDays: {
                            $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 1000 * 60 * 60 * 24]
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgDuration: { $avg: '$durationDays' }
                    }
                }
            ]).option({ maxTimeMS: 2000 })
        ]);

        const monthlyUsers = formatTrend(buckets, userTrendRaw, 'count');
        const monthlyRevenue = formatTrend(buckets, revenueTrendRaw, 'amount');
        const monthlyProjects = formatTrend(buckets, projectTrendRaw, 'count');

        const revenueThisMonth = monthlyRevenue[monthlyRevenue.length - 1]?.value || 0;
        const grossRevenue = monthlyRevenue.reduce((sum, item) => sum + item.value, 0);
        const avgCompletionDays = Number(completionAgg?.[0]?.avgDuration || 0).toFixed(1);

        res.json({
            totalUsers,
            newUsers,
            totalProjects,
            activeProjects,
            completedProjects,
            pendingReports,
            pendingPortfolios,
            advanced: {
                disputeCount,
                activeFreelancers,
                activeEmployers,
                returningUsers,
                revenueThisMonth,
                grossRevenue,
                avgCompletionDays
            },
            trends: {
                monthlyUsers,
                monthlyRevenue,
                monthlyProjects
            }
        });
    } catch (err) {
        if (process.env.NODE_ENV === 'production') {
            console.error('[PROD] Database error during getDashboardStats:', err.message);
            return res.status(500).json({ message: 'Internal Server Error' });
        }
        console.warn('[DEV] getDashboardStats failed, returning mock stats:', err.message);
        const fallbackBuckets = buildMonthBuckets().buckets;
        res.json({
            totalUsers: 156,
            newUsers: 5,
            totalProjects: 42,
            activeProjects: 28,
            completedProjects: 12,
            pendingReports: 3,
            pendingPortfolios: 2,
            advanced: {
                disputeCount: 2,
                activeFreelancers: 40,
                activeEmployers: 18,
                returningUsers: 25,
                revenueThisMonth: 180000,
                grossRevenue: 920000,
                avgCompletionDays: '6.2'
            },
            trends: {
                monthlyUsers: fallbackBuckets.map(b => ({ label: b.label, value: Math.round(Math.random() * 20) })),
                monthlyRevenue: fallbackBuckets.map(b => ({ label: b.label, value: Math.round(Math.random() * 100000) })),
                monthlyProjects: fallbackBuckets.map(b => ({ label: b.label, value: Math.round(Math.random() * 15) }))
            }
        });
    }
};

/**
 * GET /api/admin/users
 */
const getAllUsers = async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [allUsers, total] = await Promise.all([
        users.find().select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        users.countDocuments()
    ]);

    // Backward compatible: return array directly
    // Also include pagination headers for API consumers
    res.setHeader('X-Total-Count', total);
    res.setHeader('X-Total-Pages', Math.ceil(total / limit));
    res.setHeader('X-Current-Page', page);
    res.json(allUsers);
};

/**
 * PUT /api/admin/users/:id/ban
 */
const banUser = async (req, res) => {
    const user = await users.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Toggle ban status
    const newStatus = user.status === 'banned' ? 'active' : 'banned';

    await users.updateOne({ _id: user._id }, { $set: { status: newStatus } });

    await logActivity(
        req.user._id, req.user.name, req.user.role,
        newStatus === 'banned' ? 'banned_user' : 'unbanned_user',
        `User ${user.email} was ${newStatus}`,
        user._id
    );

    res.json({ message: `User ${user.name} has been ${newStatus}.` });
};

/**
 * DELETE /api/admin/users/:id
 */
const deleteUser = async (req, res) => {
    const user = await users.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'admin') {
        return res.status(400).json({ message: 'Cannot delete an admin account.' });
    }

    const userId = user._id;
    await Promise.all([
        users.deleteOne({ _id: userId }),
        projects.deleteMany({ user: userId }),
        gigs.deleteMany({ sellerId: userId }),
        reviews.deleteMany({ $or: [{ reviewerId: userId }, { revieweeId: userId }] }),
        portfolios.deleteMany({ user: userId }),
        messages.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] }),
        contracts.deleteMany({ $or: [{ employerId: userId }, { freelancerId: userId }] }),
        gigOrders.deleteMany({ $or: [{ buyerId: userId }, { sellerId: userId }] }),
        verificationRequests.deleteMany({ userId: userId }),
        notifications.deleteMany({ userId: userId }),
        referrals.deleteMany({ $or: [{ referrerId: userId }, { referredUserId: userId }] }),
        pushSubscriptions.deleteMany({ userId: userId })
    ]);

    await logActivity(req.user._id, req.user.name, req.user.role, 'deleted_user', `Deleted user account: ${user.email}`, userId);

    res.json({ message: 'User and all associated data permanently deleted.' });
};

/**
 * PUT /api/admin/users/:id/promote
 */
const promoteUser = async (req, res) => {
    const user = await users.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'admin') {
        return res.status(400).json({ message: 'User is already an admin.' });
    }

    await users.updateOne({ _id: user._id }, { $set: { role: 'admin' } });

    await logActivity(
        req.user._id, req.user.name, req.user.role,
        'promoted_admin',
        `User ${user.email} was promoted to admin`,
        user._id
    );

    res.json({ message: `User ${user.name} has been promoted to admin.` });
};

/**
 * GET /api/admin/projects
 */
const getAllProjects = async (req, res) => {
    // Redact bids array for faster transport if needed, or keep for admin review
    const allProjects = await projects.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(200);
    res.json(allProjects);
};

/**
 * DELETE /api/admin/projects/:id
 */
const deleteProject = async (req, res) => {
    const project = await projects.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    await projects.deleteOne({ _id: project._id });
    await contracts.deleteMany({ projectId: project._id });

    await logActivity(req.user._id, req.user.name, req.user.role, 'deleted_project', `Deleted project: ${project.title}`, project._id);

    res.json({ message: 'Project removed.' });
};

/**
 * GET /api/admin/reports
 */
const getReports = async (req, res) => {
    const allReports = await reports.find().sort({ createdAt: -1 }).limit(200);
    res.json(allReports);
};

/**
 * PUT /api/admin/reports/:id/resolve
 * Body: { action: 'warned' | 'suspended' | 'deleted' | 'ignored' }
 */
const resolveReport = async (req, res) => {
    const { action } = req.body;
    const report = await reports.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });

    report.status = action === 'ignored' ? 'ignored' : 'resolved';
    report.adminAction = action;
    report.resolvedAt = new Date();
    await report.save();

    if (action === 'warned') {
        const { pushNotification } = require('../utils/notificationPusher');
        await pushNotification(
            report.reportedId,
            'warning',
            'Platform Warning',
            'You have received a warning regarding your activity. Please ensure you follow our community guidelines.',
            '/'
        );
    } else if (action === 'suspended' && report.reportedType === 'user') {
        await users.updateOne({ _id: report.reportedId }, { $set: { status: 'banned' } });
    } else if (action === 'deleted') {
        if (report.reportedType === 'project') {
            await projects.deleteOne({ _id: report.reportedId });
        } else if (report.reportedType === 'message') {
            const { messages } = require('../models/db');
            await messages.deleteOne({ _id: report.reportedId });
        }
    }

    await logActivity(req.user._id, req.user.name, req.user.role, 'resolved_report', `Resolved report against ${report.reportedType} ID ${report.reportedId} with action: ${action}`, report._id);

    res.json(report);
};

/**
 * DELETE /api/admin/reports/:id
 * Permanently remove a report record (manual admin cleanup).
 */
const deleteReport = async (req, res) => {
    const report = await reports.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });

    await reports.deleteOne({ _id: report._id });

    await logActivity(
        req.user._id,
        req.user.name,
        req.user.role,
        'deleted_report',
        `Deleted report against ${report.reportedType} ID ${report.reportedId}`,
        report._id
    );

    res.json({ message: 'Report deleted permanently.' });
};

/**
 * GET /api/admin/settings
 */
const getSettings = async (req, res) => {
    let siteSettings = await settings.findOne();
    if (!siteSettings) {
        siteSettings = await settings.create({}); // Generate default if missing
    }
    res.json(siteSettings);
};

/**
 * PUT /api/admin/settings
 */
const updateSettings = async (req, res) => {
    let siteSettings = await settings.findOne();
    const normalizedPayload = { ...req.body };

    if (normalizedPayload.defaultNewUserCredits !== undefined) {
        const parsed = Number(normalizedPayload.defaultNewUserCredits);
        normalizedPayload.defaultNewUserCredits = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 3;
    }

    if (normalizedPayload.referralBonusCredits !== undefined) {
        const parsed = Number(normalizedPayload.referralBonusCredits);
        normalizedPayload.referralBonusCredits = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 1;
    }

    if (normalizedPayload.maintenanceMode !== undefined) {
        normalizedPayload.maintenanceMode = normalizedPayload.maintenanceMode === true || normalizedPayload.maintenanceMode === 'true';
    }

    if (normalizedPayload.maintenanceEndTime !== undefined) {
        if (normalizedPayload.maintenanceEndTime === null || normalizedPayload.maintenanceEndTime === '') {
            normalizedPayload.maintenanceEndTime = null;
        } else {
            const date = new Date(normalizedPayload.maintenanceEndTime);
            normalizedPayload.maintenanceEndTime = isNaN(date.getTime()) ? null : date;
        }
    }

    if (normalizedPayload.whatsappLink !== undefined) {
        normalizedPayload.whatsappLink = String(normalizedPayload.whatsappLink || '').slice(0, 500);
    }

    if (normalizedPayload.instagramLink !== undefined) {
        normalizedPayload.instagramLink = String(normalizedPayload.instagramLink || '').slice(0, 500);
    }

    if (!siteSettings) {
        siteSettings = new settings(normalizedPayload);
    } else {
        Object.assign(siteSettings, normalizedPayload);
    }
    await siteSettings.save();

    await logActivity(req.user._id, req.user.name, req.user.role, 'updated_settings', 'Global platform settings were updated');

    res.json(siteSettings);
};

/**
 * GET /api/admin/activity
 */
const getActivityLogs = async (req, res) => {
    const logs = await activityLogs.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
};

/**
 * GET /api/admin/disputes
 */
const getDisputes = async (req, res) => {
    const disputedContracts = await contracts.find({ status: 'disputed' }).sort({ updatedAt: -1 }).limit(200);
    res.json(disputedContracts);
};

/**
 * GET /api/admin/disputes/:id/conversation
 * Returns recent chat between employer and freelancer for a dispute investigation.
 */
const getDisputeConversation = async (req, res) => {
    const contract = await contracts.findById(req.params.id);
    if (!contract) return res.status(404).json({ message: 'Contract not found' });

    const employerId = contract.employerId.toString();
    const freelancerId = contract.freelancerId.toString();

    const rawLimit = Number(req.query.limit || 300);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 20), 500) : 300;

    const rawMessages = await messages.find({
        $or: [
            { senderId: contract.employerId, receiverId: contract.freelancerId },
            { senderId: contract.freelancerId, receiverId: contract.employerId }
        ]
    }).sort({ createdAt: -1 }).limit(limit).lean();

    const ordered = rawMessages.reverse().map((msg) => {
        const senderId = msg.senderId?.toString?.() || String(msg.senderId || '');
        const isEmployerSender = senderId === employerId;
        return {
            _id: msg._id,
            senderId,
            receiverId: msg.receiverId?.toString?.() || String(msg.receiverId || ''),
            senderRole: isEmployerSender ? 'employer' : 'freelancer',
            senderName: isEmployerSender ? contract.employerName : contract.freelancerName,
            content: msg.content || '',
            file: msg.file || null,
            createdAt: msg.createdAt
        };
    });

    res.json({
        contractId: contract._id,
        participants: {
            employerId,
            employerName: contract.employerName,
            freelancerId,
            freelancerName: contract.freelancerName
        },
        count: ordered.length,
        messages: ordered
    });
};

/**
 * PUT /api/admin/disputes/:id/resolve
 */
const resolveDispute = async (req, res) => {
    const { outcome, verificationChecklist, verificationNotes } = req.body || {};
    const contract = await contracts.findById(req.params.id);
    if (!contract) return res.status(404).json({ message: 'Contract not found' });

    if (contract.status !== 'disputed') {
        return res.status(400).json({ message: 'This contract is not currently disputed.' });
    }

    const checklist = Array.isArray(verificationChecklist)
        ? verificationChecklist.filter(item => typeof item === 'string' && item.trim())
        : [];
    const notes = typeof verificationNotes === 'string' ? verificationNotes.trim() : '';

    if (checklist.length < 2 || notes.length < 20) {
        return res.status(400).json({
            message: 'Add at least 2 verification checklist items and detailed verification notes (min 20 chars) before resolving.'
        });
    }

    if (outcome === 'refund_employer') {
        contract.status = 'cancelled';
    } else if (outcome === 'pay_freelancer') {
        contract.status = 'completed';
        contract.milestones.forEach(m => {
            if (m.status !== 'confirmed') {
                m.status = 'confirmed';
                m.confirmedAt = new Date();
            }
        });
    } else {
        return res.status(400).json({ message: 'Invalid outcome' });
    }

    contract.disputeResolution = {
        outcome,
        verificationChecklist: checklist,
        verificationNotes: notes,
        resolvedById: req.user._id,
        resolvedByName: req.user.name,
        resolvedAt: new Date()
    };

    await contract.save();
    await logActivity(req.user._id, req.user.name, req.user.role, 'resolved_dispute', `Resolved dispute for contract ${contract._id} with outcome: ${outcome}`, contract._id);

    if (contract.status === 'completed') {
        try {
            await rewardReferralBonusesForCompletedContract(contract);
        } catch (refErr) {
            console.error('Referral reward error during admin dispute resolution:', refErr);
        }
    }

    const { pushNotification } = require('../utils/notificationPusher');
    await pushNotification(
        contract.employerId,
        'info',
        'Dispute Resolved',
        `An admin has resolved the dispute for "${contract.projectTitle}". The contract is now ${contract.status}.`,
        '/contract'
    );
    await pushNotification(
        contract.freelancerId,
        'info',
        'Dispute Resolved',
        `An admin has resolved the dispute for "${contract.projectTitle}". The contract is now ${contract.status}.`,
        '/contract'
    );

    res.json(contract);
};

/**
 * PUT /api/admin/users/:id/credits
 * Body: { credits, referralCredits, freePostings, freeBids }
 */
const updateUserCredits = async (req, res) => {
    const { credits, referralCredits, freePostings, freeBids } = req.body;
    const user = await users.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const update = {};
    if (credits !== undefined) update.credits = credits;
    if (referralCredits !== undefined) update.referralCredits = referralCredits;
    if (freePostings !== undefined) update.freePostings = freePostings;
    if (freeBids !== undefined) update.freeBids = freeBids;

    await users.updateOne({ _id: user._id }, { $set: update });

    await logActivity(
        req.user._id, req.user.name, req.user.role,
        'updated_user_credits',
        `Updated credits for user ${user.email}: ${JSON.stringify(update)}`,
        user._id
    );

    try {
        if (credits !== undefined) {
            const { getIo } = require('../socket');
            const io = getIo();
            io.to(user._id.toString()).emit('credits_updated', credits);
        }
    } catch (err) {
        console.error('Socket error emitting updated credits from admin:', err);
    };

    res.json({ message: `Credits for ${user.name} have been updated.` });
};

const fs = require('fs');
const path = require('path');

const normalizeLearnSlug = (value = '') => String(value)
    .toLowerCase()
    .trim()
    .replace(/["'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const extractFrontmatterFields = (rawContent = '') => {
    const match = String(rawContent).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!match) return {};
    const fields = {};
    for (const line of match[1].split(/\r?\n/)) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;
        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        fields[key] = value;
    }
    return fields;
};

const getLearnDir = () => {
    const dir = path.join(__dirname, '../uploads/learn');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
};

const cleanupDuplicateLearnFiles = (learnDir, canonicalSlug, legacySlug = '') => {
    const normalizedCanonicalSlug = normalizeLearnSlug(canonicalSlug);
    const normalizedLegacySlug = normalizeLearnSlug(legacySlug);
    if (!normalizedCanonicalSlug) return;

    const files = fs.readdirSync(learnDir).filter(file => file.endsWith('.md'));
    for (const file of files) {
        const fileSlug = normalizeLearnSlug(path.basename(file, '.md'));
        if (fileSlug === normalizedCanonicalSlug) continue;

        const filePath = path.join(learnDir, file);
        let frontmatterSlug = '';
        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const fields = extractFrontmatterFields(raw);
            frontmatterSlug = normalizeLearnSlug(fields.slug || '');
        } catch (e) {
            frontmatterSlug = '';
        }

        const isCanonicalDuplicate = frontmatterSlug && frontmatterSlug === normalizedCanonicalSlug;
        const isLegacyDuplicate = normalizedLegacySlug
            && (fileSlug === normalizedLegacySlug || frontmatterSlug === normalizedLegacySlug);

        if (isCanonicalDuplicate || isLegacyDuplicate) {
            try {
                fs.unlinkSync(filePath);
            } catch (e) {
                // best-effort cleanup only
            }
        }
    }
};

/**
 * POST /api/admin/learn
 * Create/Update a learn article
 */
const saveLearnArticle = async (req, res) => {
    try {
        const {
            title,
            description,
            excerpt,
            category,
            content,
            slug,
            primaryKeyword,
            tags,
            draft,
            publishedAt,
            author,
            originalSlug
        } = req.body;

        if (!title || !slug || !content) {
            return res.status(400).json({ message: 'Title, slug, and content are required' });
        }

        const escapeFrontmatter = (value = '') => String(value)
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"');
        const normalizeTags = (rawTags) => {
            if (Array.isArray(rawTags)) {
                return rawTags.map(t => String(t || '').trim()).filter(Boolean);
            }
            if (typeof rawTags === 'string') {
                return rawTags.split(',').map(t => t.trim()).filter(Boolean);
            }
            return [];
        };

        const normalizedSlug = normalizeLearnSlug(slug);
        if (!normalizedSlug) {
            return res.status(400).json({ message: 'Invalid slug' });
        }

        const learnDir = getLearnDir();

        const filePath = path.join(learnDir, `${normalizedSlug}.md`);
        let existingPublishedAt = '';
        if (fs.existsSync(filePath)) {
            try {
                const raw = fs.readFileSync(filePath, 'utf8');
                const fields = extractFrontmatterFields(raw);
                if (fields.publishedAt) {
                    existingPublishedAt = String(fields.publishedAt);
                }
            } catch (e) { }
        }

        const finalDescription = String(description ?? excerpt ?? '').trim();
        const finalExcerpt = String(excerpt ?? finalDescription).trim();
        const finalPublishedAt = String(publishedAt || existingPublishedAt || new Date().toISOString());
        const finalUpdatedAt = new Date().toISOString();
        const finalTags = normalizeTags(tags);
        const isDraft = draft === true || draft === 'true';

        const frontmatter = [
            '---',
            `title: "${escapeFrontmatter(title)}"`,
            `description: "${escapeFrontmatter(finalDescription)}"`,
            `excerpt: "${escapeFrontmatter(finalExcerpt)}"`,
            `category: "${escapeFrontmatter(category || 'General')}"`,
            `author: "${escapeFrontmatter(author || 'Admin')}"`,
            `primaryKeyword: "${escapeFrontmatter(primaryKeyword || '')}"`,
            `publishedAt: "${escapeFrontmatter(finalPublishedAt)}"`,
            `updatedAt: "${escapeFrontmatter(finalUpdatedAt)}"`,
            `slug: "${escapeFrontmatter(normalizedSlug)}"`,
            `tags: [${finalTags.map(t => `"${escapeFrontmatter(t)}"`).join(', ')}]`,
            `draft: ${isDraft}`,
            '---',
            '',
            content
        ].join('\n');

        fs.writeFileSync(filePath, frontmatter, 'utf8');

        const normalizedOriginalSlug = normalizeLearnSlug(originalSlug || '');
        if (normalizedOriginalSlug && normalizedOriginalSlug !== normalizedSlug) {
            const oldPath = path.join(learnDir, `${normalizedOriginalSlug}.md`);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }
        cleanupDuplicateLearnFiles(learnDir, normalizedSlug, normalizedOriginalSlug);

        res.json({ message: 'Article saved successfully', slug: normalizedSlug });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * DELETE /api/admin/learn/:slug
 */
const deleteLearnArticle = async (req, res) => {
    try {
        const slug = normalizeLearnSlug(req.params.slug || '');
        if (!slug) {
            return res.status(400).json({ message: 'Invalid slug' });
        }
        const learnDir = getLearnDir();
        const filePath = path.join(learnDir, `${slug}.md`);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ message: 'Article deleted successfully' });
        } else {
            res.status(404).json({ message: 'Article not found' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getFraudReport = async (req, res) => {
    const report = fraudReport();

    const suspiciousUsers = await users.find({
        $or: [
            { loginHistory: { $size: { $gt: 10 } } },
            { registrationIp: { $exists: true, $ne: '' } }
        ]
    }).select('name email registrationIp lastLoginIp loginHistory').limit(50).lean();

    const usersWithMultipleAccounts = await users.aggregate([
        { $match: { registrationIp: { $exists: true, $ne: '' } } },
        { $group: { _id: '$registrationIp', count: { $sum: 1 }, users: { $push: '$email' } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 20 }
    ]);

    res.json({
        fraudStats: report,
        suspiciousUsers: suspiciousUsers.length,
        multipleAccountIps: usersWithMultipleAccounts.length,
        topSuspiciousIps: usersWithMultipleAccounts.slice(0, 10)
    });
};

module.exports = {
    getDashboardStats,
    getAllUsers,
    promoteUser,
    banUser,
    deleteUser,
    getAllProjects,
    deleteProject,
    getReports,
    resolveReport,
    deleteReport,
    getSettings,
    updateSettings,
    getActivityLogs,
    getDisputes,
    getDisputeConversation,
    resolveDispute,
    updateUserCredits,
    saveLearnArticle,
    deleteLearnArticle,
    getFraudReport
};
