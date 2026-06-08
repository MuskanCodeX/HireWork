const path = require('path');
const multer = require('multer');
const fs = require('fs');
const mongoose = require('mongoose');
const { messages, users, contracts } = require('../models/db');
const { detectOutsideCommunication, WARNING_MESSAGE } = require('../utils/sanitization');
const { registerContactViolation } = require('../utils/contactPolicy');
const { moderateMessage, getUserWarningCount, isUserRestricted, clearUserWarnings, clearProjectAwardCache } = require('../utils/chatModeration');
const { hasActiveAgreementBetweenUsers } = require('../utils/agreementAccess');
const QUERY_TIMEOUT_MS = Math.max(1000, Number(process.env.MESSAGE_QUERY_TIMEOUT_MS || 3000));

const AGREEMENT_REQUIRED_MESSAGE = 'Create an agreement first. Calls and file uploads are available only after an active agreement is accepted.';

const buildIdVariants = (id) => {
    const variants = [];
    if (!id) return variants;

    const str = typeof id === 'string' ? id : id.toString();
    variants.push(str);
    variants.push(id);

    if (mongoose.Types.ObjectId.isValid(str)) {
        variants.push(new mongoose.Types.ObjectId(str));
    }

    return variants;
};

// Multer config
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedExtensions = /jpeg|jpg|png|gif|webp|pdf|txt|csv|doc|docx/;
        const ext = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
        const mimeMatches = /image|pdf|text|msword|officedocument/.test(file.mimetype);
        if (ext && mimeMatches) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
        }
    }
});

const sendMessage = async (req, res) => {
    const { receiverId, content } = req.body;

    if (!receiverId || (!content && !req.file)) {
        return res.status(400).json({ message: 'Please provide receiverId and content or a file' });
    }

    // [SECURITY] Validate message content length
    if (content && (typeof content !== 'string' || content.length < 1 || content.length > 5000)) {
        return res.status(400).json({ message: 'Message must be between 1 and 5000 characters' });
    }

    // [SECURITY] Validate receiverId format
    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
        return res.status(400).json({ message: 'Invalid receiver ID' });
    }

    if (req.file) {
        const hasAccess = await hasActiveAgreementBetweenUsers(req.user._id, receiverId);
        if (!hasAccess) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.warn('[MESSAGES] Failed to remove blocked upload:', unlinkError.message);
            }

            return res.status(403).json({
                message: AGREEMENT_REQUIRED_MESSAGE,
                agreementRequired: true,
                canUpload: false,
            });
        }
    }

    // Check if user is restricted
    if (isUserRestricted(req.user._id.toString())) {
        return res.status(403).json({ 
            message: 'You have been temporarily restricted from chatting due to multiple violations. Please try again later.',
            restricted: true
        });
    }

    // Run chat moderation on message content (only if there's text content)
    if (content && content.trim()) {
        // First run basic outside communication check
        const contentCheck = detectOutsideCommunication(content);
        if (contentCheck) {
            const violation = registerContactViolation(req.user._id.toString(), 'chat_text');
            return res.status(violation.blocked ? 429 : 400).json({ 
                message: WARNING_MESSAGE,
                warning: true,
                detectedType: contentCheck.type,
                label: contentCheck.label,
                cooldownMs: violation.cooldownMs,
                violationCount: violation.warnings
            });
        }

        // Get projectId from contract between sender and receiver
        let projectId = null;
        try {
            const contract = await contracts.findOne({
                $or: [
                    { freelancerId: req.user._id, employerId: receiverId },
                    { freelancerId: receiverId, employerId: req.user._id }
                ],
                agreementStatus: 'accepted'
            }).select('projectId').lean();

            if (contract) {
                projectId = contract.projectId;
            }
        } catch (error) {
            console.error('[MODERATION] Error finding contract:', error);
        }

        // Run full chat moderation
        const db = { contracts };
        const moderationResult = await moderateMessage(
            content, 
            req.user._id.toString(), 
            projectId ? projectId.toString() : null,
            db
        );

        if (!moderationResult.allowed) {
            const warningCount = getUserWarningCount(req.user._id.toString());
            
            return res.status(400).json({ 
                message: moderationResult.reason,
                warning: true,
                detectedType: moderationResult.detectedType,
                severity: moderationResult.severity,
                warningCount: warningCount,
                isRestricted: moderationResult.severity === 'restrict'
            });
        }
    }

    const msgData = {
        senderId: req.user._id,
        receiverId,
        content: content || '',
        createdAt: new Date(),
        read: false,
    };

    // If file was uploaded, attach file info
    if (req.file) {
        msgData.file = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
        };
    }

    const message = await messages.create(msgData);
    res.status(201).json(message);
};

const getChatPermissions = async (req, res) => {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
    }

    const hasAccess = await hasActiveAgreementBetweenUsers(req.user._id, userId);
    res.status(200).json({
        canCall: hasAccess,
        canUpload: hasAccess,
        hasActiveAgreement: hasAccess,
        message: hasAccess ? null : AGREEMENT_REQUIRED_MESSAGE,
    });
};

