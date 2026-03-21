const router = require('express').Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  sendEmailNotification,
  sendSMSNotification,
  analyzeContactGraph,
  sendEventWhatsAppReminders,
} = require('../controllers/notificationController');

router.use(protect);
router.use(authorize('admin', 'organizer'));

router.post('/email', sendEmailNotification);
router.post('/sms', sendSMSNotification);
router.post(
  '/contacts/analyze',
  [
    body('contacts').isArray().withMessage('contacts must be an array'),
  ],
  validate,
  analyzeContactGraph
);
router.post(
  '/events/:eventId/reminders/whatsapp',
  [
    body('group').optional().isIn(['all', 'relatives', 'friends', 'others']),
    body('message').optional().isString(),
    body('templateName').optional().isString(),
  ],
  validate,
  sendEventWhatsAppReminders
);

module.exports = router;
