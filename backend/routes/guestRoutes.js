const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const {
  addGuest,
  addGuestsBulk,
  getGuests,
  updateRSVP,
  checkInGuest,
  scanQR,
  deleteGuest,
} = require('../controllers/guestController');

// Public RSVP endpoint
router.put(
  '/:id/rsvp',
  [
    body('rsvpStatus')
      .isIn(['pending', 'accepted', 'declined', 'maybe'])
      .withMessage('Invalid RSVP status'),
  ],
  validate,
  updateRSVP
);

// Protected routes
router.use(protect);

router.post(
  '/',
  authorize('admin', 'organizer'),
  [
    body('event').isInt().withMessage('Valid event ID is required'),
    body('name').trim().notEmpty().withMessage('Guest name is required'),
  ],
  validate,
  addGuest
);

router.post('/bulk', authorize('admin', 'organizer'), addGuestsBulk);
router.get('/', authorize('admin', 'organizer'), getGuests);
router.post('/:id/checkin', authorize('admin', 'organizer'), checkInGuest);
router.post('/scan', authorize('admin', 'organizer'), scanQR);
router.delete('/:id', authorize('admin', 'organizer'), deleteGuest);

module.exports = router;
