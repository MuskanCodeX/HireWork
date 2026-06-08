const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userBadge: { type: String, default: '' },
    title: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true },
    description: { type: String, required: true },
    budget: { type: Number, required: true },
    bids: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: String,
        amount: Number,
        proposal: String,
        createdAt: { type: Date, default: Date.now }
    }],
    status: { type: String, default: 'open' }, // open, awarded
    awardedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    awardedToName: { type: String },
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract' },
    pendingAgreementTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pendingAgreementToName: { type: String },
    pendingContractId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract' },
    aiScreening: {
        score: { type: Number, default: 0 },
        severity: { type: String, default: 'low' },
        verdict: { type: String, default: 'clear' },
        flags: { type: [String], default: [] },
        blocked: { type: Boolean, default: false },
        notes: { type: String, default: '' },
        provider: { type: String, default: '' },
        checkedAt: { type: Date }
    }
}, {
    timestamps: true
});

// Indexes for getProjects and getMyProjects heavy queries
projectSchema.index({ status: 1, createdAt: -1 });
projectSchema.index({ user: 1 });
projectSchema.index({ awardedTo: 1 });
projectSchema.index({ budget: 1 });
projectSchema.index({ 'bids.userId': 1 });

module.exports = mongoose.model('Project', projectSchema);
