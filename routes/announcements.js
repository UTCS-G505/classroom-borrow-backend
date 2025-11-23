const express = require('express');
const router = express.Router();
const controller = require('../controllers/announcementsController');

router.get('/', controller.getAllAnnouncements);
router.get('/:id', controller.getAnnouncementsByid);

module.exports = router;