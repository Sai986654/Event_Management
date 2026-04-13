const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadInstantPhoto, getLivePhotos } = require('../controllers/instantPhotoController');

// Public — guest scans QR, sees last 5 photos
router.get('/live/:eventId', getLivePhotos);

// Authenticated — photographer uploads photos
router.post('/upload', protect, authorize('admin', 'organizer', 'vendor'), upload.single('file'), uploadInstantPhoto);

module.exports = router;