const getMessages = async (req, res) => {
    const { userId } = req.params;
    const currentUserVariants = buildIdVariants(req.user._id);
    const partnerVariants = buildIdVariants(userId);

    // Mark messages from this user as read
    await messages.updateMany(
        {
            senderId: { $in: partnerVariants },
            receiverId: { $in: currentUserVariants },
            read: false
        },
        { $set: { read: true } }
    ).maxTimeMS(QUERY_TIMEOUT_MS);

    const conversation = await messages.find({
        $or: [
            { senderId: { $in: currentUserVariants }, receiverId: { $in: partnerVariants } },
            { senderId: { $in: partnerVariants }, receiverId: { $in: currentUserVariants } },
        ],
        deletedBy: { $ne: req.user._id }
    }).sort({ createdAt: 1 }).maxTimeMS(QUERY_TIMEOUT_MS);

    res.status(200).json(conversation);
};

const getConversations = async (req, res) => {
    const currentUserVariants = buildIdVariants(req.user._id);
    const currentUserId = req.user._id.toString();

    const [senderPartnerIds, receiverPartnerIds] = await Promise.all([
        messages.distinct('senderId', {
            receiverId: { $in: currentUserVariants },
            deletedBy: { $ne: req.user._id }
        }).maxTimeMS(QUERY_TIMEOUT_MS),
        messages.distinct('receiverId', {
            senderId: { $in: currentUserVariants },
            deletedBy: { $ne: req.user._id }
        }).maxTimeMS(QUERY_TIMEOUT_MS)
    ]);

    const partnerIdSet = new Set();
    [...senderPartnerIds, ...receiverPartnerIds].forEach((id) => {
        const partnerId = id?.toString();
        if (partnerId && partnerId !== currentUserId) partnerIdSet.add(partnerId);
    });

    const partners = await users.find({ _id: { $in: [...partnerIdSet] } })
        .select('_id name email badge')
        .lean()
        .maxTimeMS(QUERY_TIMEOUT_MS);

    // Compute unread counts in one aggregate query.
    const unreadCounts = await messages.aggregate([
        {
            $match: {
                receiverId: { $in: currentUserVariants },
                read: false,
                deletedBy: { $ne: req.user._id }
            }
        },
        {
            $group: {
                _id: '$senderId',
                count: { $sum: 1 }
            }
        }
    ]).option({ maxTimeMS: QUERY_TIMEOUT_MS });

    const unreadMap = new Map(
        unreadCounts
            .filter((row) => row && row._id)
            .map((row) => [row._id.toString(), row.count])
    );

    const conversationPartners = partners.map((partner) => ({
        _id: partner._id,
        name: partner.name,
        email: partner.email,
        badge: partner.badge,
        unreadCount: unreadMap.get(partner._id.toString()) || 0
    }));

    res.status(200).json(conversationPartners);
};

const getUnreadCount = async (req, res) => {
    const currentUserVariants = buildIdVariants(req.user._id);
    const unreadCounts = await messages.aggregate([
        {
            $match: {
                receiverId: { $in: currentUserVariants },
                read: false,
                deletedBy: { $ne: req.user._id }
            }
        },
        {
            $group: {
                _id: '$senderId',
                count: { $sum: 1 }
            }
        }
    ]).option({ maxTimeMS: QUERY_TIMEOUT_MS });

    const senderIds = [...new Set(
        unreadCounts
            .map((m) => m._id && m._id.toString())
            .filter(Boolean)
    )];

    if (senderIds.length === 0) {
        return res.status(200).json({ count: 0 });
    }

    // Avoid phantom badge counts from orphaned/deleted senders.
    const existingSenders = await users.find({ _id: { $in: senderIds } }, { _id: 1 }).lean().maxTimeMS(QUERY_TIMEOUT_MS);
    const validSenderSet = new Set(existingSenders.map((u) => u._id.toString()));

    const count = unreadCounts.reduce((sum, row) => {
        const senderId = row?._id?.toString();
        if (!senderId || !validSenderSet.has(senderId)) return sum;
        return sum + (Number(row.count) || 0);
    }, 0);

    res.status(200).json({ count });
};

const deleteConversation = async (req, res) => {
    const { userId } = req.params;
    const currentUserVariants = buildIdVariants(req.user._id);
    const partnerVariants = buildIdVariants(userId);

    // Add current user to deletedBy array for all messages between these two users
    await messages.updateMany(
        {
            $or: [
                { senderId: { $in: currentUserVariants }, receiverId: { $in: partnerVariants } },
                { senderId: { $in: partnerVariants }, receiverId: { $in: currentUserVariants } },
            ]
        },
        { $addToSet: { deletedBy: req.user._id } }
    ).maxTimeMS(QUERY_TIMEOUT_MS);

    res.status(200).json({ message: 'Conversation deleted successfully' });
};

// Get user's warning status
const getWarningStatus = async (req, res) => {
    const userId = req.user._id.toString();
    const warningCount = getUserWarningCount(userId);
    const restricted = isUserRestricted(userId);

    res.status(200).json({
        warningCount,
        isRestricted: restricted,
        message: restricted 
            ? 'You are temporarily restricted from chatting' 
            : warningCount > 0 
                ? `Warning ${warningCount}/2 - Do not share contact information` 
                : 'No warnings'
    });
};

// Clear warnings (called when project is awarded)
const clearWarnings = async (req, res) => {
    const userId = req.user._id.toString();
    clearUserWarnings(userId);

    res.status(200).json({
        message: 'Warnings cleared successfully',
        warningCount: 0,
        isRestricted: false
    });
};

module.exports = {
    sendMessage,
    getChatPermissions,
    getMessages,
    getConversations,
    getUnreadCount,
    deleteConversation,
    getWarningStatus,
    clearWarnings,
    upload
};
