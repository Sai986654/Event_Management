const router = require('express').Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { getActivitiesByOrder, updateActivityProgress } = require('../controllers/activityController');

router.use(protect);

router.get('/order/:orderId', authorize('admin', 'organizer', 'customer', 'vendor'), getActivitiesByOrder);
router.patch(
  '/:id/progress',
  authorize('admin', 'organizer'),
  [
    body('progressPercent').optional().isInt({ min: 0, max: 100 }).withMessage('progressPercent must be 0-100'),
    body('status')
      .optional()
      .isIn(['not_started', 'in_progress', 'completed', 'blocked'])
      .withMessage('Invalid activity status'),
    body('spendActual').optional().isFloat({ min: 0 }).withMessage('spendActual must be >= 0'),
  ],
  validate,
  updateActivityProgress
);

module.exports = router;
