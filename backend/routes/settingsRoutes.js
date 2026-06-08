const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { settings } = require('../models/db');

const getMaintenanceSettings = asyncHandler(async (req, res) => {
    try {
        const siteSettings = await settings.findOne().select('maintenanceMode maintenanceEndTime whatsappLink instagramLink').maxTimeMS(1000).lean();
        
        res.json({
            maintenanceMode: siteSettings?.maintenanceMode || false,
            endTime: siteSettings?.maintenanceEndTime ? new Date(siteSettings.maintenanceEndTime).getTime() : null,
            whatsappLink: siteSettings?.whatsappLink || 'https://wa.me/910000000000',
            instagramLink: siteSettings?.instagramLink || 'https://instagram.com/hirework.in'
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch settings' });
    }
});

router.get('/maintenance', asyncHandler(getMaintenanceSettings));

module.exports = router;
