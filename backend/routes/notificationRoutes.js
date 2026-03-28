const router = require('express').Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  sendEmailNotification,
  sendSMSNotification,
  analyzeContactGraph,
  correlateContactSelection,
  sendEventWhatsAppReminders,
} = require('../controllers/notificationController');

router.use(protect);
router.use(authorize('admin', 'organizer'));

router.post('/email', sendEmailNotification);
router.post('/sms', sendSMSNotification);
router.post(
  '/contacts/analyze',
  [
    body('contacts').optional().isArray(),
    body('csv').optional().isString(),
    body('useOpenAi').optional().isBoolean(),
    body().custom((_, { req }) => {
      const hasCsv = typeof req.body.csv === 'string' && req.body.csv.trim().length > 0;
      const hasContacts = Array.isArray(req.body.contacts) && req.body.contacts.length > 0;
      if (hasCsv || hasContacts) return true;
      throw new Error('Provide contacts (non-empty array) or csv (non-empty string)');
    }),
  ],
  validate,
  analyzeContactGraph
);
router.post(
  '/contacts/correlate',
  [
    body('contacts').isArray({ min: 2 }),
    body('listOwnerContext').optional().isString(),
    body('listOwnerNotes').optional().isString(),
  ],
  validate,
  correlateContactSelection
);
router.post(
  '/events/:eventId/reminders/whatsapp',
  [
    body('group').optional().isIn(['all', 'relatives', 'friends', 'work', 'others']),
    body('message').optional().isString(),
    body('templateName').optional().isString(),
  ],
  validate,
  sendEventWhatsAppReminders
);

module.exports = router;
