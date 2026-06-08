const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    externalLink: { type: String },
    images: [{ type: String }], // Array of filenames
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    adminFeedback: { type: String, default: '' }
}, {
    timestamps: true
});

// Index for quick lookup of a user's approved portfolio items
portfolioSchema.index({ user: 1, status: 1 });
// Index for admin to find pending items
portfolioSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Portfolio', portfolioSchema);
