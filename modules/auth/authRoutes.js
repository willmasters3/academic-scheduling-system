const express = require('express');
const authController = require('./authController');

const router = express.Router();

router.post('/login', authController.login);
router.post('/login/temporary-password', authController.completeTemporaryPassword);
router.get('/user-info', authController.userInfo);
router.get('/session-info', authController.sessionInfo);
router.post('/logout', authController.logout);

module.exports = router;
