const express = require('express');
const router = express.Router();
const controller = require('../controllers/professorsController');
const {
  authenticateToken,
  authorizeAdmin,
} = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/', controller.getProfessors);
router.post('/', authorizeAdmin, controller.createProfessor);
router.put('/:id', authorizeAdmin, controller.updateProfessor);
router.delete('/:id', authorizeAdmin, controller.deleteProfessor);

module.exports = router;
