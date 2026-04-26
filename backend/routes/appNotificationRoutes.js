const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { listNotifications, markRead, markAllRead, deleteNotification, deleteAllNotifications } = require('../controllers/appNotificationController');

router.use(protect);

router.get('/', listNotifications);
router.put('/read-all', markAllRead);
router.delete('/delete-all', deleteAllNotifications);
router.put('/:id/read', markRead);
router.delete('/:id', deleteNotification);

module.exports = router;
