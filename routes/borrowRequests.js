const express = require('express');
const router = express.Router();
const controller = require('../controllers/borrowRequestsController');

router.get('/', controller.getBookings);
router.get('/:id', controller.getBookingssByid);
router.post('/', controller.postBookings);
router.put('/:id/cancel', controller.postCancelBookings);

module.exports = router;