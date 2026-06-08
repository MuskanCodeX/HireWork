const mongoose = require('mongoose');

const gigPackageSchema = new mongoose.Schema({
    title: { type: String, required: true }, // e.g. Basic, Standard, Premium
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    deliveryDays: { type: Number, required: true },
    revisions: { type: String, default: '1' }, // '1', '3', 'unlimited'
    features: [{ type: String }]
}, { _id: false });

const gigSchema = new mongoose.Schema({
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sellerName: { type: String, required: true },
    sellerAvatar: { type: String, default: null },

    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, maxlength: 3000 },
    category: { type: String, required: true }, // e.g. "Web Development", "Design", "Writing"
    tags: [{ type: String }],

    coverImage: { type: String, default: null }, // uploaded image path
    gallery: [{ type: String }], // extra images

    packages: {
        basic: { type: gigPackageSchema, required: true },
        standard: { type: gigPackageSchema, default: null },
        premium: { type: gigPackageSchema, default: null }
    },

    isActive: { type: Boolean, default: true },
    isApproved: { type: Boolean, default: false }, // must be approved by admin before going live
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    rejectionReason: { type: String, default: '' },

    creditsPaid: { type: Number, default: 0 },       // credits charged when posting (0 = free slot)
    creditsRefunded: { type: Boolean, default: false }, // admin-triggered refund done?

    totalOrders: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 }
}, { timestamps: true });

gigSchema.index({ sellerId: 1 });
gigSchema.index({ category: 1 });
gigSchema.index({ isActive: 1, isApproved: 1 });

module.exports = mongoose.model('Gig', gigSchema);
