const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  getTemplates,
  getTemplate,
  createSurprisePage,
  getMySurprisePages,
  getSurprisePage,
  updateSurprisePage,
  deleteSurprisePage,
  viewSurpriseBySlug,
  trackInteraction,
  getSurpriseAnalytics,
  publishSurprisePage,
  unpublishSurprisePage,
  trackingPixel,
} = require('../controllers/surpriseController');

// ── Public routes (no auth) ───────────────────────────────────────

// View a surprise experience by slug
router.get('/view/:slug', viewSurpriseBySlug);

// Track user interaction (no auth — viewer is the recipient)
router.post(
  '/view/:slug/interact',
  [
    body('sessionId').optional().isString(),
    body('stepReached').optional().isInt({ min: 0 }),
    body('completed').optional().isBoolean(),
    body('reaction').optional().isString().isLength({ max: 50 }),
  ],
  validate,
  trackInteraction
);

// Browse templates (public)
router.get('/templates', getTemplates);
router.get('/templates/:id', getTemplate);

// Tracking pixel (public, returns 1×1 gif)
router.get('/view/:slug/pixel', trackingPixel);

// ── Protected routes (auth required) ──────────────────────────────
router.use(protect);

// CRUD for surprise pages
router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('recipientName').trim().notEmpty().withMessage('Recipient name is required'),
    body('senderName').trim().notEmpty().withMessage('Sender name is required'),
    body('category')
      .optional()
      .isIn(['proposal', 'birthday', 'anniversary', 'apology', 'congratulations', 'other'])
      .withMessage('Invalid category'),
  ],
  validate,
  createSurprisePage
);

router.get('/', getMySurprisePages);
router.get('/:id', getSurprisePage);
router.put('/:id', updateSurprisePage);
router.delete('/:id', deleteSurprisePage);

// Analytics
router.get('/:id/analytics', getSurpriseAnalytics);

// Publish / Deploy
router.post('/:id/publish', publishSurprisePage);
router.post('/:id/unpublish', unpublishSurprisePage);

module.exports = router;
