const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminsController');

router.get('/bookings', controller.getAllBookings);
router.put('/bookings/:id/status', controller.updateBookings);
router.post('/announcements', controller.postAnnouncement);
router.post('/blacklist', controller.postBlacklist);
router.delete('/blacklist/:id', controller.deleteBlackList);

module.exports = router;