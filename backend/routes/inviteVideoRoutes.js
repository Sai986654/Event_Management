const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  createInviteJob,
  getInviteJob,
  getJobsByEvent,
  retryFailedGuests,
} = require('../controllers/inviteVideoController');

// Accept up to 5 images + 1 music file
const inviteUpload = upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'music', maxCount: 1 },
]);

// All routes require authentication
router.use(protect);

// Create a new invite video job
router.post('/', authorize('admin', 'organizer'), inviteUpload, createInviteJob);

// Get job status + per-guest progress
router.get('/:jobId', authorize('admin', 'organizer'), getInviteJob);

// List all jobs for an event
router.get('/event/:eventId', authorize('admin', 'organizer'), getJobsByEvent);

// Retry failed guests
router.post('/:jobId/retry', authorize('admin', 'organizer'), retryFailedGuests);

module.exports = router;
