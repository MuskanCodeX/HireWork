const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect, admin } = require('../middleware/authMiddleware');
const { validateObjectId } = require('../middleware/objectIdValidation');
const {
    gigUpload,
    getGigs, getCategories, getGigById, getMyGigs,
    createGig, updateGig, deleteGig,
    adminGetPendingGigs, adminApproveGig, adminRejectGig, adminPreviewGig, adminRefundCredits,
    placeOrder, acceptOrder, declineOrder, getMyPurchases, getMySales,
    cancelOrder, completeOrder, getOrderById
} = require('../controllers/gigController');

// Rate limiter for gig creation
const gigCreationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'production' ? 10 : 100,
    message: { message: 'Too many gigs created. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter for order placement
const orderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 20 : 100,
    message: { message: 'Too many orders placed. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// ── Public gig routes ──────────────────────────────────────────────────────
router.get('/categories', getCategories);
router.get('/', getGigs);
router.get('/my', protect, getMyGigs);

// ── Admin moderation (must come before /:id to avoid route conflict) ───────
router.get('/admin/pending', protect, admin, adminGetPendingGigs);
router.get('/admin/preview/:id', protect, admin, validateObjectId('id'), adminPreviewGig);
router.put('/admin/:id/approve', protect, admin, validateObjectId('id'), adminApproveGig);
router.put('/admin/:id/reject', protect, admin, validateObjectId('id'), adminRejectGig);
router.put('/admin/:id/refund', protect, admin, validateObjectId('id'), adminRefundCredits);

// ── Gig orders ────────────────────────────────────────────────────────────
router.post('/orders/place', protect, orderLimiter, placeOrder);
router.get('/orders/purchases', protect, getMyPurchases);
router.get('/orders/sales', protect, getMySales);
router.put('/orders/:id/accept', protect, validateObjectId('id'), acceptOrder);
router.put('/orders/:id/decline', protect, validateObjectId('id'), declineOrder);
router.get('/orders/:id', protect, validateObjectId('id'), getOrderById);
router.put('/orders/:id/cancel', protect, validateObjectId('id'), cancelOrder);
router.put('/orders/:id/complete', protect, validateObjectId('id'), completeOrder);

// ── Single gig by id (public, last so /my /admin /orders take priority) ────
router.get('/:id', validateObjectId('id'), getGigById);

// ── Seller gig management ─────────────────────────────────────────────────
router.post('/', protect, gigCreationLimiter, gigUpload.single('coverImage'), createGig);
router.put('/:id', protect, validateObjectId('id'), gigUpload.single('coverImage'), updateGig);
router.delete('/:id', protect, validateObjectId('id'), deleteGig);

module.exports = router;
