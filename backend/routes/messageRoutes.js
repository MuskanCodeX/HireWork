const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { sendMessage, getChatPermissions, getMessages, getConversations, getUnreadCount, deleteConversation, getWarningStatus, clearWarnings, upload } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');
const { validateObjectId } = require('../middleware/objectIdValidation');

console.log('MessageRoutes loaded');

// Rate limiter for messages to prevent spam
const messageLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'production' ? 30 : 100,
    message: { message: 'Too many messages sent. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Use multer for file uploads - it processes multipart/form-data
// For JSON requests (no file), we use a separate handler

router.post('/', protect, messageLimiter, (req, res, next) => {
    // Check if the request is multipart (has file)
    const contentType = req.headers['content-type'] || '';
    console.log('Incoming message request:', { contentType, method: req.method, url: req.originalUrl });
    if (contentType.includes('multipart/form-data')) {
        upload.single('file')(req, res, (err) => {
            if (err) {
                return res.status(400).json({ message: 'File upload error: ' + err.message });
            }
            next();
        });
    } else {
        // JSON request, no file - body already parsed by express.json()
        next();
    }
}, sendMessage);

router.get('/conversations', protect, getConversations);
router.get('/unread-count', protect, getUnreadCount);
router.get('/warning-status', protect, getWarningStatus);
router.post('/clear-warnings', protect, clearWarnings);
router.get('/permissions/:userId', protect, validateObjectId('userId'), getChatPermissions);
router.get('/:userId', protect, getMessages);
router.delete('/:userId', protect, deleteConversation);

module.exports = router;
