const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect } = require('../middleware/authMiddleware');
const {
    getBidSuggestion,
    manualScreenProject,
    screenAgreement,
    enhanceProject,
    getSmartPricing,
    scoreBid,
    getMatchedFreelancers,
    chatbotAssist
} = require('../controllers/aiController');

const router = express.Router();

// Existing routes
router.post('/bid-suggestion', protect, asyncHandler(getBidSuggestion));
router.post('/screen-project', protect, asyncHandler(manualScreenProject));
router.post('/screen-agreement', protect, asyncHandler(screenAgreement));

// New AI enhancement routes
router.post('/enhance-project', protect, asyncHandler(enhanceProject));
router.post('/smart-pricing', protect, asyncHandler(getSmartPricing));
router.post('/score-bid', protect, asyncHandler(scoreBid));
router.post('/match-freelancers', protect, asyncHandler(getMatchedFreelancers));
router.post('/chatbot', protect, asyncHandler(chatbotAssist));

module.exports = router;
