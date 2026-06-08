const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Optional for Google Auth
    googleId: { type: String },
    role: { type: String, required: true, enum: ['freelancer', 'employer', 'admin'] },
    status: { type: String, enum: ['active', 'banned'], default: 'active' },
    avatar: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    bio: { type: String, default: '' },
    skills: { type: [String], default: [] },
    hourlyRate: { type: Number, default: 0 },
    experience: { type: String, default: '' },
    upiId: { type: String, default: '' },
    qrImage: { type: String, default: '' },
    phone: { type: String, default: '' },
    aadhaarLast4: { type: String, default: '' },
    referralCode: { type: String, unique: true },
    credits: { type: Number, default: 0 },
    referralCredits: { type: Number, default: 0 },
    freePostings: { type: Number, default: 0 },
    freeBids: { type: Number, default: 0 },
    jobsAppliedThisMonth: { type: Number, default: 0 },
    lastJobApplyDate: { type: Date },
    jobsPostedToday: { type: Number, default: 0 },
    jobsPostedThisMonth: { type: Number, default: 0 },
    lastJobPostDate: { type: Date },
    isPhoneVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    isAadhaarVerified: { type: Boolean, default: false },
    badge: { type: String, enum: ['Pro', 'Expert', ''], default: '' },
    badgeSubscriptionEnd: { type: Date },
    authCode: { type: String },
    authCodeExpires: { type: Date },
    processedPayments: { type: [String], default: [] },
    referredByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    avgRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    trustScore: { type: Number, default: 0 },
    trustBadge: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum', ''], default: '' },
    communicationRating: { type: Number, default: 0 },
    qualityRating: { type: Number, default: 0 },
    timelinessRating: { type: Number, default: 0 },
    lastReviewAt: { type: Date },
    lastActiveAt: { type: Date },
    pushOptIn: { type: Boolean, default: false },

    // Security & Fraud Prevention
    registrationIp: { type: String, default: '' },
    lastLoginIp: { type: String, default: '' },
    loginHistory: { type: [{ ip: String, timestamp: Date }], default: [] },

    // Achievement & Gamification fields
    completedProjects: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    earningsTier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum', ''], default: '' },
    achievementCount: { type: Number, default: 0 },
    responseTimeAvg: { type: Number, default: 0 }, // in minutes
    firstMessageTimes: { type: [Date], default: [] }, // Track for response time calculation
    isEarlyAdopter: { type: Boolean, default: false }
}, {
    timestamps: true
});

userSchema.index({ trustScore: -1 });
userSchema.index({ lastActiveAt: -1 });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ registrationIp: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
