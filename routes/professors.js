const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/professorsController');
const {
  authenticateToken,
  authorizeAdmin,
} = require('../middleware/authMiddleware');

router.use(authenticateToken);
router.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '請求過於頻繁，請稍後再試' },
  })
);

router.get('/', controller.getProfessors);
router.post('/', authorizeAdmin, controller.createProfessor);
router.put('/:id', authorizeAdmin, controller.updateProfessor);
router.delete('/:id', authorizeAdmin, controller.deleteProfessor);

module.exports = router;
