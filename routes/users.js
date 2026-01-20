const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const authMiddleware = require('../middleware/authMiddleware');

// 取得使用者資料 (需驗證 Token)
router.get(
  '/profile',
  authMiddleware.authenticateToken,
  usersController.getProfile
);

module.exports = router;
