const express = require('express');
const router = express.Router();
const borrowController = require('../controllers/borrowController');

// 定義路徑，並指向 Controller 中的函式
router.post('/borrow', borrowController.createBorrowRequest);
router.get('/borrow/:id', borrowController.getBorrowRequest);
router.post('/signoff', borrowController.teacherSignoff);
router.post('/ta-signoff', borrowController.taSignoff);

module.exports = router;