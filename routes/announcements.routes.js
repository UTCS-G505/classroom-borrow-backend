const express = require('express');
const router = express.Router();
const controller = require('../controllers/announcementsController');
const {
  authenticateToken,
  authorizeAdmin,
} = require('../middleware/authMiddleware');

// Public or Authenticated User routes
// GET /announcements - Allow everyone to see?
// The requirement says "enable admin to manage it", apply to frontend and backend.
// Usually announcements are public.
router.get('/', controller.getAllAnnouncements);
router.get('/:id', controller.getAnnouncementById);

// Admin only routes
router.post(
  '/',
  authenticateToken,
  authorizeAdmin,
  controller.createAnnouncement
);
router.put(
  '/:id',
  authenticateToken,
  authorizeAdmin,
  controller.updateAnnouncement
);
router.delete(
  '/:id',
  authenticateToken,
  authorizeAdmin,
  controller.deleteAnnouncement
);

module.exports = router;
