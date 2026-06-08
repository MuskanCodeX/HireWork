const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect } = require('../middleware/authMiddleware');
const { registerPushSubscription, unregisterPushSubscription, sendTestPush } = require('../controllers/pushController');

const router = express.Router();

router.post('/subscribe', protect, asyncHandler(registerPushSubscription));
router.post('/unsubscribe', protect, asyncHandler(unregisterPushSubscription));
router.post('/test', protect, asyncHandler(sendTestPush));

module.exports = router;
