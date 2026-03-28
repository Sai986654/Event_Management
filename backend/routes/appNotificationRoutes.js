const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { listNotifications, markRead, markAllRead } = require('../controllers/appNotificationController');

router.use(protect);

router.get('/', listNotifications);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);

module.exports = router;
