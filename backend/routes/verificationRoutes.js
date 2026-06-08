const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect, admin } = require('../middleware/authMiddleware');
const {
    submitVerification,
    getPendingVerifications,
    getMyVerificationStatus,
    resolveVerification
} = require('../controllers/verificationController');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
try { if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) { console.error('Could not create uploads dir:', e.message); }

// Multer Config for KYC Document Uploads
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, uploadsDir);
    },
    filename(req, file, cb) {
        const fieldName = file.fieldname === 'selfieImage' ? 'selfie' : 'doc';
        cb(null, `kyc-${fieldName}-${req.user._id}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    fileFilter: function (req, file, cb) {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Please upload an image file'), false);
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// User routes
router.post('/', protect, upload.fields([
    { name: 'documentImage', maxCount: 1 },
    { name: 'selfieImage', maxCount: 1 }
]), submitVerification);
router.get('/me', protect, getMyVerificationStatus);

// Admin routes
router.get('/pending', protect, admin, getPendingVerifications);
router.put('/:id/resolve', protect, admin, resolveVerification);

module.exports = router;
