const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const {
  createPackage,
  getMyPackages,
  getPublicPackages,
  updatePackage,
  deletePackage,
  addTestimonial,
  getVendorTestimonials,
} = require('../controllers/vendorPackageController');

router.get('/', getPublicPackages);
router.get('/vendor/:vendorId/testimonials', getVendorTestimonials);

router.use(protect);
router.get('/mine', authorize('vendor', 'admin'), getMyPackages);

router.post(
  '/',
  authorize('vendor', 'admin'),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('category')
      .isIn(['catering', 'decor', 'photography', 'videography', 'music', 'venue', 'florist', 'transportation', 'other'])
      .withMessage('Invalid category'),
    body('basePrice').optional().isFloat({ min: 0 }).withMessage('basePrice must be >= 0'),
  ],
  validate,
  createPackage
);

router.put('/:id', authorize('vendor', 'admin'), updatePackage);
router.delete('/:id', authorize('vendor', 'admin'), deletePackage);

router.post(
  '/testimonials',
  authorize('vendor', 'admin'),
  [
    body('clientName').trim().notEmpty().withMessage('Client name is required'),
    body('content').trim().notEmpty().withMessage('Testimonial content is required'),
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  ],
  validate,
  addTestimonial
);

module.exports = router;
