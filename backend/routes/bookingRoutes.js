const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const {
  createBooking,
  getBookings,
  updateBookingStatus,
  deleteBooking,
} = require('../controllers/bookingController');

router.use(protect);

router.post(
  '/',
  authorize('admin', 'organizer', 'customer'),
  [
    body('event').isInt().withMessage('Valid event ID is required'),
    body('vendor').isInt().withMessage('Valid vendor ID is required'),
    body('price').isNumeric().withMessage('Price is required'),
    body('serviceDate').isISO8601().withMessage('Valid service date is required'),
  ],
  validate,
  createBooking
);

router.get('/', getBookings);

router.put(
  '/:id/status',
  authorize('admin', 'organizer', 'vendor'),
  [
    body('status')
      .isIn(['pending', 'confirmed', 'cancelled', 'completed'])
      .withMessage('Invalid status'),
  ],
  validate,
  updateBookingStatus
);

router.delete('/:id', authorize('admin', 'organizer', 'customer'), deleteBooking);

module.exports = router;
