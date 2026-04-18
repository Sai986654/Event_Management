const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
  getThreads,
  createThread,
  getMessages,
  sendMessage,
  closeThread,
} = require('../controllers/chatController');

router.use(protect);

router.get('/threads', getThreads);
router.post('/threads', createThread);
router.get('/threads/:threadId/messages', getMessages);
router.post('/threads/:threadId/messages', sendMessage);
router.patch('/threads/:threadId/close', closeThread);

module.exports = router;
