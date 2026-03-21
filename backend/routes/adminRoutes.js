const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { verifyVendor, createUserByAdmin } = require('../controllers/adminController');

router.use(protect);
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

module.exports = router;
