const express = require('express');
const router = express.Router();
const controller = require('../controllers/testsController');

// GET /bookings/schedule?date=...&classroom_id=...
router.get('/1', 
    
    controller.test1);

module.exports = router;

router.get('/2', 
    
    controller.test2);

module.exports = router;