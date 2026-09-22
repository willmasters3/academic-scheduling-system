const express = require('express');
const chatController = require('./chatController');
const { requireAuthenticatedSession } = require('../../middlewares/authMiddleware');

const router = express.Router();

router.post('/api/chat', requireAuthenticatedSession, chatController.legacyApiChat);
router.post('/chat', chatController.chat);
router.post('/api/finder-voice/interpret', chatController.interpretFinderVoice);

module.exports = router;
