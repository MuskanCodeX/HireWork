const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const rateLimit = require('express-rate-limit');
const {
    createContract,
    getMyContracts,
    getContractById,
    getAgreementThread,
    addAgreementThreadMessage,
    confirmTaskDone,
    markMilestonePaid,
    confirmMilestoneReceived,
    raiseDispute,
    respondToAgreement,
    proofUpload,
} = require('../controllers/contractController');
const { protect } = require('../middleware/authMiddleware');
const { validateObjectId } = require('../middleware/objectIdValidation');

// Rate limiter for contract creation
const contractLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'production' ? 20 : 100,
    message: { message: 'Too many contracts created. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter for disputes
const disputeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'production' ? 5 : 20,
    message: { message: 'Too many disputes raised. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

router.post('/', protect, contractLimiter, asyncHandler(createContract));
router.get('/', protect, asyncHandler(getMyContracts));
router.get('/:id', protect, validateObjectId('id'), asyncHandler(getContractById));
router.get('/:id/thread', protect, validateObjectId('id'), asyncHandler(getAgreementThread));
router.post('/:id/thread', protect, validateObjectId('id'), asyncHandler(addAgreementThreadMessage));
router.post('/:id/respond', protect, validateObjectId('id'), asyncHandler(respondToAgreement));
router.patch('/:id/milestone/:milestoneIndex/task-done', protect, validateObjectId('id'), asyncHandler(confirmTaskDone));
router.patch('/:id/milestone/:milestoneIndex/paid', protect, validateObjectId('id'), proofUpload.single('proofImage'), asyncHandler(markMilestonePaid));
router.patch('/:id/milestone/:milestoneIndex/confirm', protect, validateObjectId('id'), asyncHandler(confirmMilestoneReceived));
router.patch('/:id/dispute', protect, validateObjectId('id'), disputeLimiter, proofUpload.single('evidenceImage'), asyncHandler(raiseDispute));

module.exports = router;
