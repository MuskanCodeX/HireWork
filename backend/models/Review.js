const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    projectTitle: { type: String, required: true },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewerName: { type: String, required: true },
    reviewerRole: { type: String, enum: ['freelancer', 'employer', 'admin'], default: 'freelancer' },
    revieweeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    revieweeName: { type: String, required: true },
    revieweeRole: { type: String, enum: ['freelancer', 'employer', 'admin'], default: 'freelancer' },
    amount: { type: Number, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
    communicationRating: { type: Number, min: 1, max: 5, default: null },
    qualityRating: { type: Number, min: 1, max: 5, default: null },
    timelinessRating: { type: Number, min: 1, max: 5, default: null },
    wouldRecommend: { type: Boolean, default: false },
    deliveredOnTime: { type: Boolean, default: false },
}, {
    timestamps: true
});

module.exports = mongoose.model('Review', reviewSchema);
