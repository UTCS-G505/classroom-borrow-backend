const express = require('express');
const router = express.Router();
const controller = require('../controllers/classroomsController');

router.get('/', controller.getAllClassrooms);
router.get('/:id', controller.getClassroomsByid);
router.post('/', controller.postClassrooms);
router.put('/:id', controller.updateClassrooms);
router.delete('/:id', controller.deleteClassrooms);

module.exports = router;