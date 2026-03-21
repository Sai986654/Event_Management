const router = require('express').Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createOrderQuote, placeOrder, getOrders } = require('../controllers/orderController');

router.use(protect);

router.get('/', authorize('admin', 'organizer', 'customer', 'vendor'), getOrders);
router.post(
  '/quote',
  authorize('admin', 'customer', 'organizer'),
  [
    body('eventId').isInt({ min: 1 }).withMessage('Valid eventId is required'),
    body('selections').isArray({ min: 1 }).withMessage('At least one selection is required'),
  ],
  validate,
  createOrderQuote
);
router.patch('/:id/place', authorize('admin', 'customer'), placeOrder);

module.exports = router;
