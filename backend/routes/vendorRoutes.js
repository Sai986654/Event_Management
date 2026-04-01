const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  createVendor,
  getVendors,
  getVendor,
  updateVendor,
  uploadVendorMedia,
  deleteVendor,
  addReview,
  getReviews,
} = require('../controllers/vendorController');

router.get('/', getVendors);
router.get('/:id', getVendor);
router.get('/:id/reviews', getReviews);

// Protected routes
router.use(protect);

router.post(
  '/',
  authorize('admin', 'vendor'),
  [
    body('businessName').trim().notEmpty().withMessage('Business name is required'),
    body('category')
      .isIn([
        'catering', 'decor', 'photography', 'videography',
        'music', 'venue', 'florist', 'transportation', 'other',
      ])
      .withMessage('Invalid category'),
  ],
  validate,
  createVendor
);

router.put('/:id', authorize('admin', 'vendor'), updateVendor);
router.post('/:id/media', authorize('admin', 'vendor'), upload.single('file'), uploadVendorMedia);
router.delete('/:id', authorize('admin', 'vendor'), deleteVendor);

router.post(
  '/:id/reviews',
  authorize('admin', 'organizer'),
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  ],
  validate,
  addReview
);

module.exports = router;
