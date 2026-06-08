const mongoose = require('mongoose');

const gigOrderSchema = new mongoose.Schema({
    gigId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', required: true },
    gigTitle: { type: String, required: true },

    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    buyerName: { type: String, required: true },

    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sellerName: { type: String, required: true },

    selectedPackage: { type: String, enum: ['basic', 'standard', 'premium'], required: true },
    packageSnapshot: { type: Object, required: true }, // snapshot of package at order time

    // Requirements text (like agreement) the buyer submits
    requirements: { type: String, required: true, maxlength: 5000 },

    // pending_acceptance → active → completed | cancelled
    status: {
        type: String,
        enum: ['pending_acceptance', 'active', 'completed', 'cancelled', 'expired'],
        default: 'pending_acceptance'
    },

    // Both sides pay 1 credit on order placement
    buyerCreditDeducted: { type: Boolean, default: false },
    sellerCreditDeducted: { type: Boolean, default: false },

    // Auto-expire in 3 days if buyer doesn't confirm
    expiresAt: { type: Date, required: true },

    cancelledBy: { type: String, enum: ['buyer', 'system'], default: null },
    cancelReason: { type: String, default: '' },

    completedAt: { type: Date, default: null }
}, { timestamps: true });

gigOrderSchema.index({ buyerId: 1 });
gigOrderSchema.index({ sellerId: 1 });
gigOrderSchema.index({ gigId: 1 });
gigOrderSchema.index({ expiresAt: 1 }); // for expiry cron

module.exports = mongoose.model('GigOrder', gigOrderSchema);
