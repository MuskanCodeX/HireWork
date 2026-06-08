const mongoose = require('mongoose');

const userFeedbackSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, default: '' },
    userRole: { type: String, default: 'user' },
    category: {
        type: String,
        enum: ['improvement', 'suggestion', 'bug', 'other'],
        default: 'suggestion',
    },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    pagePath: { type: String, default: '' },
    status: {
        type: String,
        enum: ['new', 'reviewed'],
        default: 'new',
    },
}, {
    timestamps: true,
});

userFeedbackSchema.index({ userId: 1, createdAt: -1 });
userFeedbackSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('UserFeedback', userFeedbackSchema);
