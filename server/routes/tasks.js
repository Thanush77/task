const express = require('express');
const TaskController = require('../controllers/taskController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Task routes
router.get('/', TaskController.getAllTasks);
router.get('/stats', TaskController.getTaskStats);
router.get('/:id', TaskController.getTaskById);
router.post('/', TaskController.createTask);
router.put('/:id', TaskController.updateTask);
router.delete('/:id', TaskController.deleteTask);

// Time tracking endpoints
router.post('/:id/time/start', TaskController.startTime);
router.post('/:id/time/pause', TaskController.pauseTime);
router.get('/:id/time/active', TaskController.getActiveTime);
router.get('/:id/time/history', TaskController.getTimeHistory);

module.exports = router;