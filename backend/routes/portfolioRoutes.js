const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect, admin } = require('../middleware/authMiddleware');
const {
    submitPortfolio,
    getMyPortfolio,
    getUserPortfolio,
    getPendingPortfolios,
    resolvePortfolio
} = require('../controllers/portfolioController');
const fs = require('fs');

// Ensure uploads/portfolio directory exists
const uploadsDir = path.join(__dirname, '../uploads/portfolio');
try { if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) { console.error('Could not create uploads/portfolio dir:', e.message); }

// Multer Config for Portfolio Image Uploads
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, uploadsDir);
    },
    filename(req, file, cb) {
        cb(null, `portfolio-${req.user._id}-${Date.now()}-${Math.floor(Math.random() * 1000)}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    fileFilter: function (req, file, cb) {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Please upload image files only'), false);
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Public routes
router.get('/user/:userId', getUserPortfolio);

// User routes (Private)
router.post('/', protect, upload.array('images', 3), submitPortfolio);
router.get('/me', protect, getMyPortfolio);

// Admin routes (Private/Admin)
router.get('/admin/pending', protect, admin, getPendingPortfolios);
router.put('/admin/:id/resolve', protect, admin, resolvePortfolio);

module.exports = router;
