const express = require('express');
const router = express.Router();
const controller = require('../controllers/scheduleController');

// GET /bookings/schedule?date=...&classroom_id=...
router.get('/', controller.getSchedule);

module.exports = router;