const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect, admin } = require('../middleware/authMiddleware');
const { submitFeedback, getAllFeedback } = require('../controllers/feedbackController');

const router = express.Router();

router.post('/', protect, asyncHandler(submitFeedback));
router.get('/admin/all', protect, admin, asyncHandler(getAllFeedback));

module.exports = router;
