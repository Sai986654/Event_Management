const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { autocomplete, placeDetails } = require('../controllers/locationController');

router.use(protect, authorize('admin', 'organizer', 'customer', 'vendor'));
router.get('/autocomplete', autocomplete);
router.get('/place/:placeId', placeDetails);

module.exports = router;
