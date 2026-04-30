const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const {
  getInviteDesignTemplates,
  listInviteDesigns,
  createInviteDesign,
  getInviteDesignById,
  updateInviteDesign,
  duplicateInviteDesign,
  exportInviteDesign,
  listInviteDesignExports,
  attachDesignToGuest,
  generateAndSendFromDesign,
} = require('../controllers/inviteDesignController');

router.use(protect);
router.use(authorize('admin', 'organizer'));

router.get('/templates', getInviteDesignTemplates);
router.get('/designs', listInviteDesigns);

router.post(
  '/designs',
  [
    body('eventId').isInt().withMessage('eventId must be an integer'),
    body('name').trim().notEmpty().withMessage('name is required'),
    body('status').optional().isIn(['draft', 'published', 'archived']).withMessage('Invalid status'),
    body('jsonLayout').optional().isObject().withMessage('jsonLayout must be an object'),
  ],
  validate,
  createInviteDesign
);

router.get('/designs/:id', getInviteDesignById);

router.patch(
  '/designs/:id',
  [
    body('status').optional().isIn(['draft', 'published', 'archived']).withMessage('Invalid status'),
    body('jsonLayout').optional().isObject().withMessage('jsonLayout must be an object'),
    body('assets').optional().isArray().withMessage('assets must be an array'),
  ],
  validate,
  updateInviteDesign
);

router.post('/designs/:id/duplicate', duplicateInviteDesign);

router.post(
  '/designs/:id/export',
  [
    body('format').isIn(['png', 'jpg', 'pdf']).withMessage('format must be png, jpg, or pdf'),
    body('width').optional().isInt({ min: 1 }).withMessage('width must be a positive integer'),
    body('height').optional().isInt({ min: 1 }).withMessage('height must be a positive integer'),
  ],
  validate,
  exportInviteDesign
);

router.get('/designs/:id/exports', listInviteDesignExports);

router.post(
  '/designs/:id/personalize/:guestId',
  [body('layoutOverrides').optional().isObject().withMessage('layoutOverrides must be an object')],
  validate,
  attachDesignToGuest
);

router.post(
  '/designs/:id/send',
  [
    body('sendVia').optional().isIn(['email', 'whatsapp', 'both']).withMessage('sendVia must be email, whatsapp, or both'),
    body('guestIds').optional().isArray().withMessage('guestIds must be an array'),
  ],
  validate,
  generateAndSendFromDesign
);

module.exports = router;
