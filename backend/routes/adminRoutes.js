const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const {
  verifyVendor,
  createUserByAdmin,
  getCategories,
  createCategory,
  deleteCategory,
  getInviteTemplates,
  createInviteTemplate,
  updateInviteTemplate,
  deleteInviteTemplate,
  getAllVendors,
  deleteVendor,
  syncVendorsFromGoogleForms,
} = require('../controllers/adminController');

router.use(protect);

// Categories listing is available to all authenticated users
router.get('/categories', getCategories);

// Everything below is admin-only
router.use(authorize('admin'));

router.patch(
  '/vendors/:vendorId/verify',
  [body('status').isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status')],
  validate,
  verifyVendor
);

router.post(
  '/users',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('role').isIn(['admin', 'organizer', 'customer', 'vendor', 'guest']).withMessage('Invalid role'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 chars'),
  ],
  validate,
  createUserByAdmin
);

// Category management (create/delete admin-only)
router.post(
  '/categories',
  [
    body('name').trim().notEmpty().withMessage('Category name is required'),
    body('label').optional().trim(),
    body('color').optional().trim(),
  ],
  validate,
  createCategory
);
router.delete('/categories/:id', deleteCategory);

// Invite template management
router.get('/invite-templates', getInviteTemplates);
router.post(
  '/invite-templates',
  [
    body('name').trim().notEmpty().withMessage('Template name is required'),
    body('key').optional().trim(),
    body('description').optional().trim(),
    body('palette').optional().isObject().withMessage('palette must be an object'),
    body('sortOrder').optional().isInt().withMessage('sortOrder must be an integer'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  ],
  validate,
  createInviteTemplate
);
router.patch(
  '/invite-templates/:id',
  [
    body('name').optional().trim(),
    body('key').optional().trim(),
    body('description').optional().trim(),
    body('palette').optional().isObject().withMessage('palette must be an object'),
    body('sortOrder').optional().isInt().withMessage('sortOrder must be an integer'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  ],
  validate,
  updateInviteTemplate
);
router.delete('/invite-templates/:id', deleteInviteTemplate);

// Vendor management
router.get('/vendors', getAllVendors);
router.delete('/vendors/:id', deleteVendor);
router.post(
  '/vendors/sync-google-forms',
  [body('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1-500')],
  validate,
  syncVendorsFromGoogleForms
);

module.exports = router;
