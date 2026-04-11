const router = require('express').Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  getAISuggestions,
  getPlannerCopilot,
  getBudgetOptimizer,
  postAutoRebalance,
  createEventCollageJob,
  getEventCollageJobStatus,
  getVendorFit,
} = require('../controllers/aiController');

router.post('/suggestions', protect, getAISuggestions);
router.post(
  '/vendor-fit',
  protect,
  [
    body('eventId').isInt({ min: 1 }).withMessage('Valid eventId is required'),
    body('category').optional().isString().withMessage('category must be a string'),
  ],
  validate,
  getVendorFit
);
router.post(
  '/planner-copilot',
  protect,
  [body('eventId').isInt({ min: 1 }).withMessage('Valid eventId is required')],
  validate,
  getPlannerCopilot
);
router.post(
  '/budget-optimizer',
  protect,
  [
    body('eventId').isInt({ min: 1 }).withMessage('Valid eventId is required'),
    body('packageIds').isArray({ min: 1 }).withMessage('At least one packageId is required'),
    body('guestCount').optional().isInt({ min: 1 }).withMessage('guestCount must be a positive integer'),
    body('budget').optional().isFloat({ min: 0 }).withMessage('budget must be a non-negative number'),
  ],
  validate,
  getBudgetOptimizer
);
router.post(
  '/auto-rebalance',
  protect,
  [
    body('eventId').isInt({ min: 1 }).withMessage('Valid eventId is required'),
    body('packageIds').isArray({ min: 1 }).withMessage('At least one packageId is required'),
    body('guestCount').optional().isInt({ min: 1 }).withMessage('guestCount must be a positive integer'),
    body('budget').optional().isFloat({ min: 0 }).withMessage('budget must be a non-negative number'),
  ],
  validate,
  postAutoRebalance
);
router.post(
  '/collage/event/:eventId',
  protect,
  [body('style').optional().isIn(['traditional', 'modern', 'cinematic']).withMessage('Invalid collage style')],
  validate,
  createEventCollageJob
);
router.get('/collage/event/:eventId/status', protect, getEventCollageJobStatus);

module.exports = router;
