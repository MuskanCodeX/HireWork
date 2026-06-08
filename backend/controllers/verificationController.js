const { verificationRequests, users } = require('../models/db');
const { logActivity } = require('../utils/activityLogger');
const asyncHandler = require('express-async-handler');
const { pushNotification } = require('../utils/notificationPusher');
const { trackVerificationAchievements } = require('../utils/achievementTracker');

// @desc    Submit a new verification request
// @route   POST /api/verification
// @access  Private
const submitVerification = asyncHandler(async (req, res) => {
    const { documentType } = req.body;

    const docFile = req.files?.documentImage?.[0];
    const selfieFile = req.files?.selfieImage?.[0];

    if (!documentType || !docFile || !selfieFile) {
        res.status(400);
        throw new Error('Please provide document type and upload both ID and selfie images');
    }

    const currentUser = await users.findById(req.user._id).select('_id isAadhaarVerified');
    if (!currentUser) {
        res.status(404);
        throw new Error('User not found');
    }

    if (currentUser.isAadhaarVerified) {
        res.status(400);
        throw new Error('Your account is already verified');
    }

    // Check if user already has a pending or approved request
    const existing = await verificationRequests.findOne({
        userId: req.user._id,
        status: { $in: ['pending', 'approved'] }
    });

    if (existing) {
        res.status(400);
        throw new Error('You already have a pending or approved verification request');
    }

    const verification = await verificationRequests.create({
        userId: req.user._id,
        userName: req.user.name,
        documentType,
        documentImage: docFile.filename,
        selfieImage: selfieFile.filename,
        status: 'pending'
    });

    await logActivity(req.user._id, req.user.name, req.user.role, 'submitted_kyc', `Submitted KYC document (${documentType})`);

    res.status(201).json(verification);
});

// @desc    Get current user's verification status
// @route   GET /api/verification/me
// @access  Private
const getMyVerificationStatus = asyncHandler(async (req, res) => {
    const me = await users.findById(req.user._id).select('_id isAadhaarVerified');
    if (!me) {
        res.status(404);
        throw new Error('User not found');
    }

    const latestRequest = await verificationRequests
        .findOne({ userId: req.user._id })
        .sort({ createdAt: -1 });

    if (!latestRequest) {
        return res.json({
            isVerified: !!me.isAadhaarVerified,
            status: me.isAadhaarVerified ? 'approved' : 'none',
            rejectionReason: '',
            updatedAt: null
        });
    }

    return res.json({
        isVerified: !!me.isAadhaarVerified || latestRequest.status === 'approved',
        status: latestRequest.status,
        rejectionReason: latestRequest.rejectionReason || '',
        updatedAt: latestRequest.updatedAt || latestRequest.createdAt || null
    });
});

// @desc    Get all pending verification requests
// @route   GET /api/verification/pending
// @access  Private/Admin
const getPendingVerifications = asyncHandler(async (req, res) => {
    const requests = await verificationRequests.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json(requests);
});

// @desc    Approve or reject a verification request
// @route   PUT /api/verification/:id/resolve
// @access  Private/Admin
const resolveVerification = asyncHandler(async (req, res) => {
    const { action, reason } = req.body; // action: 'approve' or 'reject'
    const request = await verificationRequests.findById(req.params.id);

    if (!request) {
        res.status(404);
        throw new Error('Verification request not found');
    }

    if (action === 'approve') {
        const user = await users.findById(request.userId);
        if (user) {
            user.isAadhaarVerified = true;
            await user.save();

            // Track verification achievements
            try {
                await trackVerificationAchievements(request.userId, {
                    isEmailVerified: user.isEmailVerified || false,
                    isPhoneVerified: user.isPhoneVerified || false,
                    isAadhaarVerified: true
                });
            } catch (achievementErr) {
                console.error('[Achievement] Error tracking verification achievements:', achievementErr.message);
            }
        }

        request.status = 'approved';
        request.rejectionReason = '';
        await request.save();

        await logActivity(req.user._id, req.user.name, req.user.role, 'approved_kyc', `Approved KYC for ${request.userName}`);
        await pushNotification(
            request.userId,
            'success',
            'Verification Approved',
            `Your ${request.documentType} verification has been approved. Your profile is now verified.`,
            '/profile'
        );
        res.json({ message: 'Request approved successfully', userVerified: true });
    } else if (action === 'reject') {
        const rejectionReason = String(reason || '').trim() || 'No specific reason was provided by admin.';
        request.status = 'rejected';
        request.rejectionReason = rejectionReason;
        await request.save();

        const user = await users.findById(request.userId);
        if (user) {
            user.isAadhaarVerified = false;
            await user.save();
        }

        await logActivity(req.user._id, req.user.name, req.user.role, 'rejected_kyc', `Rejected KYC for ${request.userName}`, request.userId);
        await pushNotification(
            request.userId,
            'warning',
            'Verification Rejected',
            `Your ${request.documentType} verification was rejected. Reason: ${rejectionReason}`,
            '/profile'
        );
        res.json({ message: 'Request rejected successfully' });
    } else {
        res.status(400);
        throw new Error('Invalid action');
    }
});

module.exports = {
    submitVerification,
    getPendingVerifications,
    getMyVerificationStatus,
    resolveVerification
};
