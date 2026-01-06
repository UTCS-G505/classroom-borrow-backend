const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');

// 登入 API (SSO + JWT)
router.post('/login', usersController.login);

// Refresh Token API
router.post('/refresh', usersController.refreshToken);

// 取得使用者資料 (需驗證 Token)
router.get(
  '/user/profile',
  usersController.authenticateToken,
  usersController.getProfile
);

module.exports = router;
