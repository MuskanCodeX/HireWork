const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    platformName: { type: String, default: 'HIREWORK' },
    defaultNewUserCredits: { type: Number, default: 3 },
    referralBonusCredits: { type: Number, default: 1 },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceEndTime: { type: Date, default: null },
    whatsappLink: { type: String, default: 'https://wa.me/91' },
    instagramLink: { type: String, default: 'https://instagram.com/hirework.in' },
    allowedFileTypes: { type: [String], default: ['image/jpeg', 'image/png', 'application/pdf'] },
    contactEmail: { type: String, default: 'support@hirework-freelance-platform.vercel.app' }
}, {
    timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
