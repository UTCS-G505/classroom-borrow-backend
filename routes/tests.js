const express = require('express');
const router = express.Router();
const controller = require('../controllers/testsController');

// GET /bookings/schedule?date=...&classroom_id=...
router.get('/1', 
    //#swagger.description = '測試'
    
    controller.test1);

module.exports = router;

router.get('/2', 
    //#swagger.description = '取得schedule'
    controller.test2);

module.exports = router;

router.get('/3',
    //#swagger.description = '取得borrowrequest'
    controller.test3
);