const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const {
  createBudget,
  getBudget,
  updateBudget,
  autoAllocate,
} = require('../controllers/budgetController');

router.use(protect);
router.use(authorize('admin', 'organizer'));

router.post(
  '/',
  [
    body('event').isInt().withMessage('Valid event ID is required'),
    body('totalBudget').isNumeric().withMessage('Total budget is required'),
    body('guestCount').isInt({ min: 1 }).withMessage('Guest count must be at least 1'),
  ],
  validate,
  createBudget
);

router.get('/:eventId', getBudget);
router.put('/:eventId', updateBudget);
router.post('/:eventId/auto-allocate', autoAllocate);

module.exports = router;
