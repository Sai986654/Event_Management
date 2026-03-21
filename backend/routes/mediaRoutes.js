const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  uploadMedia,
  getMedia,
  approveMedia,
  flagMedia,
  deleteMedia,
  uploadPublicBlessing,
} = require('../controllers/mediaController');

// Public gallery endpoint
router.get('/', getMedia);
router.post('/public-blessing', upload.single('file'), uploadPublicBlessing);

// Protected routes
router.post('/', protect, authorize('admin', 'organizer', 'customer'), upload.single('file'), uploadMedia);
router.put('/:id/approve', protect, authorize('admin', 'organizer'), approveMedia);
router.put('/:id/flag', protect, authorize('admin', 'organizer'), flagMedia);
router.delete('/:id', protect, authorize('admin', 'organizer'), deleteMedia);

module.exports = router;
