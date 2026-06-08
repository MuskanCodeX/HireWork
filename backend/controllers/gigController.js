const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Gig = require('../models/Gig');
const GigOrder = require('../models/GigOrder');
const User = require('../models/User');

const FREE_GIGS_ALLOWED = 1;
const CREDITS_PER_EXTRA_GIG = 3;
const CREDITS_PER_ORDER = 1;
const ORDER_EXPIRY_DAYS = 3;

const GIG_CATEGORIES = [
    'Web Development', 'Mobile Development', 'Design & Creative',
    'Content Writing', 'Digital Marketing', 'Data & Analytics',
    'Video & Animation', 'Music & Audio', 'Business Consulting',
    'Legal & Finance', 'Education & Training', 'Other'
];

// ─── Multer for gig cover images ───────────────────────────────────────────
const gigImagesDir = path.join(__dirname, '../uploads/gigs');
try { if (!fs.existsSync(gigImagesDir)) fs.mkdirSync(gigImagesDir, { recursive: true }); } catch (e) { }

const gigStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, gigImagesDir),
    filename: (req, file, cb) => cb(null, `gig-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
});
const gigUpload = multer({
    storage: gigStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'), false);
        cb(null, true);
    }
});

// ─── KYC Helper ────────────────────────────────────────────────────────────
const requireKYC = async (userId) => {
    const user = await User.findById(userId).select('isAadhaarVerified isEmailVerified').lean();
    if (!user) return 'User not found';
    if (!user.isAadhaarVerified) return 'You must complete Aadhaar KYC verification before posting or ordering gigs.';
    return null; // null = ok
};

// ─── GIGS ──────────────────────────────────────────────────────────────────

// GET /api/gigs — browse gigs (public, only admin-approved)
const getGigs = async (req, res) => {
    try {
        const { category, q, page = 1, limit = 20, sort = 'newest' } = req.query;
        const filter = { isActive: true, isApproved: true, approvalStatus: 'approved' };
        if (category) filter.category = category;
        if (q) filter.$or = [
            { title: { $regex: q, $options: 'i' } },
            { tags: { $in: [new RegExp(q, 'i')] } },
            { description: { $regex: q, $options: 'i' } }
        ];

        const sortMap = { newest: { createdAt: -1 }, popular: { totalOrders: -1 }, rating: { avgRating: -1 } };
        const sortObj = sortMap[sort] || { createdAt: -1 };
        const skip = (Number(page) - 1) * Number(limit);

        const pipeline = [
            { $match: filter },
            { $lookup: { from: 'users', localField: 'sellerId', foreignField: '_id', as: 'sellerDoc' } },
            { $unwind: { path: '$sellerDoc', preserveNullAndEmptyArrays: true } },
            { $match: { 'sellerDoc.status': 'active' } },
            {
                $addFields: {
                    badgeWeight: {
                        $switch: {
                            branches: [
                                { case: { $eq: ['$sellerDoc.badge', 'Expert'] }, then: 2 },
                                { case: { $eq: ['$sellerDoc.badge', 'Pro'] }, then: 1 }
                            ],
                            default: 0
                        }
                    }
                }
            },
            { $sort: { badgeWeight: -1, ...sortObj } },
            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [{ $skip: skip }, { $limit: Number(limit) }]
                }
            }
        ];

        const [result] = await Gig.aggregate(pipeline);
        const total = result.metadata[0]?.total || 0;
        const gigs = (result.data || []).map(g => {
            g.sellerBadge = g.sellerDoc?.badge || '';
            delete g.sellerDoc;
            delete g.badgeWeight;
            return g;
        });

        res.json({ gigs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (err) {
        console.error('[GIG] getGigs error:', err);
        res.status(500).json({ message: 'Failed to fetch gigs' });
    }
};

// GET /api/gigs/categories
const getCategories = (req, res) => res.json({ categories: GIG_CATEGORIES });

// GET /api/gigs/:id — single gig (public, must be approved)
const getGigById = async (req, res) => {
    try {
        const gig = await Gig.findById(req.params.id).lean();
        if (!gig || !gig.isActive || !gig.isApproved) return res.status(404).json({ message: 'Gig not found or pending review' });

        const seller = await User.findById(gig.sellerId).select('status').lean();
        if (!seller || seller.status !== 'active') {
            return res.status(404).json({ message: 'Gig not found or seller is inactive' });
        }

        res.json(gig);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch gig' });
    }
};

// GET /api/gigs/my — my gigs (all statuses, owner can see pending/rejected)
const getMyGigs = async (req, res) => {
    try {
        const gigs = await Gig.find({ sellerId: req.user._id }).sort({ createdAt: -1 }).lean();
        res.json(gigs);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch your gigs' });
    }
};

// POST /api/gigs — create gig (requires KYC)
const createGig = async (req, res) => {
    try {
        const kycError = await requireKYC(req.user._id);
        if (kycError) return res.status(403).json({ message: kycError, kycRequired: true });

        const seller = await User.findById(req.user._id).select('credits name').lean();
        if (!seller) return res.status(404).json({ message: 'User not found' });

        const existingCount = await Gig.countDocuments({ sellerId: req.user._id });
        const creditCost = existingCount >= FREE_GIGS_ALLOWED ? CREDITS_PER_EXTRA_GIG : 0;
        if (creditCost > 0 && (seller.credits || 0) < creditCost) {
            return res.status(400).json({ message: `You need ${creditCost} credits to post an additional gig. Your first gig is free.` });
        }

        const { title, description, category, tags, packages } = req.body;
        if (!title || !description || !category || !packages) {
            return res.status(400).json({ message: 'Title, description, category and basic package are required.' });
        }

        let parsedPackages;
        try {
            parsedPackages = typeof packages === 'string' ? JSON.parse(packages) : packages;
        } catch (err) {
            return res.status(400).json({ message: 'Invalid packages format' });
        }
        if (!parsedPackages?.basic) {
            return res.status(400).json({ message: 'Basic package details are required.' });
        }

        const validatedPackages = {};
        const MIN_PRICE = 100;
        const MAX_PRICE = 100000;

        const packageTypes = ['basic', 'standard', 'premium'];
        for (const pkgType of packageTypes) {
            if (parsedPackages[pkgType]) {
                const pkg = parsedPackages[pkgType];
                const price = Number(pkg.price);
                if (!Number.isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) {
                    return res.status(400).json({
                        message: `Invalid price for ${pkgType} package. Price must be between ₹${MIN_PRICE} and ₹${MAX_PRICE}`
                    });
                }
                if (!pkg.title || !pkg.description) {
                    return res.status(400).json({ message: `${pkgType} package must have title and description` });
                }
                validatedPackages[pkgType] = {
                    ...pkg,
                    price: Math.round(price),
                    deliveryDays: Math.max(1, Math.min(90, Number(pkg.deliveryDays) || 3))
                };
            }
        }

        if (Object.keys(validatedPackages).length === 0) {
            return res.status(400).json({ message: 'At least one package is required' });
        }

        let parsedTags;
        try {
            parsedTags = typeof tags === 'string' ? JSON.parse(tags) : (tags || []);
        } catch (err) {
            return res.status(400).json({ message: 'Invalid tags format' });
        }
        const coverImage = req.file ? `/uploads/gigs/${req.file.filename}` : null;

        const gig = await Gig.create({
            sellerId: req.user._id,
            sellerName: seller.name,
            title: title.trim(),
            description: description.trim(),
            category,
            tags: parsedTags.slice(0, 10),
            coverImage,
            packages: validatedPackages,
            isApproved: false,
            approvalStatus: 'pending',
            creditsPaid: creditCost
        });

        if (creditCost > 0) {
            await User.updateOne({ _id: req.user._id }, { $inc: { credits: -creditCost } });
        }

        res.status(201).json({ gig, creditsUsed: creditCost, pendingReview: true });
    } catch (err) {
        console.error('[GIG] createGig error:', err);
        res.status(500).json({ message: 'Failed to create gig' });
    }
};

const updateGig = async (req, res) => {
    try {
        const gig = await Gig.findOne({ _id: req.params.id, sellerId: req.user._id });
        if (!gig) return res.status(404).json({ message: 'Gig not found' });

        const { title, description, category, tags, packages, isActive } = req.body;
        if (title) gig.title = title.trim();
        if (description) gig.description = description.trim();
        if (category) gig.category = category;
        if (tags) {
            try {
                gig.tags = (typeof tags === 'string' ? JSON.parse(tags) : tags).slice(0, 10);
            } catch (err) {
                return res.status(400).json({ message: 'Invalid tags format' });
            }
        }
        if (packages) {
            try {
                gig.packages = typeof packages === 'string' ? JSON.parse(packages) : packages;
            } catch (err) {
                return res.status(400).json({ message: 'Invalid packages format' });
            }
            gig.isApproved = false;
            gig.approvalStatus = 'pending';
            gig.rejectionReason = '';
        }
        if (isActive !== undefined) gig.isActive = isActive;
        if (req.file) gig.coverImage = `/uploads/gigs/${req.file.filename}`;

        await gig.save();
        res.json(gig);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update gig' });
    }
};

const deleteGig = async (req, res) => {
    try {
        const gig = await Gig.findOneAndDelete({ _id: req.params.id, sellerId: req.user._id });
        if (!gig) return res.status(404).json({ message: 'Gig not found' });
        res.json({ message: 'Gig deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete gig' });
    }
};

// ─── ADMIN: Gig Moderation ─────────────────────────────────────────────────

const adminPreviewGig = async (req, res) => {
    try {
        const gig = await Gig.findById(req.params.id).lean();
        if (!gig) return res.status(404).json({ message: 'Gig not found' });
        res.json(gig);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch gig' });
    }
};

const adminGetPendingGigs = async (req, res) => {
    try {
        const { status = 'pending', page = 1, limit = 20 } = req.query;
        const filter = status === 'all' ? {} : { approvalStatus: status };
        const skip = (Number(page) - 1) * Number(limit);
        const [gigs, total] = await Promise.all([
            Gig.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
            Gig.countDocuments(filter)
        ]);
        res.json({ gigs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch gigs' });
    }
};

const adminApproveGig = async (req, res) => {
    try {
        const gig = await Gig.findById(req.params.id);
        if (!gig) return res.status(404).json({ message: 'Gig not found' });
        gig.isApproved = true;
        gig.approvalStatus = 'approved';
        gig.rejectionReason = '';
        await gig.save();
        res.json({ message: 'Gig approved and is now live.', gig });
    } catch (err) {
        res.status(500).json({ message: 'Failed to approve gig' });
    }
};

const adminRejectGig = async (req, res) => {
    try {
        const gig = await Gig.findById(req.params.id);
        if (!gig) return res.status(404).json({ message: 'Gig not found' });
        gig.isApproved = false;
        gig.approvalStatus = 'rejected';
        gig.rejectionReason = req.body.reason || 'Does not meet our quality standards.';
        await gig.save();
        res.json({ message: 'Gig rejected.', gig });
    } catch (err) {
        res.status(500).json({ message: 'Failed to reject gig' });
    }
};

const adminRefundCredits = async (req, res) => {
    try {
        const gig = await Gig.findById(req.params.id);
        if (!gig) return res.status(404).json({ message: 'Gig not found' });
        if (gig.approvalStatus !== 'rejected') {
            return res.status(400).json({ message: 'Credits can only be refunded for rejected gigs.' });
        }
        if (gig.creditsRefunded) {
            return res.status(400).json({ message: 'Credits have already been refunded for this gig.' });
        }
        if (!gig.creditsPaid || gig.creditsPaid <= 0) {
            return res.status(400).json({ message: 'No credits were charged for this gig (free slot used).' });
        }
        await User.updateOne({ _id: gig.sellerId }, { $inc: { credits: gig.creditsPaid } });
        gig.creditsRefunded = true;
        await gig.save();
        res.json({ message: `${gig.creditsPaid} credit(s) refunded to seller successfully.`, gig });
    } catch (err) {
        res.status(500).json({ message: 'Failed to refund credits' });
    }
};

// ─── GIG ORDERS ────────────────────────────────────────────────────────────

const placeOrder = async (req, res) => {
    try {
        const kycError = await requireKYC(req.user._id);
        if (kycError) return res.status(403).json({ message: kycError, kycRequired: true });

        const { gigId, selectedPackage, requirements } = req.body;
        if (!gigId || !selectedPackage || !requirements?.trim()) {
            return res.status(400).json({ message: 'gigId, selectedPackage, and requirements are required.' });
        }

        if (typeof requirements !== 'string' || requirements.trim().length < 10 || requirements.trim().length > 2000) {
            return res.status(400).json({ message: 'Requirements must be between 10 and 2000 characters' });
        }

        const gig = await Gig.findById(gigId).lean();
        if (!gig || !gig.isActive || !gig.isApproved) return res.status(404).json({ message: 'Gig not found or unavailable' });

        if (String(gig.sellerId) === String(req.user._id)) {
            return res.status(400).json({ message: 'You cannot order your own gig' });
        }

        const packageData = gig.packages[selectedPackage];
        if (!packageData) return res.status(400).json({ message: 'Selected package is not available' });

        const packagePrice = Number(packageData.price);
        if (!Number.isFinite(packagePrice) || packagePrice < 100 || packagePrice > 100000) {
            return res.status(400).json({ message: 'Invalid package price' });
        }

        const buyer = await User.findById(req.user._id).select('credits name');
        const seller = await User.findById(gig.sellerId).select('credits name');
        if (!buyer || !seller) return res.status(404).json({ message: 'User(s) not found' });

        if ((buyer.credits || 0) < CREDITS_PER_ORDER) {
            return res.status(400).json({ message: `You need ${CREDITS_PER_ORDER} credit to place an order. Please top up your credits.` });
        }
        if ((seller.credits || 0) < CREDITS_PER_ORDER) {
            return res.status(400).json({ message: 'This seller does not have enough credits to accept new orders right now.' });
        }

        const expiresAt = new Date(Date.now() + ORDER_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
        const order = await GigOrder.create({
            gigId,
            gigTitle: gig.title,
            buyerId: req.user._id,
            buyerName: buyer.name,
            sellerId: gig.sellerId,
            sellerName: seller.name,
            selectedPackage,
            packageSnapshot: packageData,
            requirements: requirements.trim(),
            status: 'pending_acceptance',
            buyerCreditDeducted: false,
            sellerCreditDeducted: false,
            expiresAt
        });

        await Gig.updateOne({ _id: gigId }, { $inc: { totalOrders: 1 } });
        res.status(201).json({ order });
    } catch (err) {
        console.error('[GIG ORDER] placeOrder error:', err);
        res.status(500).json({ message: 'Failed to place order' });
    }
};

const acceptOrder = async (req, res) => {
    try {
        const order = await GigOrder.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (String(order.sellerId) !== String(req.user._id)) return res.status(403).json({ message: 'Not authorized' });
        if (order.status !== 'pending_acceptance') return res.status(400).json({ message: 'Order is not pending acceptance' });

        const buyer = await User.findById(order.buyerId).select('credits');
        const seller = await User.findById(order.sellerId).select('credits');

        if ((buyer.credits || 0) < CREDITS_PER_ORDER) {
            order.status = 'cancelled';
            order.cancelledBy = 'system';
            order.cancelReason = 'Buyer had insufficient credits at time of acceptance.';
            await order.save();
            return res.status(400).json({ message: 'Buyer no longer has enough credits. Order cancelled automatically.', order });
        }
        if ((seller.credits || 0) < CREDITS_PER_ORDER) {
            return res.status(400).json({ message: 'You do not have enough credits to accept this order. Please top up.' });
        }

        const buyerResult = await User.updateOne(
            { _id: order.buyerId, credits: { $gte: CREDITS_PER_ORDER } },
            { $inc: { credits: -CREDITS_PER_ORDER } }
        );
        if (buyerResult.modifiedCount === 0) {
            return res.status(400).json({ message: 'Insufficient credits for transaction' });
        }

        const sellerResult = await User.updateOne(
            { _id: order.sellerId, credits: { $gte: CREDITS_PER_ORDER } },
            { $inc: { credits: -CREDITS_PER_ORDER } }
        );
        if (sellerResult.modifiedCount === 0) {
            await User.updateOne({ _id: order.buyerId }, { $inc: { credits: CREDITS_PER_ORDER } });
            return res.status(400).json({ message: 'Seller has insufficient credits' });
        }

        order.status = 'active';
        order.buyerCreditDeducted = true;
        order.sellerCreditDeducted = true;
        const deliveryDays = order.packageSnapshot?.deliveryDays || 3;
        order.expiresAt = new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1000);
        await order.save();

        res.json({ message: 'Order accepted. 1 credit deducted.', order });
    } catch (err) {
        console.error('[GIG ORDER] acceptOrder error:', err);
        res.status(500).json({ message: 'Failed to accept order' });
    }
};

const declineOrder = async (req, res) => {
    try {
        const order = await GigOrder.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (String(order.sellerId) !== String(req.user._id)) return res.status(403).json({ message: 'Not authorized' });
        if (order.status !== 'pending_acceptance') return res.status(400).json({ message: 'Order is not pending acceptance' });

        order.status = 'cancelled';
        order.cancelledBy = 'seller';
        order.cancelReason = req.body.reason || 'Seller declined the order.';
        await order.save();

        res.json({ message: 'Order declined.', order });
    } catch (err) {
        console.error('[GIG ORDER] declineOrder error:', err);
        res.status(500).json({ message: 'Failed to decline order' });
    }
};

const getMyPurchases = async (req, res) => {
    try {
        const orders = await GigOrder.find({ buyerId: req.user._id }).sort({ createdAt: -1 }).lean();
        res.json(orders);
    } catch (err) { res.status(500).json({ message: 'Failed to fetch orders' }); }
};

const getMySales = async (req, res) => {
    try {
        const orders = await GigOrder.find({ sellerId: req.user._id }).sort({ createdAt: -1 }).lean();
        res.json(orders);
    } catch (err) { res.status(500).json({ message: 'Failed to fetch orders' }); }
};

const cancelOrder = async (req, res) => {
    try {
        const order = await GigOrder.findOne({ _id: req.params.id, buyerId: req.user._id });
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (order.status !== 'active' && order.status !== 'pending_payment') {
            return res.status(400).json({ message: `Cannot cancel an order with status: ${order.status}` });
        }
        order.status = 'cancelled';
        order.cancelledBy = 'buyer';
        order.cancelReason = req.body.reason || 'Cancelled by buyer';
        await order.save();
        res.json({ message: 'Order cancelled. You may place a new order.' });
    } catch (err) { res.status(500).json({ message: 'Failed to cancel order' }); }
};

const completeOrder = async (req, res) => {
    try {
        const order = await GigOrder.findOne({ _id: req.params.id, sellerId: req.user._id });
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (order.status !== 'active') return res.status(400).json({ message: 'Only active orders can be completed.' });
        order.status = 'completed';
        order.completedAt = new Date();
        await order.save();
        res.json({ message: 'Order marked as completed!', order });
    } catch (err) { res.status(500).json({ message: 'Failed to complete order' }); }
};

const getOrderById = async (req, res) => {
    try {
        const order = await GigOrder.findById(req.params.id).lean();
        if (!order) return res.status(404).json({ message: 'Order not found' });
        const userId = String(req.user._id);
        if (String(order.buyerId) !== userId && String(order.sellerId) !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        res.json(order);
    } catch (err) { res.status(500).json({ message: 'Failed to fetch order' }); }
};

const expireOldOrders = async () => {
    try {
        const result = await GigOrder.updateMany(
            { status: 'active', expiresAt: { $lt: new Date() } },
            { $set: { status: 'expired' } }
        );
        if (result.modifiedCount > 0) console.log(`[GIG ORDERS] Expired ${result.modifiedCount} orders`);
    } catch (err) {
        console.error('[GIG ORDERS] expireOldOrders error:', err);
    }
};

module.exports = {
    gigUpload,
    getGigs, getCategories, getGigById, getMyGigs,
    createGig, updateGig, deleteGig,
    adminPreviewGig, adminGetPendingGigs, adminApproveGig, adminRejectGig, adminRefundCredits,
    placeOrder, acceptOrder, declineOrder, getMyPurchases, getMySales,
    cancelOrder, completeOrder, getOrderById,
    expireOldOrders
};
