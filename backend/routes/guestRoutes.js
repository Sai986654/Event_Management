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
  getInviteTemplates,
  getPersonalizedInvite,
  generatePersonalizedInviteForGuest,
  generatePersonalizedInvitesBulk,
} = require('../controllers/guestController');
const { getInviteTemplateKeys } = require('../services/personalizedInviteService');

const validateTemplateKey = (field, label) =>
  body(field)
    .optional()
    .custom(async (value) => {
      const candidate = String(value || '').toLowerCase();
      if (!candidate) return true;
      const keys = await getInviteTemplateKeys();
      if (!keys.includes(candidate)) {
        throw new Error(`${label} is invalid`);
      }
      return true;
    });

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
    validateTemplateKey('inviteTemplateKey', 'inviteTemplateKey'),
    validateTemplateKey('templateKey', 'templateKey'),
  ],
  validate,
  addGuest
);

router.post('/bulk', authorize('admin', 'organizer'), addGuestsBulk);
router.get('/', authorize('admin', 'organizer'), getGuests);
router.get('/invite-templates', authorize('admin', 'organizer'), getInviteTemplates);
router.get('/:id/personalized-invite', authorize('admin', 'organizer'), getPersonalizedInvite);
router.post(
  '/:id/personalized-invite/generate',
  authorize('admin', 'organizer'),
  [
    body('language').optional().isIn(['en', 'te']).withMessage('language must be one of en, te'),
    body('tone').optional().isIn(['formal', 'friendly', 'emotional']).withMessage('tone must be formal, friendly, or emotional'),
    validateTemplateKey('inviteTemplateKey', 'inviteTemplateKey'),
    validateTemplateKey('templateKey', 'templateKey'),
  ],
  validate,
  generatePersonalizedInviteForGuest
);
router.post(
  '/personalized-invites/generate-bulk',
  authorize('admin', 'organizer'),
  [
    body('eventId').optional().isInt().withMessage('eventId must be an integer'),
    body('event').optional().isInt().withMessage('event must be an integer'),
    body('defaultLanguage').optional().isIn(['en', 'te']).withMessage('defaultLanguage must be one of en, te'),
    body('defaultTone').optional().isIn(['formal', 'friendly', 'emotional']).withMessage('defaultTone must be formal, friendly, or emotional'),
    validateTemplateKey('defaultTemplateKey', 'defaultTemplateKey'),
  ],
  validate,
  generatePersonalizedInvitesBulk
);
router.post('/:id/checkin', authorize('admin', 'organizer'), checkInGuest);
router.post('/scan', authorize('admin', 'organizer'), scanQR);
router.delete('/:id', authorize('admin', 'organizer'), deleteGuest);

module.exports = router;
