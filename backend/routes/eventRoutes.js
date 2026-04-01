const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const {
  createEvent,
  getEvents,
  getEvent,
  getEventBySlug,
  updateEvent,
  deleteEvent,
  updateTasks,
  updateTimeline,
  triggerInviteDrip,
  publishEventNetlify,
} = require('../controllers/eventController');

// Public route — get event by slug
router.get('/slug/:slug', getEventBySlug);

// Protected routes
router.use(protect);

router.post(
  '/',
  authorize('admin', 'organizer', 'customer'),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('type')
      .isIn(['wedding', 'corporate', 'birthday', 'conference', 'concert', 'other'])
      .withMessage('Invalid event type'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('venue').trim().notEmpty().withMessage('Venue is required'),
  ],
  validate,
  createEvent
);

router.get('/', getEvents);
router.post(
  '/:id/invite-drip/trigger',
  authorize('admin', 'organizer', 'customer'),
  triggerInviteDrip
);
router.post('/:id/publish-netlify', authorize('admin', 'organizer'), publishEventNetlify);
router.get('/:id', getEvent);
router.put('/:id', authorize('admin', 'organizer', 'customer'), updateEvent);
router.delete('/:id', authorize('admin', 'organizer', 'customer'), deleteEvent);
router.put('/:id/tasks', authorize('admin', 'organizer'), updateTasks);
router.put('/:id/timeline', authorize('admin', 'organizer'), updateTimeline);

module.exports = router;
