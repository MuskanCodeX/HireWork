const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Achievement details
    achievementId: { type: String, required: true }, // e.g., 'first_project', 'verified_100_projects'
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, default: '🏆' }, // Emoji or icon identifier
    category: { 
        type: String, 
        enum: ['project', 'earnings', 'verification', 'community', 'special'], 
        default: 'project' 
    },
    
    // Achievement tier
    tier: { 
        type: String, 
        enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'], 
        default: 'bronze' 
    },
    
    // Progress tracking
    currentProgress: { type: Number, default: 0 },
    targetProgress: { type: Number, required: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
    
    // Display settings
    isVisible: { type: Boolean, default: true },
    isPinned: { type: Boolean, default: false },
    
    // Metadata
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
    timestamps: true
});

// Indexes
achievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });
achievementSchema.index({ userId: 1, isCompleted: 1 });
achievementSchema.index({ userId: 1, isPinned: -1, completedAt: -1 });

module.exports = mongoose.model('Achievement', achievementSchema);
